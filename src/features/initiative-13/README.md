# Initiative 13 — OAR Utilization Tracking

End-to-end tracking of Order-As-Required (OAR) spares demand, from the
original request through Reservation → PR → PO → Goods Receipt → Goods Issue
→ Utilization Confirmation.

## How this module gets its data

**Every screen except Redeployment reads the FastAPI backend.** The claim this
README used to open with — "a high-fidelity UI mockup with deterministic mock
data, no real backend/SAP calls anywhere in this module" — stopped being true at
W6.7 and is corrected here.

The shape follows Initiative 8's, deliberately:

| Layer | Where | Job |
|---|---|---|
| Wire client | `@/lib/api/i13` | Typed functions over `/api/i13/*`, snake_case → camelCase, `oneOf` guards on every union, decimals that stay `undefined` when unknown |
| Adapters | `data/live-loaders.ts`, `data/live-dashboard.ts` | Fetch, derive filter options, throw on failure |
| Pages | `pages/*.tsx` | **async server components**: `await connection()`, `try/catch` around the fetch only, `loadError` passed down |
| Tables | `components/*.tsx` | `"use client"`, render and narrow rows they are handed |

Three rules worth knowing before changing anything here:

1. **Filters live in the URL, not in `useState`.** The pages are server
   components, so filter state has to be somewhere the server can read.
   `I13UrlFilters` writes `searchParams`; the page reads them and passes them to
   the backend, which does the filtering. A filtered screen is therefore a link
   somebody can send. See `utils/search-params.ts` for why this diverges from
   Initiative 8, which fetches its whole register and filters in the browser.
2. **A backed screen has no fixture fallback.** An empty table and an
   unreachable backend are different statements; `components/load-states.tsx`
   renders the second as a failure and never as the first.
3. **Writes go through Server Actions** (`actions.ts`), so `revalidatePath` can
   follow them. That is the whole mechanism by which recording a confirmation
   updates the exception panel, the justification log and the KPIs together.

### What is still fixture-backed, and says so on screen

- **Redeployment** — entirely hand-written. D10 defers the workflow and there is
  no endpoint; cross-plant stock is in scope for *visibility* only, which is
  served on every ACT exception and in the assistant's cross-check.
- **Three Overview charts** — unutilized value by department, NM/SM inflow, and
  redeployment avoidance. No endpoint serves them and no valuation source exists
  in Initiative 13's table set.
- **The four cross-initiative selectors** (`summary`, `global-actions`,
  `audit-events`, `material-360-adapter`) and `oar-lookup`. They are
  **synchronous** and are consumed by app-wide shared code — `lib/aggregation.ts`,
  the material router, the Material 360 drawer — which Initiative 7 reads too.
  Making them live is an async refactor across somebody else's module.

Each of the first two carries a `USING_LIVE_DATA` banner, the same way
Initiative 8's overview does. A hand-written number sitting unlabelled beside a
real one is exactly the confusion `lib/dataset-mode.ts` exists to prevent.

## Ownership

Everything under `src/features/initiative-13/**` and the thin route wrappers
under `src/app/oar-utilization/**` belongs to Initiative 13. No other
initiative may import from this folder except through the two contracts
listed under "Integration points" below. This module never imports from
`@/features/initiative-7/**` or `@/features/initiative-8/**`, and never edits
the chat workspace directly.

**Files other initiatives must not modify:** the entire `src/features/initiative-13/**`
tree, including `manifest.ts`, every file under `selectors/`, `components/`,
`pages/`, `data/`, `types/`, `hooks/` and `utils/`, plus `actions.ts`, and this
README — this
also covers `selectors/oar-lookup.ts`, which `lib/material-router.ts` (owned
by the global shell) calls into for OAR routing precedence.

## Pages

| Route | Component | Purpose |
|---|---|---|
| `/oar-utilization` | `pages/overview-page.tsx` | KPIs + charts. Aging and acquired-vs-plan are backend-computed; three charts are demo data and are banner-labelled |
| `/oar-utilization/utilisation-dashboard` | `pages/utilisation-dashboard-page.tsx` | **W6.7 (FR-10).** One consolidated view, fetched server-side in a single `Promise.allSettled`; optional sections degrade independently |
| `/oar-utilization/ledger` | `pages/ledger-page.tsx` | Every OAR reservation line with its document chain, expandable |
| `/oar-utilization/aging-exceptions` | `pages/aging-exceptions-page.tsx` | **The FR-9 ACT queue.** Owner, routing state, escalation, session link, and a confirmation that is really recorded |
| `/oar-utilization/watch` | `pages/watch-page.tsx` | FR-1/FR-6 metrics per material and plant, from the persisted W6.3 mart |
| `/oar-utilization/plans` | `pages/plans-page.tsx` | **FR-4.** Consumption plans captured through the assistant — the real ones, kept apart from the 742 generated rows |
| `/oar-utilization/reclassification` | `pages/reclassification-page.tsx` | SOP evidence for a stocked-material review, advisory only |
| `/oar-utilization/redeployment` | `pages/redeployment-page.tsx` | Fixture-backed; D10 defers the workflow |
| `/oar-utilization/validation` | `pages/validation-page.tsx` | Reconciliation against ZMM065 and the 30-Day GR Report |

### The Exceptions screen reads a different endpoint than it used to

It rendered `GET /i13/exceptions` — W6.3's older, ephemeral queue, recomputed
per request, with no owner, no state machine, no audit trail and no session
reference. Everything FR-9 specifies lives in W6.6's `/i13/act/exceptions`,
which had only ever been a read-only panel on the dashboard.

The board's Acknowledge / Mark Resolved buttons moved a badge in local
`useState` and wrote nothing anywhere. They are now a **Record confirmation**
dialog posting to `POST /i13/act/exceptions/{id}/confirmation`, a validated
transition with an append-only audit entry. An exception that was never routed
to anybody cannot be confirmed — the state machine refuses it, correctly — so
the row says why instead of offering a button that fails.

## Business entities / types (`types/oar.ts`)

- `UtilizationLedgerLine` — one reservation-anchored ledger row (tracking ID,
  document chain, requester, plant, department, quantities at each stage,
  aging, exception type). `stage: LedgerStage`.
- `DocumentChainStep` — one hop in the RR → Reservation → PR → PO → GR → GI →
  Confirmation chain, rendered via the shared `Timeline` component.
- `EscalationTimelineEvent` — one step in the Requester → HOD → Inventory
  Control escalation chain.
- `RedeploymentCandidate` / `RedeploymentMatch` — a requested material at one
  plant matched against unused stock at the other plant.
- `ReclassificationCandidate` — consumption-frequency stats + recommendation
  for a stocked-material review.

These are Initiative 13's own types, intentionally richer than the shared
`@/lib/domain/contracts` shapes — no initiative-specific fields were added to
that shared file.

## Mock datasets (`data/`)

- `materials.ts` — `materialRef()`/`unitPriceFor()` resolve real shared-catalog
  materials by id, falling back to a small synthetic OAR-only
  material (`OAR-77002`) not present in the shared catalog.
- `ledger.ts` — `LEDGER_LINES`, 11 rows covering seed scenarios E (happy
  path, `OAR-LDG-0001`), F (confirmation overdue, `OAR-LDG-0002`), G (no
  longer required → redeployment pool, `OAR-LDG-0003`), H (three
  reservations consolidated into one PR/PO, `OAR-LDG-0004..0006`,
  `allocationMethod: "Shared / FIFO Mock Allocation"`), I (frequent-use
  reclassification candidate `500-31005`, `OAR-LDG-0007`), plus four filler
  lines (one previously re-planned, one early-stage) spanning both plants and
  six departments.
- `escalations.ts` — `ESCALATION_TIMELINES`, keyed by ledger line id, named
  people sourced from `@/lib/shared-data/users`.
- `redeployment.ts` — `REDEPLOYMENT_CANDIDATES`, using both `PLANTS`. Scope is
  two plants, so a candidate has at most one match: the site that is not the
  requesting one.
- `reclassification.ts` — `RECLASSIFICATION_CANDIDATES`, includes `500-31005`.
- `overview-metrics.ts` — KPIs computed from `LEDGER_LINES` plus a few
  standalone illustrative chart datasets (aging buckets, plan-vs-actual,
  NM/SM inflow trend).

## Public exports

- `manifest.ts` → `initiative13Manifest` (sidebar nav + suggested questions,
  pre-wired — hrefs unchanged from scaffolding).
- `selectors/summary.ts` → `getInitiative13Summary()` — Spares Control Tower
  overview card + Action Center feed.
- `selectors/material-360-adapter.ts` → `getInitiative13Material360Signal(materialId)`
  — global Material 360 drawer.
- `selectors/global-actions.ts` → `getInitiative13GlobalActions()` — global
  Action Center, derived from ledger exception lines + reclassification data.
- `selectors/audit-events.ts` → `getInitiative13AuditEvents()` — global Audit
  Trail, derived from the ledger's document chain, escalation timelines and
  reclassification flags (seeded/static — UI actions on the Aging
  Exceptions/Redeployment pages simulate a write via toast + local component
  state, and do not mutate this feed).
- `selectors/oar-lookup.ts` → `isOARMaterial(materialId)` — the top-precedence
  check in `lib/material-router.ts`'s `routeMaterial()`, which is what
  triggers the chat's conversational consumption-plan capture.

## Shared dependencies used

- Contracts: `@/lib/domain/contracts` (`MaterialReference`, `PlantReference`,
  `SAPDocumentReference`, `GlobalAction`, `AuditEvent`, `InitiativeSummary`,
  `Material360Signal`).
- Master data: `@/lib/shared-data/material-catalog` (`getMaterialById`,
  `REFERENCE_MATERIAL_IDS`), `@/lib/shared-data/plants` (`PLANTS`,
  `getPlantById`), `@/lib/shared-data/users` (`USERS`, `getUserById`).
- UI primitives: `PageHeader`, `KPIStatCard`, `ChartCard`, `FilterBar`,
  `StatusBadge`, `RiskBadge`, `Timeline`, `SAPDocumentChip`,
  `MaterialIdentity`, `AlertBanner`, `EmptyState` — all from
  `@/components/shared/*`. Generic primitives from `@/components/ui/*`
  (`Table*`, `Select*`, `Button`, `Dialog*`, `Input`).
- `useMaterial360` from `@/lib/material-360-context` for Material 360
  click-through.
- Formatting helpers from `@/lib/utils` (`formatZAR`, `formatZARCompact`,
  `formatCount`, `cn`).

## Integration contracts

1. **Material Router.** `@/lib/material-router.ts` (not owned by this
   module — the global shell's, alongside `lib/aggregation.ts`) calls
   `isOARMaterial(materialId)` as the first, highest-precedence check in
   `routeMaterial()`. When it's true, the chat's Material Assistant
   (`components/chat/chat-workspace.tsx`) conversationally asks for the OAR
   consumption plan itself (§5) — there is no dedicated Initiative 13 UI
   component in the chat; this module's only contribution to that
   conversation is the `isOARMaterial` boolean. Material `500-14892` (the
   material on chat session `SPR-2847`, the hero demo session) is included
   in the OAR set, so the OAR branch is visibly demonstrable on an existing
   session, not just on Initiative 13's own scenario data.
2. **Reclassification → Initiative 7.** The "Review in Initiative 7" action
   on the Reclassification page is a plain `<Link href="/inventory-optimization/recommendations?reviewMaterial=<materialId>">`
   — a mock integration event via URL navigation, never an import of an
   Initiative 7 component. `500-31005` is always present in
   `RECLASSIFICATION_CANDIDATES` so this link has a live target.
3. **Zero cross-initiative imports.** This module never imports from
   `@/features/initiative-7/**` or `@/features/initiative-8/**`, and is
   never imported by them.

## Simulated-SAP rule

No action anywhere in this module claims a real SAP write happened.
`SAPDocumentChip` renders mock document references. "Confirm Consumed",
"Re-plan", "No Longer Required", "Recommend Transfer" and the chat's
consumption-plan confirmation ("Confirm Plan", in `chat-workspace.tsx`) are
all UI-only simulations backed by local component state and a `sonner`
toast.
