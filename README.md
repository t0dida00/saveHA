# SaveHA

SaveHA is a web app for checking ONE shipping-line vessel schedules from Vietnam (HPH, VUT) to North American ports. It installs as an app (PWA). You pick the services and routes, it asks a schedule API for the weekly sailings, and it keeps the resulting CSV files so you can preview, download and compare them.

Built with React 19, TypeScript, Vite and SCSS modules.

## Features

- **Sign-in screen.** A single password protects the app.
- **Check ship schedule:**
  - Pick a start date and how many weeks ahead (2, 4, 6 or 8).
  - Pick services (PS7, MS2, PS3, AP1, PN2, VSE, FP2, PN3, EC5, EC3, EC2, EC4), or **Choose all**.
  - For each service, choose its origin and destination ports. Each service starts with its usual route, and **Reset to default** brings it back.
  - Drag services to reorder them.
  - **Save** remembers your services, ports and order in the browser. **Cancel** drops unsaved changes.
  - **Get Schedule** asks the schedule API and saves the CSV it returns.
- **Scraper status** under the ONE title: a green dot and **Alive** when the server's last scraper health check passed, otherwise a red dot and **Error**, followed by the time of that check (or why there's no result).
- **Update** (in Results) fetches the newest CSV made by the schedule API's scheduled job. The time of the last update shows under the button.
- **Results** keeps the 10 most recent CSV files, newest first. For each file you can:
  - see when it was made and for which search (ⓘ);
  - **preview** it as a table, with `N/A` cells in red and `OMIT` cells in yellow;
  - **download** it;
  - **delete** it (asks first).
- **Compare** two result files: changed sailings, new or removed weeks, and new or removed services are highlighted.
- **Settings:** edit the list of port codes, i.e. each port's code on the ONE website (HPH → VNHPH), and whether it appears under Origin or Destination.

## Requirements

- **Node.js** 20.19+ or 22.12+ (Node 24 works). Check with `node -v`.
- **npm** (comes with Node).
- **The schedule API.** This is a separate server, not part of this repo. It must be running for **Get Schedule** to work, and it must allow requests from the app's address (CORS). See [Schedule API](#schedule-api).

## Installation

```bash
git clone https://github.com/t0dida00/saveHA.git
cd saveHA
npm install
cp .env.example .env
```

Then open `.env` and fill it in (see [Configuration](#configuration)), and start the app:

```bash
npm run dev
```

Open the address Vite prints, usually http://localhost:5173.

## Configuration

All settings are in `.env`. The app reads it when it starts or builds, so **restart `npm run dev` after changing it**.

| Variable | Required | What it does |
|---|---|---|
| `AUTH_PASSWORD` | Yes, unless `DEVELOPMENT=true` | Password for the sign-in screen. |
| `DEVELOPMENT` | No | `true` skips the splash screen and sign-in, for local work. Use `false` for real use. |
| `HOST_URL` | Yes, for Get Schedule | Base address of the schedule API, e.g. `http://localhost:4000/api/v1`. |

Example:

```env
AUTH_PASSWORD=choose-a-password
DEVELOPMENT=false
HOST_URL=http://localhost:4000/api/v1
```

> **About the password:** only a SHA-256 hash of it goes into the app, never the password itself. It's still a simple client-side lock, not real security: anyone with the built files can try passwords offline. Don't rely on it to protect sensitive data.

## How to use

### 1. Check a schedule

1. Sign in, then open **Check ship schedule** in the sidebar.
2. Set **Date** (the first week to look at) and **Next** (how many weeks).
3. In the **ONE** section, open the services dropdown and tick the services you want, or **Choose all**.
4. Click a service row to open it, and tick the **Origin** and **Destination** ports. The row header shows the route and the website codes that will be searched, e.g. `HPH/VUT → LAX/LGB/OAK (VNHPH - USLAX)`.
   - **Codes searched:** each service is searched from its *first* selected origin to its *first* selected destination.
   - **Needs ports:** a service with no origin or no destination is flagged this way, and Get Schedule stays disabled until it's fixed.
5. Optional: drag the ⋮⋮ handle to reorder services. **Reset to default** in the section corner puts every service back to its usual ports.
6. Press **Save** to remember this selection for next time. Date and weeks are not saved.
7. Press **Get Schedule**. The button shows a spinner and a seconds counter. A search for all services takes about a minute.

When it finishes, the CSV appears at the top of **Results**.

### 2. Work with results

Each file in **Results** has four buttons:

| Button | Action |
|---|---|
| ⓘ | Show when the file was made, its size, and the search (date, weeks, services). |
| 👁 | Preview the file as a table. The header row and week column stay in view while you scroll. |
| ⤓ | Download the CSV. |
| 🗑 | Delete the file. A warning asks you to confirm first. |

Only the 10 most recent files are kept. When an 11th arrives, the oldest is removed.

### 3. Compare two results

1. In **Results**, tick the checkboxes of two files.
2. Press **Compare (2/2)**.
3. The older file is the baseline and the newer one is compared against it:
   - **Blue:** a sailing that changed. The old value is struck through and the new one is bold.
   - **Green:** a value, week or service that's only in the newer file.
   - **Grey:** a value, week or service that's only in the older file.
4. **Only show changes** (on by default) hides weeks and services with no changes and blanks unchanged cells. Turn it off to see the full table.

### 4. Edit port codes (Settings)

Open **Settings** in the sidebar to manage the list of ports.

- **Code:** the short port name used in the app (`HPH`).
- **Website code:** the code the ONE website uses (`VNHPH`). This is what gets sent to the API.
- **Origin:** ticked ports are listed under *Origin* on each service. All others are listed under *Destination*.

Use **Add code** to add a port and the trash icon to remove one. Press **Save** to apply, or **Cancel** to drop your edits. **Reset to default** restores the original list from `src/features/ship-schedule/data/portCodes.json`.

A red warning appears if a port that a service uses has no website code. Get Schedule will refuse to search that service until it does.

## Schedule API

The app calls three endpoints on `HOST_URL`.

**Get Schedule:**

```http
POST {HOST_URL}/schedules/one/weekly
Content-Type: application/json
```

When **every** service is selected:

```json
{ "date": "2026-10-06", "next": 8, "services_routes": "all" }
```

When **some** services are selected, they are sent in the order shown, each with its first origin and destination website codes:

```json
{
  "date": "2026-10-06",
  "next": 4,
  "services_routes": {
    "PS3": { "from": "VNCMP", "to": "USLAX" },
    "PS7": { "from": "VNHPH", "to": "USLAX" }
  }
}
```

The API answers with a CSV file (`text/csv`), with its name in the `Content-Disposition` header (e.g. `ONE-06102026.csv`). For the browser to read that name, the API must expose the header:

```
Access-Control-Expose-Headers: Content-Disposition
```

**Update:** returns the newest CSV made by the API's scheduled job, named by `Content-Disposition` as above. A `404` means the job hasn't made a file yet.

```http
GET {HOST_URL}/schedules/one/weekly/latest
```

If Results already has that file (same name and content), Update doesn't add it again. A scheduled file's ⓘ says "Scheduled run on the server" because the app doesn't know which search made it.

**Scraper status:** returns the verdict of the API's last scheduled health check. It never starts a scrape. A `404` (no check yet) shows as **Error**.

```http
GET {HOST_URL}/schedules/one/healthCheck/latest
```

```json
{ "alive": true, "checkedAt": "2026-10-06T02:00:12.000Z", "seconds": 12 }
```

A quick check that the API is up: `GET {HOST_URL}/health`.

## Where data is kept

There is no database. Everything is stored in the browser's local storage, so it stays on that browser and device only:

| What | Storage key |
|---|---|
| Saved services, ports and order | `saveha.shipSchedule.selection` |
| The 10 most recent result files | `saveha.shipSchedule.files` |
| Port codes from Settings | `saveha.shipSchedule.portCodes` |
| Time of the last Update | `saveha.shipSchedule.lastUpdate` |

Clearing the browser's site data resets all of it.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server (the PWA service worker is on in dev too). |
| `npm run build` | Type-check and build the production app into `dist/`. |
| `npm run preview` | Serve the production build locally. |
| `npm run lint` | Check the code with oxlint. |
| `npm run generate-pwa-assets` | Regenerate app icons from `public/favicon.svg`. |

## Deploying

1. Set `AUTH_PASSWORD`, `DEVELOPMENT=false` and `HOST_URL` in `.env`, then run `npm run build`.
2. Host the `dist/` folder on any static web host.
3. Make sure that host serves `index.html` for every path, so `/ship-schedule` and `/settings` work when reloaded.

`HOST_URL` is built into the app, so it must be an address users' browsers can reach. A `localhost` address only works on the machine running the API. The API must also allow the deployed site's address in its CORS settings.

## Project structure

```
src/
  app/                    App shell: routes, layout, sidebar
  features/
    auth/                 Sign-in page and password check
    splash/               Loading screen
    dashboard/            Dashboard page
    ship-schedule/        Check ship schedule
      components/         ServicePicker, RouteCard, ScraperStatus, RecentFiles, CsvPreview, CsvCompare, PortCodesEditor
      data/               Service list, default port codes (portCodes.json), port code store
      hooks/              Saved selection, recent files
      services/           Schedule API call
      utils/              CSV parsing and comparison, date formatting
    report/               Report page
    settings/             Settings page
  shared/components/      PageHeader, ConfirmDialog
  styles/                 Design tokens (_tokens.scss) and global styles
```

Each feature exposes what other features may use through its `index.ts`. Import from `@/features/<name>`, not from files inside it. Components are styled with SCSS modules (`*.module.scss`) that start with `@use '@/styles/tokens' as *;`.

The services and their usual routes are defined in `src/features/ship-schedule/data/services.ts`.
