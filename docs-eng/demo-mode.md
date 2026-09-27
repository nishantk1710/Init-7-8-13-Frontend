# Demo mode — two frontends, one deployment

The app serves one of two frontends, chosen per browser at runtime:

| Mode | Frontend | Data |
| --- | --- | --- |
| **Live** | this branch (`src/app/(live)/`, `src/…`) | the real backend (`NEXT_PUBLIC_API_BASE_URL`) |
| **Demo** | main's frontend, unchanged (`src/app/demo/`, `src/demo/`) | main's own mock data; never calls the backend |

Switch with the **Data source** toggle in the live sidebar, or **Switch to live**
on the demo strip. In live mode, if `GET /health` fails, a red strip offers
**Switch to demo data**.

## How it works

```
request ──▶ src/proxy.ts ──┬─ live ─▶ app/(live)/…        (untouched)
            reads cookie   └─ demo ─▶ app/demo/…          (rewrite: /home → /demo/home)
```

- The mode is the `spares-data-mode` cookie, defaulting to
  `NEXT_PUBLIC_DEFAULT_DATA_MODE` (unset means live).
- The proxy **rewrites** rather than redirects, so URLs look the same in both
  modes and main's links (which know nothing of `/demo`) keep working.
  `/demo/...` itself always redirects to the plain path.
- Each frontend has its own shell layout. `app/layout.tsx` holds only what both
  share, plus the mode strip.
- Switching stays on the current page if the other frontend has it, otherwise
  goes to `/home`. The two don't share every route: main has `/chat`, live has
  `/assistant`.

## The demo copy

`src/app/demo/` and `src/demo/` are main's `src/app/` and `src/` as of
`origin/main`. The only edits:

- `@/` imports became `@demo/` (tsconfig alias), so main's code resolves to its
  own copy.
- Main's root layout became `app/demo/layout.tsx`, without `<html>`/`<body>`.
- Main's tests, and the 46 files no demo page imports (main's SAP tooling,
  unused components, READMEs), were left out.

Treat it as frozen. Change the demo by changing it here; nothing on `main`
flows in automatically.

## Configuring a deployment

```bash
NEXT_PUBLIC_DEFAULT_DATA_MODE=demo            # open in demo until the backend is trusted
NEXT_PUBLIC_API_BASE_URL=https://<backend>/api # used by live mode, as before
```

Both are read at build time (`NEXT_PUBLIC_*`), so set them in the deploy
workflow's build step.
