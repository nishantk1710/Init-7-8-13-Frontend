# Demo mode — one deployment, two data sources

The app can serve either the **live backend** or a **recorded demo dataset**,
switched at runtime from the **Data source** toggle at the bottom of the
sidebar. One build, one deployment, one URL.

The point: the deployed app keeps working while the Azure backend integration
settles. Demo is the known-good fallback, one click away — and when the live
backend stops answering, the banner at the top of every page offers it.

## How it works

```
                    ┌─ live ─▶ fetch(NEXT_PUBLIC_API_BASE_URL + path)
lib/api/client.ts ──┤
   request()        └─ demo ─▶ mocks/resolve.ts ─▶ mocks/demo-dataset.json
```

Every backend call in the app goes through `request()` in
`src/lib/api/client.ts`. That is the only place demo mode intervenes — no
screen, loader or mapper knows which mode it is in. In demo mode the resolver
returns a real `Response`, so error handling, `X-Total-Count` and the Excel
download behave exactly as live.

| Piece | File |
| --- | --- |
| Mode (cookie `spares-data-mode`, default from env) | `src/lib/data-mode.ts` |
| Toggle + banner + live health check | `src/components/shared/data-mode.tsx` |
| Resolver | `src/mocks/resolve.ts` |
| Scripted assistant | `src/mocks/assistant.ts` |
| The dataset (one file, ~600 KB) | `src/mocks/demo-dataset.json` |
| Recorder | `scripts/mock-data/record.mts` |

The mode is a **cookie**, not localStorage, because server components fetch too
and a server only sees cookies. Switching reloads the page so server and client
both refetch.

### What demo mode does with each request

- **GET** — the recorded response for that exact request; otherwise the closest
  recording of the same route, narrowed by the request's filters where the rows
  carry a matching field; otherwise a 404 saying the record is not in the demo
  dataset.
- **Assistant** — replays the backend-generated wire fixtures in
  `src/lib/api/__fixtures__/`: an 80-series material opens the I08 conversation
  (8000005632 @ 1300), anything else the I13 one (1000000123 @ 1300). Branches
  follow the answers given. Free-text questions say they need live data.
- **Every other write** — refused with 403 and "Demo mode: changes are not
  saved." Nothing is ever written, so a demo cannot leave rows in the backend's
  append-only tables.

## Configuring a deployment

```bash
# Start in demo until the backend is trusted. The toggle still switches, per browser.
NEXT_PUBLIC_DEFAULT_DATA_MODE=demo

# The backend used in live mode, as before.
NEXT_PUBLIC_API_BASE_URL=https://<backend>/api
```

Unset `NEXT_PUBLIC_DEFAULT_DATA_MODE` means live — local development is
unchanged.

## Re-recording the dataset

Do this when the backend's response shapes change, or to refresh the data.
Requires the backend running locally on :8000 with its seeded data.

```bash
# 1. Recording proxy: forwards GETs to :8000 and saves each response to
#    .mock-recordings/ (gitignored). POSTs are refused, never forwarded.
npm run mock:record -- proxy

# 2. In another shell, a dev server pointed at the proxy.
#    NEXT_PUBLIC_DATASET=live so Initiative 7 calls the API too.
NEXT_PUBLIC_DATASET=live NEXT_PUBLIC_API_BASE_URL=http://localhost:8765/api npx next dev -p 3100

# 3. Load every route in headless Edge/Chrome, then click through anything
#    interactive you want covered.
npm run mock:record -- crawl http://localhost:3100

# 4. Record the detail endpoints for the rows the bundle keeps.
npm run mock:record -- seed

# 5. Write src/mocks/demo-dataset.json and check it.
npm run mock:record -- bundle
npm test
```

`bundle` keeps 20 rows per list (`MOCK_BUNDLE_ROWS`), first pages only, and
the detail responses of exactly those rows, so every row on a demo screen opens.
Reported totals are clamped to match.

## Known limits

- **Initiative 7 was not recorded.** The local database used for the first
  recording was behind on migrations (`i7_*` tables missing). I07's screens only
  call the API when built with `NEXT_PUBLIC_DATASET=live`; without it they
  render their scenario fixtures in both modes. Re-record once the database is
  migrated to include them.
- **Demo data is a sample.** 20 rows per list. Some page subtitles still quote
  the full extract's counts from the recorded metadata.
- **Filters are approximate** for combinations that were not recorded: the
  resolver narrows by fields it can match and leaves the rest.
