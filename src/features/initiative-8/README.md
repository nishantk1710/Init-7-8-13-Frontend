# Initiative 8 — Repairable Spares

The live UI for Initiative 08, *Refurbishable Spares Tracking Automation in
SAP*, scored against **FRS v1.2 (21-Sep-2026)**. Every screen in this module
reads the Python backend (`/api/i8/*`, plus `/api/justifications`) with no
fixture fallback. A failed request is shown as a failure, never as an empty
result. Nothing here writes to SAP. The one write is the condition
attestation, which goes to a table the platform owns.

## Pages

Routes live in `src/app/(live)/repairable-spares/**`. Each route wrapper
imports and renders a page from `pages/`, except Justifications, whose route
file is the page.

| Route | Page | FRS | Reads |
|---|---|---|---|
| `/repairable-spares` | `pages/overview-page.tsx` | FR-1, FR-10 | register, universe, declaration and exception meta (`data/live-overview.ts`) |
| `/repairable-spares/repair-register` | `pages/repair-register-page.tsx` | FR-3, FR-4, FR-7, FR-9, FR-10 | `GET /api/i8/register`, `GET /api/i8/snapshot` for aging bands (`data/live-register.ts`) |
| `/repairable-spares/repair-register/[id]` | `pages/repair-detail-page.tsx` | FR-3, FR-4, FR-7 | `GET /api/i8/register/{doc}/{item}` (`data/live-repair-detail.ts`); the attestation form (`components/declare-condition-button.tsx`, `GET`/`POST /api/i8/attestations`) |
| `/repairable-spares/coding-candidates` | `pages/coding-candidates-page.tsx` | FR-2 | `GET /api/i8/coding-candidates` (`data/live-coding-candidates.ts`) |
| `/repairable-spares/justifications` | route file itself | FR-7 | `GET /api/justifications?kind=NEW_ACQUISITION`, rendered with Initiative 13's `JustificationLog` |

The navigation for these five lives in `manifest.ts`.

### The register is where a repair line is worked

Since 08-Oct-2026 (`docs/Initiative_08_Register_Consolidation_08Oct.md` in
the workspace):

- **Clicking a row opens the repair.** There is no View button. The material
  name opens the repair too, not the Material 360 drawer; Material 360 is on
  the detail page.
- **Columns run from what a repair is doing to reference data.** Criticality,
  SOH, ROP, Repair PR and Repair PO are last. "Blocked in SAP" sits under
  Repair Status so it stays on screen. The CSV follows the same order.
- **No Declaration Queue.** It was the register's own lines with other
  columns. Each line shows its declaration status and who declared it; the
  condition, requester, next action and the **Declare condition** form are on
  the detail page. `/repairable-spares/declarations` redirects to the register.
- **Justifications on the line, and on their own screen.** Each line shows
  its justification (Recorded, Missing, Not asked, or a dash), with the full
  reason on the detail page. The Justifications screen keeps the whole log,
  because most reasons belong to no repair line: FR-5 asks for one when a unit
  is on the shelf, or removed and not yet sent for repair.
- **No Exception Queue.** Declaration and justification are treated as
  mandatory, so the queue screen was removed. The checks still run on the
  backend: they decide the register's Missing justification value, and the
  Overview's Unjustified new purchases tile counts them through
  `GET /api/i8/exceptions`.
  Each line shows its own findings in the register (Declaration Status
  Required, Justification Missing, Due Date Status Overdue).
  `/repairable-spares/exceptions` redirects to the register. The FRS still
  names an exception queue (FR-8, FR-9, FR-11); that gap is recorded in the
  consolidation doc.

### What is deliberately not here

These were removed in the 07-Oct-2026 discard review
(`docs/Initiative_08_Discard_Review_07Oct.md` in the workspace) because the
FRS does not require them:

- **No Duplicate Guard page.** FR-6 is a rule the Spares Assistant runs at
  reservation time (FR-5b). There, the answer comes with a session id and a
  justification prompt. A standalone lookup gave the same answer with
  neither. The backend rule (`repairable_unit.assess`) and its endpoint
  remain.
- **No declaration `source` (Manual / MRP-generated).** It is not in FR-4,
  and SAP cannot answer it.
- **No `Pending` declaration status.** The FRS has no approval step: an
  attestation is recorded or it is not.
- **No `In Transit Return` repair status.** It is not an FRS stage, and
  nothing in the data can show it.
- **No receipt-status column, new-unit cost or free-text notes.** A partial
  receipt is shown as a mark on the repair status, which is the only thing
  the receipt status added.

## Types and helpers

- `types/repair.ts` holds the domain types. `RepairStatus` is
  `PR Raised | PO Issued | At Vendor | Received | Closed`. `PR Raised` is not
  emitted today but stays, because FRS acceptance criterion 3 counts open
  repair PR lines. `DeclarationStatus` is `Required | Completed | Flagged`;
  `Flagged` means the attestation did *not* find the part repairable and it
  went for repair anyway.
- `utils/status.ts` holds the tone maps, the status orders, the overdue and
  lead-time helpers, and `isPartiallyReceived`.
- `utils/register-view.ts` holds the register filters and CSV export. The
  CSV is built from exactly the rows on screen.
- `utils/attestation.ts` holds the attestation form's rules (conditions,
  recommendation mapping, quantity parsing).
- `lib/api/i8.ts` (outside this folder) is the typed client and wire
  shapes.

## What still reads fixtures

`data/repair-chains.ts` (RC-80xx) and `data/declarations.ts` (D-90xxx) are
hand-written scenario rows. None of the five screens read them. They feed
the four **synchronous** cross-initiative selectors:

| Selector | Read by |
|---|---|
| `selectors/summary.ts` | Home's initiative card (`lib/aggregation.ts`) |
| `selectors/global-actions.ts` | Action Center, Approvals, Home |
| `selectors/audit-events.ts` | Audit Trail, Home |
| `selectors/material-360-adapter.ts` | Material 360 drawer, `lib/material-router.ts`, Initiative 7's `repair-context-signal.tsx` (material `500-14892` via `RC-8002`) |

`lib/material-router.ts` and `lib/material-name-lookup.ts` also read
`data/repair-chains.ts` directly.

Retiring these is a cross-initiative change. Initiative 7's recommendation
page reads `RC-8002`, and the selectors are synchronous while an API call is
not. It waits on agreement with the Initiative 7 owner (discard review
§2.8). Until then, keep the selector signatures stable.

## Tests

`npm test` runs the adapter and helper tests: `data/*.test.ts`,
`utils/status.test.ts` and `utils/attestation.test.ts`.
