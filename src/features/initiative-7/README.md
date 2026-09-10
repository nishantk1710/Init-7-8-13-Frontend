# Initiative 7 — Inventory Optimization

Criticality-aware ROP / safety-stock / max-stock recommendation workspace.
High-fidelity UI mockup — all data is deterministic mock data defined in this
folder; there are no real SAP/backend calls anywhere in this module.

## Ownership

Everything under `src/features/initiative-7/**` and the thin route wrappers
under `src/app/inventory-optimization/**` belongs to this module alone.
**No other initiative (8, 13, or the global shell beyond the sanctioned
selector/manifest contracts) should modify anything in this folder.** If a
change here seems necessary from outside, it should be raised instead of
made directly — the whole point of this architecture is that Initiative 7,
8 and 13 never depend on each other's internals and can each be deleted
independently.

## Pages (`pages/`)

| Export | Route | Purpose |
| --- | --- | --- |
| `InventoryOptimizationOverviewPage` | rendered as the "Inventory Optimization" tab on the global `/overview` (Spares Control Tower) — no standalone route | KPI row + health/exposure/status/trend charts + recent recommendations |
| `RecommendationsPage` | `/inventory-optimization/recommendations` | Filterable recommendation table workspace (wraps a client workspace in `<Suspense>` because it reads `?reviewMaterial=`) |
| `RecommendationDetailPage` | `/inventory-optimization/recommendations/[id]` | Explainability workspace: parameter comparison, why-recommended equation + factors, champion/challenger, OAR cold-start panel, interactive approval workflow |
| `InventoryMonitoringPage` | `/inventory-optimization/monitoring` | Trend-oriented charts: stockout risk trend, excess inventory opportunity trend, status distribution, circuit exposure |

The former standalone "Approval Queue" page was removed — recommendations
awaiting a decision surface in the global Action Center instead (via
`selectors/global-actions.ts`), which links straight into
`RecommendationDetailPage`'s full workflow rather than a separate quick-action
table.

Route wrapper files in `src/app/inventory-optimization/**` are thin — they
just import and render the page components above; they were not modified
beyond what the scaffolding pass already wired up.

## Business entities / types (`types/inventory.ts`)

- `Circuit` — `Crushing | Milling | Pumping | Filtration | Conveying | Flotation` (a processing-circuit concept introduced by this module, distinct from the shared `Material.category`)
- `Criticality` — `Low | Medium | High | Critical`
- `DemandPattern` — `Smooth | Erratic | Slow-Moving | Lumpy | Intermittent` (classical demand classification)
- `RecommendationStatus` — `Pending Review | In Approval | Approved | Rejected | Returned | Implemented`
- `StockParameters` — `{ rop, safetyStock, maxStock }`
- `Recommendation` — the core entity: material reference, plant, circuit, criticality, demand pattern, stockout risk, status, current/recommended `StockParameters`, lead-time mean/variance, unit price, working-capital impact, consumption history, explainability `factors`, `championChallenger` comparison, 4-step approval `workflow`, optional `oarColdStart` guidance
- Risk levels reuse the shared `RiskLevel` type from `@/components/shared/risk-badge` rather than redefining it
- Workflow steps reuse the shared `WorkflowStep`/`WorkflowStepStatus` types from `@/components/shared/workflow-stepper`

## Mock datasets (`data/`)

- `recommendations.ts` — `RECOMMENDATIONS: Recommendation[]`, 10 rows built against real shared-catalog materials (all 8 `REFERENCE_MATERIAL_IDS` plus 2 more from `MATERIALS`), spread across all 3 plants, with `getRecommendationById` / `getRecommendationsForMaterial` lookups. Includes both seed scenarios from the spec:
  - **Scenario A** (`REC-1001`, material `500-14892`): critical material, long/variable lead time, low current ROP → recommendation materially raises safety stock. This is also the material used for the Repair Context signal (see below).
  - **Scenario B** (`REC-1002`, material `500-55210`): slow-moving, expensive material with excessive Max Stock → recommendation reduces inventory and releases ~R690,900 in working capital.
  - `REC-1006` (material `500-31005`) is the row Initiative 13's `?reviewMaterial=500-31005` link lands on.
  - `REC-1009` (material `500-31048`) carries `oarColdStart` guidance and a `Returned` workflow state.
- `approval-chain.ts` — the fixed 4-step approval chain (End User → Engineering Manager → Commercial Manager → Warehouse Supervisor), approver names sourced from the shared `USERS` list, and `WorkflowStep` builder helpers.
- `audit-log.ts` — derives `AuditEvent[]` per recommendation from its `workflow` state (`buildAuditTrailForRecommendation`) and flattens all of them (`getAllInitiative7AuditEvents`) for the global Audit Trail selector.
- `monitoring-series.ts` — hand-authored monthly trend points for the stockout-risk-count and excess-inventory-ZAR-opportunity charts.

## Public exports other code relies on

- `manifest.ts` — `initiative7Manifest` (unchanged from scaffolding: nav section + suggested questions)
- `selectors/summary.ts` — `getInitiative7Summary(): InitiativeSummary`, feeds the Spares Control Tower overview cards
- `selectors/material-360-adapter.ts` — `getInitiative7Material360Signal(materialId): Material360Signal | null`, feeds the global Material 360 drawer
- `selectors/global-actions.ts` — `getInitiative7GlobalActions(): GlobalAction[]`, feeds the global Action Center
- `selectors/audit-events.ts` — `getInitiative7AuditEvents(): AuditEvent[]`, feeds the global Audit Trail

All four selectors are pure read functions over the mock data in `data/` —
no business logic lives in the selectors themselves.

## Shared dependencies used

- Types: `@/lib/domain/contracts` (`MaterialReference`, `GlobalAction`, `AuditEvent`, `InitiativeSummary`, `Material360Signal`)
- Master data: `@/lib/shared-data/material-catalog` (`MATERIALS`, `getMaterialById`, `REFERENCE_MATERIAL_IDS`), `@/lib/shared-data/plants` (`PLANTS`, `getPlantById`), `@/lib/shared-data/users` (`USERS`)
- UI primitives: `PageHeader`, `KPIStatCard`, `ChartCard`, `FilterBar`, `StatusBadge`, `RiskBadge`, `WorkflowStepper`, `Timeline`, `MaterialIdentity`, `AlertBanner`, `EmptyState` from `@/components/shared/*`; `Table*`, `Select*`, `Button`, `DropdownMenu*` from `@/components/ui/*`
- `useMaterial360()` from `@/lib/material-360-context` for Material 360 click-through
- Formatters/helpers from `@/lib/utils` (`formatZAR`, `formatZARCompact`, `formatCount`, `formatDateDMY`, `cn`)
- Recharts, following the house CSS-var chart convention (no hardcoded hex colors) — all chart components are local to `features/initiative-7/components/`, not imported from `src/components/dashboard/**`

## Integration contracts

- **`?reviewMaterial=<materialId>` query param** on `/inventory-optimization/recommendations` — read client-side via `useSearchParams()` inside `components/recommendations-workspace.tsx` (wrapped in `<Suspense>` by `pages/recommendations-page.tsx`, required for `useSearchParams` in a static build). Shows an `AlertBanner` regardless of match, and highlights/scrolls to the matching row when one exists. Initiative 13 links here with `/inventory-optimization/recommendations?reviewMaterial=500-31005`, which lands on `REC-1006`.
- **Initiative 8 read**: `components/repair-context-signal.tsx` is the single sanctioned cross-initiative import — `getInitiative8Material360Signal` from `@/features/initiative-8/selectors/material-360-adapter`, called read-only for material `500-14892` on the recommendation detail page. Renders nothing if it returns `null` (including before Initiative 8's data exists). No other Initiative 8 or Initiative 13 import exists anywhere in this module.
- **SAP simulation rule**: nothing in this module ever claims a real SAP write. `hooks/use-recommendation-workflow.ts` only ever mutates local React state; the SAP-facing badge cycles through `Awaiting Final Approval` → `Approved — Ready for SAP Update` → `SAP Update Simulated` (or `Rejected — No SAP Update`), and the "Simulate SAP Update" button and its toast are explicit about being simulated.

## Known deviations from the literal spec

- The Recommendation table merges the spec's separate "Material" and
  "Description" columns into one `MaterialIdentity` cell (which already
  shows the description), and shows current/recommended ROP, Safety Stock
  and Max Stock as paired "current → recommended" cells rather than six
  separate raw columns. This keeps the (already wide) table readable while
  preserving every data point the spec asked for.
