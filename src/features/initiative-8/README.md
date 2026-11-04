# Initiative 8 — Repairable Spares

The live UI for Initiative 08, *Refurbishable Spares Tracking Automation in
SAP*, scored against **FRS v1.2 (21-Sep-2026)**. Every screen in this module
reads the Python backend (`/api/i8/*`, plus `/api/justifications`) with no
fixture fallback. A failed request is shown as a failure, never as an empty
result. Nothing here writes to SAP, and since 3-Nov-2026 nothing here
writes at all: a condition declaration is made in the reservation assistant
only, which records it in a table the platform owns.

## Pages

Routes live in `src/app/(live)/repairable-spares/**`. Each route wrapper
imports and renders a page from `pages/`, except Repair Declarations and
Justifications, whose route files are the pages.

| Route | Page | FRS | Reads |
|---|---|---|---|
| `/repairable-spares` | `pages/overview-page.tsx` | FR-1, FR-9, FR-10 | the register, its PO lines and its PR rows kept apart, and the universe (`data/live-overview.ts`) |
| `/repairable-spares/repair-register` | `pages/repair-register-page.tsx` | FR-3, FR-4, FR-9, FR-10 | `GET /api/i8/register`, one page at a time, and `GET /api/i8/snapshot` for aging bands (`data/live-register.ts`) |
| `/repairable-spares/repair-register/[id]` | `pages/repair-detail-page.tsx` | FR-3, FR-4 | `GET /api/i8/register/{doc}/{item}` (`data/live-repair-detail.ts`); read only |
| `/repairable-spares/declarations` | route file itself | FR-4 | the declaration log, `GET /api/i8/attestations` (`data/live-declarations.ts`); a log only |
| `/repairable-spares/coding-candidates` | `pages/coding-candidates-page.tsx` | FR-2 | `GET /api/i8/coding-candidates` (`data/live-coding-candidates.ts`) |
| `/repairable-spares/justifications` | route file itself | FR-7 | `GET /api/justifications?kind=NEW_ACQUISITION`, one page at a time (`data/live-justifications.ts`) |

The navigation for these lives in `manifest.ts`. `/repairable-spares/exceptions`
redirects to the register: the exception queue was removed on 3-Nov-2026.

### Paging

The long lists draw 25 rows a page (`DEFAULT_PAGE_SIZE`, with
`components/shared/table-pagination.tsx`). Until 18-Oct-2026 the register and
the two queues drew every row, which made pages of 35 MB, 17 MB and 18 MB.

- **Paged on the server:** the Repair Register and Justifications. The
  filters and the page live in the URL
  (`?q=`, `?plant=`, `?page=` and so on), and the backend searches, filters,
  counts and pages. The dropdown values come back as `facets`, because one
  page of rows cannot supply them. The controls are in
  `components/url-filters.tsx`. Export fetches every match in batches of 500.
- **The register serves open lines only.** Since 19-Oct-2026 a repair line is
  open while SAP has it open: not "Delivery completed" (EKPO.ELIKZ), deleted
  or blocked. Goods receipts are not read. The backend leaves the rest out and
  counts them in `meta` (`excludedDeliveryCompletedLines`,
  `excludedBlockedLines`, `excludedDeletedLines`), which the caption names.
  Since 21-Oct-2026 lines on a request for quotation (EKKO.BSART `AN`) are left
  out too, as `excludedRfqLines`: an RFQ orders nothing, and SAP never closes
  one, so it used to sit in the register as open with a quantity of 0. Since
  4-Nov-2026 a line received in full whose PO SAP has not closed is left out
  as well (`excludedReceivedLines`, "received in SAP, PO not closed"): the
  unit is back on the shelf, not out for repair. A 542 now cancels the 541 it
  reverses, so a reversed dispatch no longer reads "At vendor".
- **Not paged:** the Overview, whose figures describe every line
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
- **Optional columns behind the "+".** Quantity, criticality, Repair PR and
  Repair PO are added from the "+" at the end of the header row, pinned to
  its right edge (3-Nov-2026; it was a "Columns" button above the table).
- **No queues.** The Declaration and Exception queues were folded into the
  register on 08-Oct-2026 and came back on 12-Oct. Since 3-Nov-2026 a part is
  declared in the reservation assistant when it is reserved, so the
  Declarations screen is a log and the exception queue is gone. Each register
  line still shows its declaration status, and an overdue repair says so
  under its expected date.
- **Justifications on their own screen only.** Since 3-Nov-2026 neither the
  register, its export nor the repair page shows one. The Justifications
  screen keeps the whole log, because most reasons belong to no repair line:
  FR-5 asks for one when a unit is on the shelf, or removed and not yet sent
  for repair.

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
  only" filter.
- **No vendor turnaround.** The Register's Turnaround column, the detail
  page's Turnaround figure and the Overview's Vendor turnaround card are gone.
  The figure was dispatch to goods receipt over closed repairs, and stores
  post most 541s on the day of the receipt, so it measured posting practice.

Removed on 3-Nov-2026, once the complete flow was approved:

- **No exception queue.** The Repair Exceptions page, its seven checks and its
  notification log; the register's Exceptions column, quick view, filter and
  export column; the repair page's exceptions card. The backend keeps the
  tables the queue wrote to.
- **No declaring outside the assistant.** No "Declare a part", Declare or
  Amend buttons. The assistant's form asks for quantity, fault and
  recommendation; the declarer is the signed-in requester.
- **No complete-flow switch.** `I8_COMPLETE_FLOW_ENABLED` and
  `lib/i08-features.ts` are gone, and what the switch gated is always on.
- **On the Overview:** no "Where the repairs are" vendor list (a repair PO
  names who the repair is ordered from, not where the unit is), no "Not
  declared" or "Open exceptions" card, no criticality filter (department
  instead; the register keeps criticality) and no "all open lines, days open"
  row, which repeated the PO-issued row. "PR raised, no PO" is a card, and
  the waiting table's last row is days past the expected return.
- **"Repair requested" now reads "PR raised"**, on these screens and in the
  assistant.

Changed on 4-Nov-2026, after UAT:

- **Filter lists open wider than their button** (`FILTER_LIST_CLASS` in
  `components/url-filters.tsx`), so long vendor and department names show in
  full; the button shows the whole name on hover.
- **The register has no "More filters".** Plant, vendor, stage and
  criticality sit in the top row; the quick views cover overdue and not
  declared. A filter set by a link still shows as a removable chip.
- **The declaration log lists the records in force only**, and its export
  has no "Superseded By" column: nothing can supersede a declaration now.
- **Justifications has no reason filter.**
- **Repair Candidates says when rows wait for the AI screen**: a notice on
  the page, and a badge on the menu item (`hooks/use-unscreened-candidates.ts`,
  read off the screen the page already built -- it never builds one).
- **The assistant shows repairs the same way in the chat and the request
  builder** (`components/assistant/repair-evidence.tsx`): each repair PO by
  number and item, earliest due first, with its due date, lateness and a
  labelled vendor; then the PRs raised with no PO.

## Types and helpers

- `types/repair.ts` holds the domain types. `RepairStatus` is
  `PR Raised | PO Issued | At Vendor | Received | Closed`. Live PO lines are
  `PO Issued` or `At Vendor`; `PR Raised` is a PR raised for repair with no PO
  yet (a PR row, served since 27-Oct-2026), shown as "PR raised". `Received`
  and `Closed` stay for the scenario fixtures. `DeclarationStatus` is
  `Required | Completed | Flagged | Historical`; `Flagged` means the
  declaration did *not* find the part repairable and it went for repair
  anyway, and `Historical` that the line was raised before declarations began.
- `utils/status.ts` holds the tone maps, the status orders, and the overdue
  and lead-time helpers; `utils/declaration.ts` how a declaration status reads.
- `utils/overview-view.ts` holds the Overview's filters and figures, among
  them the waiting table (`stageAging`).
- `utils/register-view.ts` holds the register's CSV export. The CSV is built
  from every line the filters match, not from the page on screen.
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

`npm test` runs the adapter and helper tests: `data/*.test.ts` and
`utils/*.test.ts`.
