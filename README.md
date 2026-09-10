# Spares AI — Frontend

Next.js + React + TypeScript application for Spares AI.

## Run

```bash
npm install
npm run dev      # http://localhost:3000
```

Other scripts: `npm run build`, `npm run start`, `npm run lint`.

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript (strict) · Tailwind CSS v4 ·
shadcn/ui (`base-nova` style) with `@base-ui/react` · Recharts · next-themes · sonner.

## Structure

```
frontend/
├── src/
│   ├── app/                 App Router routes
│   │   ├── approvals/  audit/  chat/  dashboard/  materials/
│   ├── components/          UI and feature components
│   │   ├── approvals/  audit/  chat/  dashboard/  layout/
│   │   ├── materials/  shared/  situation-analysis/  ui/  workflow/
│   └── lib/
│       ├── api/client.ts    backend client (see below)
│       ├── data/            mock data
│       ├── mock-data.ts  situation-analysis-data.ts
│       ├── constants.ts  csv.ts  types.ts  utils.ts
├── public/
└── config: next.config.ts · tsconfig.json · postcss.config.mjs
          eslint.config.mjs · components.json
```

Routes currently built: `/`, `/approvals`, `/audit`, `/chat`, `/chat/[sessionId]`,
`/chat/new/[materialId]`, `/dashboard`, `/dashboard/situation-analysis`, `/materials`.

## Backend connectivity

The UI runs entirely on mock data and does **not** call the backend yet. A minimal
client exists so that when it does, the base URL lives in one place:

```ts
import { getHealth } from "@/lib/api/client";

const health = await getHealth();   // GET {NEXT_PUBLIC_API_BASE_URL}/health
```

Configure it by copying the template:

```bash
cp .env.example .env.local
```

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api
```

`.env.local` is gitignored. Next.js inlines `NEXT_PUBLIC_*` at build time, so restart
the dev server after changing it. Do not hardcode `localhost` in components — import
from `@/lib/api/client` instead.

The backend must be running for these calls to succeed, and its `FRONTEND_ORIGIN` must
list this app's origin (defaults to `http://localhost:3000`). See
[../backend/README.md](../backend/README.md).

## Note

If `npm run build` fails with a missing-module type error for a route that does not
exist in `src/app/` (e.g. `.next/dev/types/validator.ts` referencing a removed page),
the `.next` cache is stale from a previous branch. Delete `.next` and rebuild.
