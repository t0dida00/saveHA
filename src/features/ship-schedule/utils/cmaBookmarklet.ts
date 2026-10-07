/** Most weeks CMA CGM's routing finder searches at once */
export const CMA_MAX_WEEKS = 10

/** One search on CMA CGM's routing finder, and the services it covers */
export type CmaRoute = { from: string; to: string; codes: string[] }

/**
 * The searches a SaveHA link opens, put in its hash for the fill bookmark to read, e.g.
 * #saveha=MTE:VNVUT-USLAX;PEARL+EXX:VNHPH-USLAX&date=2026-10-08. Always the full 10 weeks.
 */
export const cmaSearchHash = (routes: CmaRoute[], date: string) =>
  `#saveha=${routes.map((r) => `${r.codes.join('+')}:${r.from}-${r.to}`).join(';')}&date=${date}`

/**
 * Runs on cma-cgm.com's routing finder the viewer opened, and fills its search like they would: types
 * each code into Origin and Destination and picks the matching port, sets the date and 10 weeks, then
 * presses Search.
 *
 * A link can carry several routes. Each search reloads the page, so the routes wait in the tab's
 * sessionStorage: every click of the bookmark first reads the results on screen (each card's date at
 * the POL, main vessel and voyage ref.) and copies all found so far for SaveHA, then searches the next
 * route. The click after the last search copies everything and ends the run. Without a SaveHA link it
 * asks for a route.
 *
 * Origin and Destination are Kendo autocompletes (#AutoCompletePOL, #AutoCompletePOD) behind CMA's own
 * suggestion popup (#sortedAutocompletePopup-<id>). If picking a suggestion doesn't take, the form's
 * fields are filled from that suggestion directly: "VUNG TAU ; VN ; VNVUT", as the form expects.
 */
export const CMA_FILLER = `(async () => {
  const $ = window.jQuery;
  const pol = document.getElementById('AutoCompletePOL'), pod = document.getElementById('AutoCompletePOD');
  if (!$ || !pol || !pod) { alert('This is not the CMA CGM routing finder. Open a SaveHA link first.'); return; }
  const KEY = 'saveha-cma-v5';
  const code = /^[A-Z]{2}[A-Z0-9]{3}$/;
  const parse = (text) => text.split(';').map((part) => {
    const [codes, pair] = part.includes(':') ? part.split(':') : ['', part];
    const [from, to] = (pair || '').trim().toUpperCase().split(/[-, ]+/);
    return { codes: codes.split('+').filter(Boolean), from, to };
  }).filter((r) => code.test(r.from || '') && code.test(r.to || ''));

  // A SaveHA link's routes start a new run; otherwise carry on with the one waiting in this tab
  const hash = decodeURIComponent(location.hash);
  const fromHash = (hash.match(/saveha=([^&]+)/) || [])[1];
  let run = JSON.parse(sessionStorage.getItem(KEY) || 'null');
  if (fromHash && (!run || run.hash !== hash)) {
    run = { hash, routes: parse(fromHash), date: (hash.match(/date=(\\d{4}-\\d{2}-\\d{2})/) || [])[1], next: 0, found: {} };
  }
  if (!run) {
    const typed = parse((prompt('Route to search, e.g. VNVUT-USLAX') || '').trim());
    run = { hash: '', routes: typed, next: 0, found: {} };
  }
  if (!run.routes.length) { alert('No route to fill. Open the search from a SaveHA link.'); return; }

  // The results on screen, if they're the route searched last: each card's first ship from the POL
  const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const DATE = /(\\d{2})-([A-Z]{3})-(\\d{4})/;
  const iso = (m) => m[3] + '-' + String(MONTHS.indexOf(m[2]) + 1).padStart(2, '0') + '-' + m[1];
  const clean = (t) => (t || '').replace(/\\s+/g, ' ').trim();
  // <dt>Main vessel</dt><dd>CMA CGM FUJI</dd>, in the card's collapsed .more-infos.vessel (still in the page)
  const labelled = (card, re) => {
    const el = [...card.querySelectorAll('*')].find((e) => re.test(clean(e.textContent)));
    if (!el) return '';
    return clean(el.nextElementSibling ? el.nextElementSibling.textContent : el.parentElement.textContent.replace(el.textContent, ''));
  };
  // Routing solutions filter: each service code, e.g. MTE from "Solution 1 : Service MTE (MTE)", and its checkbox values
  const solutionsOf = () => {
    const found = {};
    any = false;
    document.querySelectorAll('#solutionfilters input[type=checkbox]').forEach((box) => {
      const text = clean((box.id && document.querySelector('label[for="' + box.id + '"]')?.textContent) || box.closest('li, div')?.textContent).toUpperCase();
      // Only a service on its own: "Service BBX2CNC / Service Yangtse Service (YANGTSE) via NINGBO" isn't YANGTSE
      const solution = text.replace(/^SOLUTION\\s*\\d+\\s*:\\s*/, '');
      const m = solution.match(/^SERVICE\\b[^/]*\\(([A-Z0-9]+)\\)$/);
      if (m && box.value && !/\\sVIA\\s/.test(solution)) (found[m[1]] = found[m[1]] || []).push(box.value);
      any = true;
    });
    return found;
  };
  let solutions = {}, any = false;
  const readCards = (route) => [...document.querySelectorAll('.cardelem')].flatMap((card) => {
    // The POL date sits in #DepartureDates_<n> .date; failing that, the line with the POL badge
    const departure = card.querySelector('[id^="DepartureDates"] .date, .DepartureDatesCls .date, [id^="DepartureDates"], .DepartureDatesCls');
    let m = departure && clean(departure.textContent).toUpperCase().match(DATE);
    let row = [...card.querySelectorAll('*')].find((e) => clean(e.textContent) === 'POL');
    for (let i = 0; row && i < 5 && !m; i++, row = row.parentElement) m = clean(row.textContent).toUpperCase().match(DATE);
    if (!m) m = clean(card.textContent).toUpperCase().match(DATE);
    const vessel = labelled(card, /^main vessel$/i).toUpperCase();
    if (!m || !vessel) return [];
    // Each card carries its Routing solution's value as a class. Kept: the solution that is the route's
    // service alone ("Solution 1 : Service Yangtse Service (YANGTSE)"), not a feeder plus it, nor via a port.
    // Without that filter, the card's own <dt>Service</dt><dd>Yangtse Service (YANGTSE)</dd>.
    const service = any
      ? route.codes.find((c) => (solutions[c] || []).some((v) => v.split(' ').filter(Boolean).every((t) => card.classList.contains(t))))
      : route.codes.find((c) => labelled(card, /^service$/i).toUpperCase().includes('(' + c + ')'));
    if (!service) return [];
    return [{ service, vessel, voyage: labelled(card, /^voyage ref\\.?$/i).toUpperCase(), departure: iso(m) }];
  });
  const last = run.next > 0 ? run.routes[run.next - 1] : null;
  const shown = (prefix, place) => (document.getElementById('Actual' + prefix + 'Description')?.value || '').trim().endsWith(place);
  if (last && shown('POL', last.from) && shown('POD', last.to)) {
    const key = last.from + '-' + last.to;
    const seen = new Map((run.found[key] || []).map((s) => [s.vessel + s.voyage + s.departure, s]));
    const cards = document.querySelectorAll('.cardelem').length;
    solutions = solutionsOf();
    const kept = readCards(last);
    kept.forEach((s) => seen.set(s.vessel + s.voyage + s.departure, s));
    run.skipped = (run.skipped || 0) + cards - kept.length;
    run.found[key] = [...seen.values()];
    sessionStorage.setItem(KEY, JSON.stringify(run));
  }

  // Everything found so far, for SaveHA's paste box: copied on every click, so it's never out of date
  const total = Object.values(run.found).reduce((n, list) => n + list.length, 0);
  const json = JSON.stringify({ source: 'saveha-cma', date: run.date, routes: run.routes.map((r) => ({ ...r, sailings: run.found[r.from + '-' + r.to] || null })) });
  const copied = navigator.clipboard ? navigator.clipboard.writeText(json).then(() => true, () => false) : Promise.resolve(false);
  if (run.next >= run.routes.length) {
    sessionStorage.removeItem(KEY);
    if (await copied) alert('Copied ' + total + ' sailings from ' + run.routes.length + ' CMA CGM searches. Paste them into SaveHA.' + (run.skipped ? ' ' + run.skipped + ' results were left out: not on the route services.' : ''));
    else prompt('Copy this and paste it into SaveHA:', json);
    return;
  }
  const { from, to, codes } = run.routes[run.next];
  const label = (codes.length ? codes.join(', ') + ' ' : '') + from + ' → ' + to;
  const date = run.date;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const fire = (el, type) => el.dispatchEvent(new Event(type, { bubbles: true }));

  const fillPlace = async (input, prefix, value) => {
    const ac = $(input).data('kendoAutoComplete');
    const popup = () => document.getElementById('sortedAutocompletePopup-' + input.id);
    input.focus();
    if (ac) ac.value('');
    input.value = value;
    fire(input, 'input');
    input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: value.slice(-1) }));
    if (ac) ac.search(value);
    // The port, not "Ramp • Door", whose code is exactly this one
    let pick;
    for (let i = 0; i < 40 && !pick; i++) {
      await wait(250);
      pick = [...(popup()?.querySelectorAll('.place-suggestion') || [])].find((li) =>
        (li.querySelector('.code')?.textContent || '').toUpperCase().includes(value) &&
        (li.querySelector('.capsule')?.textContent || '').trim().toLowerCase() === 'port');
    }
    if (!pick) return false;
    pick.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    pick.click();
    await wait(300);
    const actual = document.getElementById('Actual' + prefix + 'Description');
    if (!actual.value.endsWith(value)) {
      // The click didn't take: fill the fields the way picking does
      const description = (pick.querySelector('.place')?.textContent || '').trim().toUpperCase() + ' ; ' + value.slice(0, 2) + ' ; ' + value;
      if (ac) ac.value(description); else input.value = description;
      actual.value = description;
      const type = document.getElementById('Actual' + prefix + 'Type');
      type.value = 'Port';
      fire(type, 'change');
    }
    input.blur();
    return true;
  };

  if (!(await fillPlace(pol, 'POL', from))) { alert(label + ': CMA CGM has no port ' + from + '. Pick the origin by hand.'); return; }
  if (!(await fillPlace(pod, 'POD', to))) { alert(label + ': CMA CGM has no port ' + to + '. Pick the destination by hand.'); return; }

  $('#IsDeparture').data('kendoDropDownList')?.value('True');
  if (/^\\d{4}-\\d{2}-\\d{2}$/.test(date || '')) {
    const [y, m, d] = date.split('-').map(Number);
    const picker = $('#datepicker').data('kendoDatePicker');
    if (picker) { picker.value(new Date(y, m - 1, d)); picker.trigger('change'); }
  }
  const range = document.getElementById('field');
  if (range) { range.value = '${CMA_MAX_WEEKS}'; fire(range, 'change'); }

  // Counted as searched only once it's sent, so a failed fill tries the same route again
  run.next += 1;
  sessionStorage.setItem(KEY, JSON.stringify(run));
  const left = run.routes.length - run.next;
  const note = document.createElement('div');
  note.textContent = 'SaveHA: searching ' + run.next + ' of ' + run.routes.length + ': ' + label +
    (left ? '. When the results show, click the bookmark for the next one.' : '. When the results show, click the bookmark once more to copy them all.');
  note.style.cssText = 'position:fixed;z-index:2147483647;top:16px;left:50%;transform:translateX(-50%);padding:12px 20px;border-radius:8px;background:#232f3f;color:#fff;font:600 15px system-ui;box-shadow:0 8px 24px rgb(0 0 0/.25)';
  document.body.append(note);
  await wait(200);
  document.getElementById('searchSchedules').click();
})()`

/** The filler as a bookmark: drag it to the bookmarks bar, click it on the routing finder */
export const CMA_BOOKMARKLET = `javascript:${encodeURIComponent(CMA_FILLER)}`

/** One sailing as the bookmark reads it from a routing finder result card */
export type CmaSailing = {
  /** The route's service the card belongs to, by CMA's code, e.g. YANGTSE or PEARLAS1 */
  service: string
  /** e.g. NEWPORT CYPRESS 96 */
  vessel: string
  /** e.g. 413940W13 */
  voyage: string
  /** Departure from the POL, YYYY-MM-DD */
  departure: string
}

/** What the bookmark copies: every route of the run, and its sailings (null: not searched yet) */
export type CmaPaste = { routes: (CmaRoute & { sailings: CmaSailing[] | null })[] }

const LOCODE = /^[A-Z]{2}[A-Z0-9]{3}$/

/** Reads what the bookmark copied; throws a message fit to show when it's something else */
export function parseCmaPaste(text: string): CmaPaste {
  let data: unknown
  try {
    data = JSON.parse(text.trim())
  } catch {
    throw new Error("That isn't what the Fill CMA search bookmark copies.")
  }
  const paste = data as CmaPaste & { source?: string }
  if (paste?.source !== 'saveha-cma' || !Array.isArray(paste.routes)) {
    throw new Error("That isn't what the Fill CMA search bookmark copies.")
  }
  const routes = paste.routes.filter((r) => LOCODE.test(r?.from ?? '') && LOCODE.test(r?.to ?? ''))
  if (!routes.some((r) => Array.isArray(r.sailings))) {
    throw new Error('Nothing searched yet. Click the bookmark on CMA CGM after the results show, then paste again.')
  }
  return { routes }
}
