/** One sailing as the bookmarklet reads it from a result card on hapag-lloyd.com */
export type HplSailing = {
  /** e.g. AA7; empty when the card shows none */
  service: string
  /** e.g. WAN HAI A15 */
  vessel: string
  /** e.g. E010 */
  voyage: string
  /** Departure from the POL, YYYY-MM-DD */
  departure: string
}

/** What the bookmarklet copies: one search (POL → POD from a date) and its sailings */
export type HplPaste = {
  /** Website codes, e.g. VNVUT and USNYC */
  from: string
  to: string
  departureDate: string
  sailings: HplSailing[]
}

/**
 * Runs on a Hapag-Lloyd results page the viewer opened, so it only reads what's on their screen.
 * Each card's first voyage is the ship leaving the POL; Gemini Cooperation services (e.g. US4)
 * wear the gemini badge instead of the service one. The search is read from the URL hash.
 */
export const HPL_READER = `(() => {
  const text = (root, selector) => (root.querySelector(selector)?.textContent || '').trim();
  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  const sailings = [...document.querySelectorAll('.hal-schedule')].flatMap((card) => {
    const voyage = card.querySelector('.hal-schedule-voyage');
    const departure = text(card, '.hal-schedule-location--start .hal-schedule-location__date');
    if (!voyage || !/^\\d{4}-\\d{2}-\\d{2}$/.test(departure)) return [];
    return [{
      service: text(voyage, '.q-badge--service, .q-badge--gemini'),
      vessel: text(voyage, '.q-badge--vessel').toUpperCase(),
      voyage: text(voyage, '.q-badge--voyage').replace(/^voyage no\\.?:?\\s*/i, ''),
      departure,
    }];
  });
  if (!sailings.length) { alert('No Hapag-Lloyd results on this page. Open a SaveHA link and wait for the sailings.'); return; }
  const from = params.get('sl'), to = params.get('el');
  const json = JSON.stringify({ source: 'saveha-hpl', from, to, departureDate: params.get('departureDate'), sailings });
  const done = () => alert('Copied ' + sailings.length + ' sailings for ' + from + ' → ' + to + '. Paste them into SaveHA.');
  // No clipboard (or no permission): show the text to copy by hand
  (navigator.clipboard ? navigator.clipboard.writeText(json) : Promise.reject()).then(done, () => prompt('Copy this and paste it into SaveHA:', json));
})()`

/** The reader as a bookmark: drag it to the bookmarks bar, click it on a results page */
export const HPL_BOOKMARKLET = `javascript:${encodeURIComponent(HPL_READER)}`

const LOCODE = /^[A-Z]{2}[A-Z0-9]{3}$/
const DATE = /^\d{4}-\d{2}-\d{2}$/

const isSailing = (value: unknown): value is HplSailing => {
  const s = value as HplSailing
  return (
    typeof s === 'object' &&
    s !== null &&
    typeof s.service === 'string' &&
    typeof s.vessel === 'string' &&
    typeof s.voyage === 'string' &&
    DATE.test(s.departure)
  )
}

/** Reads what the bookmarklet copied; throws a message fit to show when it's something else */
export function parseHplPaste(text: string): HplPaste {
  let data: unknown
  try {
    data = JSON.parse(text.trim())
  } catch {
    throw new Error("That isn't what the Copy HPL schedule bookmark copies.")
  }
  const paste = data as HplPaste & { source?: string }
  if (paste?.source !== 'saveha-hpl') throw new Error("That isn't what the Copy HPL schedule bookmark copies.")
  if (!LOCODE.test(paste.from ?? '') || !LOCODE.test(paste.to ?? '')) {
    throw new Error('The copied results have no start and end location. Open the search from a SaveHA link.')
  }
  if (!Array.isArray(paste.sailings) || !paste.sailings.every(isSailing)) {
    throw new Error('The copied sailings look damaged. Copy them again.')
  }
  return { from: paste.from, to: paste.to, departureDate: paste.departureDate, sailings: paste.sailings }
}
