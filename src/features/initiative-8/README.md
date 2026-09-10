# Initiative 8 — Refurbishable Spares Tracking

High-fidelity UI mockup for repair-chain visibility and duplicate-procurement
guarding on repairable spares. Deterministic mock data only — nothing in this
module makes a real SAP call; anywhere a SAP write would occur in production,
the UI says so explicitly ("Simulated", "Awaiting SAP update", "Not yet
raised").

## Ownership

Everything under `src/features/initiative-8/**` and the thin route wrappers
under `src/app/refurbishable-spares/**` belongs to this module. **No other
initiative may edit or import from files inside this folder** beyond the two
sanctioned read paths below. This module, in turn, has **zero sanctioned
imports from `@/features/initiative-7/**` or `@/features/initiative-13/**`.**

## Pages (routes)

| Route | Export | File |
|---|---|---|
| `/refurbishable-spares` | `RefurbishableSparesOverviewPage` | `pages/overview-page.tsx` |
| `/refurbishable-spares/repair-register` | `RepairRegisterPage` | `pages/repair-register-page.tsx` |
| `/refurbishable-spares/repair-register/[id]` | `RepairDetailPage({ repairId })` | `pages/repair-detail-page.tsx` |
| `/refurbishable-spares/duplicate-guard` | `DuplicateGuardPage` | `pages/duplicate-guard-page.tsx` |
| `/refurbishable-spares/declarations` | `DeclarationQueuePage` | `pages/declarations-page.tsx` |

Route wrapper files in `src/app/refurbishable-spares/**` just import and
render these — Next 16 `params` are awaited per `AGENTS.md`.

## Business entities / types (`types/repair.ts`)

- `RepairStatus` — `PR Raised → PO Issued → At Vendor → In Transit Return → Received → Closed`
- `ReceiptStatus` — `Not Yet Shipped | Awaiting Receipt | Partially Received | Received`
- `DeclarationStatus` — `Required | Pending | Completed | Flagged` (mandatory workflow,
  **kept separate from** the advisory Duplicate Guard check — never merged)
- `DeclarationCondition` — `Repairable | Beyond Economical Repair | Scrap`
- `DeclarationSource` — `Manual | MRP-generated`
- `RepairChain` — one repairable material's active/recently-closed repair chain
  (stock position, repair PR/PO, vendor, aging, cost/lead-time comparison)
- `DeclarationItem` — one row in the Declaration Queue, optionally
  cross-referencing a `RepairChain` via `relatedRepairId`

## Mock datasets (`data/`)

- `repair-chains.ts` — `REPAIR_CHAINS` (8 rows), `getRepairChainById`,
  `getRepairChainByMaterialId`, `REPAIR_VENDORS`
- `declarations.ts` — `DECLARATIONS` (6 rows), `getDeclarationById`

Seed scenarios:
- **Scenario C** — `RC-8001` / material `800-14201` (Gearbox Bearing Housing
  Assy): low SOH (1) vs ROP (4), open repair PO, 2 units at the vendor,
  return due soon. Default selection on the Duplicate Guard page.
- **Scenario D** — `D-90112` (PR-90112, material `800-18830`): MRP-generated,
  Declaration Status `Pending`, linked to `RC-8006`.
- **Initiative 7 integration** — `RC-8002` / material `500-14892` (real
  shared-catalog "Seal Assy, Mech Type XR-200"): active repair, 2 units under
  repair. See Integration Contracts below.
- Remaining rows (`RC-8003`..`RC-8008`, `D-90045`, `D-90078`, `D-90031`,
  `D-90099`, `D-90205`) spread across all 3 plants, 5 vendors, every repair
  status, every declaration status, and both aging extremes (including one
  overdue chain, `RC-8006`, and one flagged duplicate, `RC-8008`/`D-90099`).

## Components (`components/`)

Charts (Recharts, house style — `var(--border)` / `var(--muted-foreground)` /
`var(--chart-N)` CSS vars, no hardcoded hex): `repair-status-chart.tsx`,
`repairs-by-vendor-chart.tsx`, `repair-aging-chart.tsx`,
`repairable-stock-by-plant-chart.tsx`.

Page bodies: `repair-register-table.tsx` (filterable table, click-through to
Material 360 and to the detail page), `duplicate-guard-flow.tsx` (the
simulated "New Procurement Attempt" flow), `declaration-queue-table.tsx`
(table + "Declare condition" dialog, local state only).

## Public exports read by the rest of the app

- `manifest.ts` → `initiative8Manifest` (sidebar nav + AI Assistant suggested
  questions — fixed at scaffold time, hrefs unchanged)
- `selectors/summary.ts` → `getInitiative8Summary(): InitiativeSummary`
- `selectors/material-360-adapter.ts` → `getInitiative8Material360Signal(materialId): Material360Signal | null`
- `selectors/global-actions.ts` → `getInitiative8GlobalActions(): GlobalAction[]`
- `selectors/audit-events.ts` → `getInitiative8AuditEvents(): AuditEvent[]`

All four selectors are pure functions over the mock data in `data/` — no
side effects, safe to call from server components.

## Shared dependencies used

- Contracts: `@/lib/domain/contracts` (`MaterialReference`, `PlantReference`,
  `SAPDocumentReference`, `GlobalAction`, `AuditEvent`, `InitiativeSummary`,
  `Material360Signal`)
- Master data: `@/lib/shared-data/plants` (`PLANTS`), `@/lib/shared-data/material-catalog`
  (`REFERENCE_MATERIAL_IDS` for `500-14892`'s real description/manufacturer)
- Shared UI: `PageHeader`, `KPIStatCard`, `ChartCard`, `FilterBar`,
  `StatusBadge`, `Timeline`, `SAPDocumentChip`, `MaterialIdentity`,
  `AlertBanner`, `EmptyState` (all `@/components/shared/*`); `Table*`,
  `Select*`, `Button`/`buttonVariants`, `Dialog*` (`@/components/ui/*`)
- `useMaterial360()` from `@/lib/material-360-context` to open the global
  Material 360 drawer from `MaterialIdentity`
- `formatZAR`, `cn` from `@/lib/utils`; `toast` from `sonner`

`src/features/initiative-8/utils/status.ts` holds this module's own
status→tone maps and aging-bucket logic (`AGING_BUCKETS`,
`agingBucketForDays`) — local, not shared with other initiatives.

## Integration contracts

- Initiative 7's recommendation-detail page for material `500-14892` calls
  `getInitiative8Material360Signal("500-14892")` directly and expects a
  non-null signal. It resolves via `RC-8002` in `data/repair-chains.ts`
  ("At Vendor", 2 units under repair, `status: "neutral"`, repair PO
  `PO-81002`).
- This module has **no sanctioned imports** from `@/features/initiative-7/**`
  or `@/features/initiative-13/**` — integration only flows the other way
  (they may read this module's selectors; this module reads nothing of
  theirs).
- `500-14892` is the one repairable material here that's a real
  `@/lib/shared-data/material-catalog` entry. Every other repairable
  material uses synthetic `800-xxxxx` codes that intentionally don't exist
  in the shared catalog — the global Material 360 drawer's "no catalog
  record" fallback is expected and correct for those.

## Files other initiatives must not modify

This entire folder (`src/features/initiative-8/**`) and its route wrappers
(`src/app/refurbishable-spares/**`) are owned exclusively by Initiative 8.
Initiative 7 and Initiative 13 must not edit, move, or rename anything here
— the only sanctioned cross-module
touchpoints are the four selector functions and the manifest listed above,
called by fixed import path, never by reaching into this folder's internals.
