# Initiative 8 — Repairable Spares

The live UI for Initiative 08, *Refurbishable Spares Tracking Automation in
SAP*, scored against **FRS v1.2 (21-Sep-2026)**. Every screen in this module
reads the Python backend (`/api/i8/*`, plus `/api/justifications`) with no
fixture fallback. A failed request is shown as a failure, never as an empty
result. Nothing here writes to SAP. The one write is the condition
attestation, which goes to a table the platform owns.

## Pages

Routes live in `src/app/(live)/repairable-spares/**`. Each route wrapper
imports and renders a page from `pages/`, except Repair Declarations, Repair
Exceptions and Justifications, whose route files are the pages.

| Route | Page | FRS | Reads |
|---|---|---|---|
| `/repairable-spares` | `pages/overview-page.tsx` | FR-1, FR-10 | register, universe, declaration and exception meta (`data/live-overview.ts`) |
| `/repairable-spares/repair-register` | `pages/repair-register-page.tsx` | FR-3, FR-4, FR-7, FR-9, FR-10 | `GET /api/i8/register`, one page at a time, and `GET /api/i8/snapshot` for aging bands (`data/live-register.ts`) |
| `/repairable-spares/repair-register/[id]` | `pages/repair-detail-page.tsx` | FR-3, FR-4, FR-7 | `GET /api/i8/register/{doc}/{item}` (`data/live-repair-detail.ts`); the attestation form (`components/declare-condition-button.tsx`, `GET`/`POST /api/i8/attestations`) |
| `/repairable-spares/declarations` | route file itself | FR-4 | `GET /api/i8/declarations`, one page at a time, and the log from `GET /api/i8/attestations` (`data/live-declarations.ts`) |
| `/repairable-spares/exceptions` | route file itself | FR-8, FR-9, FR-11 | `GET /api/i8/exceptions`, one page at a time, and `GET /api/i8/exceptions/{id}` for a linked item (`data/live-exceptions.ts`) |
| `/repairable-spares/coding-candidates` | `pages/coding-candidates-page.tsx` | FR-2 | `GET /api/i8/coding-candidates` (`data/live-coding-candidates.ts`) |
| `/repairable-spares/justifications` | route file itself | FR-7 | `GET /api/justifications?kind=NEW_ACQUISITION`, one page at a time (`data/live-justifications.ts`) |

The navigation for these lives in `manifest.ts`.

### Paging

The long lists draw 25 rows a page (`DEFAULT_PAGE_SIZE`, with
`components/shared/table-pagination.tsx`). Until 18-Oct-2026 the register and
the two queues drew every row, which made pages of 35 MB, 17 MB and 18 MB.

- **Paged on the server:** the Repair Register, Repair Declarations, Repair
  Exceptions and Justifications. The filters and the page live in the URL
  (`?q=`, `?plant=`, `?page=` and so on), and the backend searches, filters,
  counts and pages. The dropdown values come back as `facets`, because one
  page of rows cannot supply them. The controls are in
  `components/url-filters.tsx`. Export fetches every match in batches of 500.
- **The register serves open lines only.** Since 19-Oct-2026 a repair line is
  open while SAP has it open: not "Delivery completed" (EKPO.ELIKZ), deleted
  or blocked. Goods receipts are not read. The backend leaves the rest out and
  counts them in `meta` (`excludedDeliveryCompletedLines`,
  `excludedBlockedLines`, `excludedDeletedLines`), which the caption names.
  Each line arrives with its exceptions, so the screen does not load the whole
  exception queue to fill one column.
- **Not paged:** the Overview, whose charts describe every line
  (`loadLiveRegister`); Repair Candidates (113 ranked rows, whose AI screen
  fills in verdicts while you watch); the declaration log (six rows); and the
  repair detail page, which has no table.

### The register is where a repair line is worked

Since 08-Oct-2026 (`docs/Initiative_08_Register_Consolidation_08Oct.md` in
the workspace):

- **Clicking a row opens the repair.** There is no View button. The material
  name opens the repair too, not the Material 360 drawer; Material 360 is on
  the detail page.
- **Columns run from what a repair is doing to reference data.** Criticality,
  SOH, ROP, Repair PR and Repair PO are last. The CSV follows the same order.
- **The queues are screens of their own again.** The Declaration and
  Exception queues were folded into the register on 08-Oct-2026 and came back
  on 12-Oct, after the FRS audit. The register tells you the state of one
  line, but FR-4, FR-8, FR-9 and FR-11 ask what is outstanding across all of
  them (see `manifest.ts`). Each register line still shows its declaration
  status and its findings, and links to both queues.
- **Justifications on the line, and on their own screen.** Each line shows
  its justification (Recorded, Missing, Not asked, or a dash), with the full
  reason on the detail page. The Justifications screen keeps the whole log,
  because most reasons belong to no repair line: FR-5 asks for one when a unit
  is on the shelf, or removed and not yet sent for repair.

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
- **No receipt-status column, new-unit cost or free-text notes.**

Removed on 19-Oct-2026, when the register moved to SAP's "Delivery completed"
flag (`I08_Delivery_Completed_Plan.md` in the workspace):

- **No closed lines, no goods receipts.** Every line is open in SAP, so there
  is no partial-receipt mark, no "Blocked in SAP" badge and no "open repairs
  only" filter on the Exceptions screen.
- **No vendor turnaround.** The Register's Turnaround column, the detail
  page's Turnaround figure and the Overview's Vendor turnaround card are gone.
  The figure was dispatch to goods receipt over closed repairs, and stores
  post most 541s on the day of the receipt, so it measured posting practice.

## Types and helpers

- `types/repair.ts` holds the domain types. `RepairStatus` is
  `PR Raised | PO Issued | At Vendor | Received | Closed`. Live lines are
  `PO Issued` or `At Vendor` only; `Received` and `Closed` stay for the
  scenario fixtures. `PR Raised` is not emitted today but stays, because FRS
  acceptance criterion 3 counts open repair PR lines. `DeclarationStatus` is
  `Required | Completed | Flagged`; `Flagged` means the attestation did *not*
  find the part repairable and it went for repair anyway.
- `utils/status.ts` holds the tone maps, the status orders, and the overdue
  and lead-time helpers.
- `utils/register-view.ts` holds the register's CSV export. The CSV is built
  from every line the filters match, not from the page on screen.
- `utils/attestation.ts` holds the attestation form's rules (conditions,
  recommendation mapping, quantity parsing).
- `lib/api/i8.ts` (outside this folder) is the typed client and wire
  shapes.

## What still reads fixtures

`data/repair-chains.ts` (RC-80xx) and `data/declarations.ts` (D-90xxx) are
hand-written scenario rows. None of the screens above read them. They feed
the four **synchronous** cross-initiative selectors:

| Selector | Read by |
|---|---|
| `selectors/live.ts` | Home's initiative card, Action Center, Approvals and the Audit Trail, composed by `lib/aggregation.ts`. Reads the backend only (snapshot, declarations, register, attestations); throws on failure so the aggregation can show one failed card. |
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
