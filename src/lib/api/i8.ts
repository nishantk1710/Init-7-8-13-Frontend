/**
 * Typed client for the Initiative 8 backend — `/api/i8/*`.
 *
 * **Almost read-only, and the exception is worth knowing.** Every endpoint here
 * is a GET except one: `createAttestation` POSTs to `/api/i8/attestations`,
 * which is the single write path in the whole of Initiative 8 (W5.3). It writes
 * to a table the backend owns, it is append-only, and **nothing in Initiative 8
 * writes to SAP** — the platform reads SAP and records its own findings beside
 * it. That last part is the guarantee that matters and it has not changed.
 *
 * Consumed by the overview (which also reads the exception check's counts), the
 * register, the repair detail page (which holds the attestation form) and the
 * coding-candidate screen. The Home
 * page, the action centre, the audit log and the cross-initiative selectors
 * still read the scenario fixtures in every mode.
 *
 * ## Three things to know before wiring a page to this
 *
 * **1. Dates are ISO, the fixtures are display strings.** The backend sends
 * `"2026-04-07"`; `data/repair-chains.ts` holds `"28 Jul 2026"`. Anything
 * rendering both needs a formatting step — see `formatApiDate` below.
 *
 * **2. Material and plant identifiers are real, and completely different.**
 * The fixtures use synthetic `800-14201` / `PLANT-GBG`; the backend serves
 * `8000005632` / `1300`. They do not overlap at all.
 *
 * **3. Initiative 7 depends on a fixture.** Its recommendation page calls
 * `getInitiative8Material360Signal("500-14892")` and requires a non-null
 * answer, which resolves through the `RC-8002` fixture. No such material
 * exists in the backend data. So live data has to sit *alongside* the scenario
 * fixtures rather than replace them, or that page breaks.
 *
 * Base URL comes from `NEXT_PUBLIC_API_BASE_URL` — see `client.ts`.
 */

import { apiFetch, apiPost, type ApiRequestInit } from "@/lib/api/client"

// --- Wire types -----------------------------------------------------------
//
// These mirror `app/api/i8/schemas.py` in the backend. Fields the backend
// declares as nullable are optional here, and they are nullable for reasons
// worth reading: see the comments on `RepairChain` in
// `features/initiative-8/types/repair.ts`.

export type ApiMaterialReference = {
  materialId: string
  materialCode: string
  description: string | null
}

export type ApiPlantReference = {
  plantId: string
  /** The plant's name, or its code when no name is documented for it. */
  name: string
}

export type ApiSAPDocumentReference = {
  type: "RR" | "RESERVATION" | "PR" | "PO" | "GR" | "GI"
  documentNumber: string
  line: string | null
}

/** Where a repair line stands against its promised date. Never "received":
 *  every line the register serves is open in SAP.
 *
 *  `NOT_ORDERED` (since 27-Oct-2026) is a repair requested on a PR with no PO
 *  yet: there is no promised date because nothing has been ordered. Only PR
 *  rows carry it; an older backend never sends it. */
export type ApiOverdueStatus = "ON_TIME" | "OVERDUE" | "NO_DUE_DATE" | "NOT_ORDERED"

/** What a register row is keyed on: a repair PO line, or (since 27-Oct-2026)
 *  an open repair PR with no PO yet. */
export type ApiRegisterLineKind = "PO" | "PR"

/**
 * Where a repair line stands against the material's planned delivery time.
 *
 * A SECOND, INDEPENDENT signal — not a fallback for `ApiOverdueStatus`. One
 * asks whether the line passed the date somebody promised on the PO; this asks
 * whether it has taken longer than this material normally takes. They can
 * disagree on the same row, and neither overrides the other.
 *
 * `NO_LEAD_TIME` covers both "MARC has no row for this material and plant" and
 * "PLIFZ is not maintained" — including every Gamsberg line, because the
 * planning extract omits that plant entirely.
 */
export type ApiLeadTimeStatus =
  | "WITHIN_LEAD_TIME"
  | "BEYOND_LEAD_TIME"
  | "NO_LEAD_TIME"

/**
 * One row of `GET /api/i8/register`. One material + one repair PO line that
 * SAP still has open: since 19-Oct-2026 a line marked "Delivery completed",
 * deleted or blocked is not served, and goods receipts are not read -- so no
 * row carries a receipt status, a receipt date or a turnaround.
 *
 * Since 27-Oct-2026 a row can instead be an open repair PR with no PO yet
 * (`lineKind: "PR"`), listed after every PO row when the backend's
 * `repairRequestsEnabled` rule is on. Such a row has no PO, vendor or due
 * date; it is dated from the PR (EBAN.BADAT).
 */
export type ApiRepairChain = {
  /** `{EBELN}-{EBELP}` on a PO row; `PR-{BANFN}-{BNFPO}` on a PR row. The
   *  register key as one string. */
  id: string
  /** `PO` or `PR`. Absent on an older backend, whose rows are all PO lines. */
  lineKind?: ApiRegisterLineKind
  material: ApiMaterialReference
  plant: ApiPlantReference | null

  /** Summed across storage locations. Null means no stock record, not zero. */
  stockOnHand: string | null
  /** Null for every Gamsberg material — the planning extract omits that plant. */
  reorderPoint: string | null
  qtyUnderRepair: string

  repairPr: ApiSAPDocumentReference
  repairPo: ApiSAPDocumentReference | null

  /** Null on the 455 lines whose purchase-order header is not in the extract. */
  vendor: string | null
  /** Null unless the vendor master knows this vendor — it usually does not. */
  vendorName: string | null

  /** "PO Issued", or "At Vendor" once a dispatch (the 541) is attributable;
   *  "PR Raised" on a PR row (no PO yet). */
  repairStatus: string
  overdueStatus: ApiOverdueStatus
  leadTimeStatus: ApiLeadTimeStatus
  /** `Historical`: raised before declarations began (the attestation
   *  cutover), so never required. Absent on an older backend. */
  declarationStatus: "Required" | "Completed" | "Flagged" | "Historical"

  /** Raised to today — the same number as `daysElapsed`. */
  daysOpen: number | null
  /** The band `daysOpen` falls in. */
  agingBucket: string | null

  /**
   * MARC.PLIFZ for this material at this plant — planned delivery time in
   * CALENDAR days, measured PO to received. The same field Initiative 07 uses.
   * Null on every Gamsberg line: the planning extract omits plant 1500.
   */
  leadTimeDays: number | null
  /** Raised to today. What `leadTimeStatus` is measured on. */
  daysElapsed: number | null
  /**
   * Positive once past the planned time, negative while inside it. Null when
   * there is no lead time to measure against — NOT 0, so "nobody told us how
   * long this takes" cannot average in as "finished exactly on time".
   */
  daysOverLeadTime: number | null
  daysInCurrentStage: number | null
  /** Negative once the promised date has passed. Null when there is no date. */
  daysRemainingInRepair: number | null

  /** ISO dates — `YYYY-MM-DD`, not display strings. */
  raisedAt: string | null
  poIssuedAt: string | null
  sentToVendorAt: string | null
  expectedReturn: string | null

  orderedQty: string
  unit: string | null
  /** Net order price of the repair line. Decimal, sent as a string. */
  repairCost: string | null
  newUnitLeadTimeDays: number | null

  // Provenance — how solid this row is.
  itemCategory: string | null
  docType: string | null
  /** False includes lines whose header is simply absent, which is not evidence
   *  against them. */
  corroboratedByDocType: boolean
  hasPoHeader: boolean
  scheduleLines: number

  /**
   * NORMAL, OBSOLETE, CRITICAL, IMPACT, INSURANCE — or null when ZMM065 has no
   * rating for this material. Never defaulted. Optional only until every
   * backend in use serves it.
   */
  criticality?: string | null

  // The Declaration Queue and Justifications screens, folded into the register
  // on 08-Oct-2026: what they showed per line now travels on the line. Optional
  // only until every backend in use serves them.

  /** The attestor. Null when no attestation covers the line. */
  /** The attestation covering this line, when one does — so the detail page
   *  can offer to amend it rather than only to add another. */
  declarationId?: string | null
  declaredBy?: string | null
  /** ISO timestamp of the attestation. */
  declaredAt?: string | null
  condition?: "Repairable" | "Beyond Economical Repair" | "Scrap" | null
  /** What a person should do about this line's declaration, as a sentence. */
  nextAction?: string | null
  /** The requisitioner field (AFNAM) — a CODE, not a name. On repair PRs it is
   *  a 5-digit department code (all 2,418 undeleted repair PRs carry one,
   *  measured 26-Oct-2026). */
  requester?: string | null
  /** The department's name for `requester`, when the department list knows
   *  the code. Null when it does not. Absent on an older backend. */
  requesterName?: string | null
  /** Null when no reason was recorded while the line was out AND no new
   *  purchase overlapped it without one. */
  justification?: ApiRepairJustification | null
  /**
   * What the checks raise against this line, served by the register listing so
   * a page of it need not load the whole exception queue. An empty list means
   * the checks found nothing; null or absent means not computed here -- the
   * detail endpoint, or a backend older than server paging.
   */
  exceptions?: ApiLineException[] | null
}

/** One exception raised against a register line. */
export type ApiLineException = {
  id: string
  type: string
  severity: "info" | "warning" | "critical"
}

/** One NEW_ACQUISITION justification recorded while a repair line was out. */
export type ApiRepairJustificationEntry = {
  id: string | null
  reasonCategory: string | null
  freeText: string | null
  author: string | null
  /** ISO timestamp. */
  recordedAt: string | null
  sessionId: string | null
}

/** A new unit requested or bought while the line was out, with no reason on
 *  record — the `UNJUSTIFIED_ACQUISITION` exception `exceptionId` names. */
export type ApiUnjustifiedPurchase = {
  exceptionId: string
  /** `type` `PR` for a new-buy purchase request (since 27-Oct-2026), `PO` for
   *  a PO ordered directly with no PR. An older backend always sent `PO`. */
  purchase: ApiSAPDocumentReference
  raisedAt: string | null
  /** Bought before the justification control existed — nobody was asked. */
  preAutomation: boolean
}

export type ApiRepairJustification = {
  /** MISSING whenever any overlapping purchase has no reason, even if another
   *  one does — that is the one somebody has to act on. */
  status: "RECORDED" | "MISSING"
  entries: ApiRepairJustificationEntry[]
  unjustifiedPurchases: ApiUnjustifiedPurchase[]
}

/**
 * The register's counts. Every line counted is open in SAP; the `excluded*`
 * figures say how many repair lines SAP has deleted, closed or blocked, or
 * holds on a request for quotation, each counted under the first of the four
 * that applies.
 */
export type ApiRegisterMeta = {
  totalLines: number
  /** The same number as `totalLines`: every listed line is open in SAP. */
  openLines: number
  overdueLines: number
  noDueDateLines: number
  /** The population the count below was measured over. Short of `totalLines`
   *  while the planning extract omits Gamsberg. */
  linesWithLeadTime: number
  linesBeyondLeadTime: number
  linesOnEightySeries: number
  linesWithPoHeader: number
  linesCorroboratedByDocType: number
  linesWithDispatch: number
  distinctMaterials: number
  distinctVendors: number
  vendorsResolvedToAName: number
  candidatesScanned: number
  /** PO lines deleted in SAP (EKPO.LOEKZ = 'L'). */
  excludedDeletedLines?: number
  /** Repair lines SAP has closed -- "Delivery completed", EKPO.ELIKZ --
   *  whatever was received against them. Optional until every backend in use
   *  serves it. */
  excludedDeliveryCompletedLines?: number
  /** Repair lines blocked in SAP (EKPO.LOEKZ = 'S'). */
  excludedBlockedLines?: number
  /** Item-category-3 lines on a request for quotation (EKKO.BSART = 'AN'),
   *  which orders nothing. Left out since 21-Oct-2026; optional until every
   *  backend in use serves it. */
  excludedRfqLines?: number

  // Open repair PRs with no PO yet (since 27-Oct-2026). `totalLines` and
  // `openLines` above stay PO lines only. All absent on an older backend.

  /** Open repair PR items with no PO, found whether or not the backend serves
   *  them as rows (its `repairRequestsEnabled` rule). */
  openRepairRequests?: number
  /** Repair PR items deleted in SAP, left out. */
  requisitionsExcludedDeleted?: number
  /** Repair PR items that already have a live PO line -- that line is the row. */
  requisitionsExcludedLivePo?: number
  /** Repair PR items whose repair order SAP has closed, left out. */
  requisitionsExcludedReservationClosed?: number
}

/**
 * The values the register's filters can take. Taken before every filter, so a
 * paged screen's dropdowns list every value rather than those on one page.
 */
export type ApiRegisterFacets = {
  plants: ApiPlantReference[]
  vendors: ApiVendorOption[]
  /** Some lines carry no vendor; `vendor=none` finds them. */
  hasUnknownVendor: boolean
  repairStatuses: string[]
  criticalities: string[]
  /** Some lines' material is unrated at their plant; `criticality=none` finds them. */
  hasUnrated: boolean
}

export type ApiRegisterPage = ApiPage<ApiRepairChain, ApiRegisterMeta> & {
  /** Absent from a backend older than server paging. */
  facets?: ApiRegisterFacets
  /** How many of the filtered lines each quick view holds, counted before the
   *  view applies. Absent from a backend older than the quick views. */
  viewCounts?: ApiRegisterViewCounts
}

export type ApiRegisterViewCounts = {
  all: number
  overdue: number
  undeclared: number
  atVendor: number
  withExceptions: number
  /** PR rows (repair requested, no PO yet) among the filtered lines; 0 while
   *  the backend does not serve them. Absent on an older backend. */
  notOrdered?: number
}

export type ApiUniverseItem = {
  id: string
  material: ApiMaterialReference
  plant: ApiPlantReference | null
  materialType: string | null
  stockOnHand: string | null
  storageLocations: number
  reorderPoint: string | null
  mrpType: string | null
  newUnitLeadTimeDays: number | null
  /** NORMAL, OBSOLETE, CRITICAL, IMPACT, INSURANCE — or null. Never defaulted. */
  criticality: string | null
  hasOpenRepair: boolean
  openRepairLines: number
  qtyUnderRepair: string
  /** False for roughly nine in ten of the series: the material master is a slice. */
  inMaterialMaster: boolean
}

/**
 * Distinct 80-series materials per source extract.
 *
 * Served with every universe response so no figure is ever quoted without the
 * source it came from. They differ by an order of magnitude — the material
 * master knows 362, the stock table 3,602 — which is why the universe is built
 * from a rule on the material number rather than a lookup in any one table.
 */
export type ApiUniverseSources = {
  mara: number
  mard: number
  marc: number
  ekpo: number
  zmm065: number
}

export type ApiUniverseMeta = {
  totalRows: number
  totalMaterials: number
  plants: number
  bySource: ApiUniverseSources
  withStock: number
  withReorderPoint: number
  withCriticality: number
  withOpenRepair: number
  inMaterialMaster: number
}

export type ApiPage<TItem, TMeta> = {
  items: TItem[]
  page: number
  pageSize: number
  /** Rows matching the filters, not rows on this page. */
  total: number
  meta: TMeta
  referenceDate: string
}

export type ApiLifecycleStage = {
  stage: string
  label: string
  occurredAt: string | null
  /** Which SAP artefact proves this stage, or why it cannot be proven. */
  evidence: string
  daysSince: number | null
}

export type ApiRepairDetail = {
  line: ApiRepairChain
  timeline: ApiLifecycleStage[]
}

export type ApiUniverseDetail = {
  material: ApiMaterialReference
  plants: ApiUniverseItem[]
  repairLines: ApiRepairChain[]
}

export type ApiSnapshot = {
  referenceDate: string
  builtAt: string
  buildSeconds: number
  /** When the SAP tables behind this snapshot were last loaded. Distinct from
   *  `builtAt`, which is when we last read them — the gap between the two is
   *  how stale the screen is. Optional: a backend that predates the field
   *  sends nothing, and the caller must say less rather than guess. */
  sourceLoadedAt?: string | null
  repairRegister: ApiRegisterMeta
  universe: ApiUniverseMeta
  /** The configuration actually in force, echoed back so a surprising number
   *  can be traced to a setting without reading the deployment. */
  rules: ApiSnapshotRules
}

/**
 * `GET /api/i8/snapshot`'s `rules`: an open map of settings, plus the ones the
 * screens act on. Each named key is absent on an older backend.
 *
 * The two switches are typed loosely on purpose: the backend's rules map is
 * declared as strings and integers, so a Python `True` may arrive as `1`.
 * Read them through `ruleIsOn` in `data/live-register.ts`, never by `=== true`.
 */
export type ApiSnapshotRules = Record<string, string | number | boolean> & {
  /** Whether open repair PRs with no PO yet are served as register rows. */
  repairRequestsEnabled?: boolean | number | string
  /** Whether the assistant shows its need-date line. */
  needDateAdviceEnabled?: boolean | number | string
  /** Where usable vs damaged stock comes from: `MCHB` or `MBEW`. */
  stockConditionSource?: string
  /** Conditions counted as usable, comma-separated (e.g. `NEW,REFURBISHD`). */
  usableStockConditions?: string
  /** Conditions counted as damaged, comma-separated (e.g. `DAMAGED`). */
  damagedStockConditions?: string
}

// --- W5.3: attestations, declarations and exceptions ----------------------

/** One row of `GET /api/i8/declarations`. Mirrors `DeclarationItem`. */
export type ApiDeclarationItem = {
  id: string
  /** Null where the repair line carries no requisition number. */
  pr: ApiSAPDocumentReference | null
  material: ApiMaterialReference
  plant: ApiPlantReference | null
  /**
   * EKPO's requisitioner, and a CODE rather than a name — no person directory
   * was delivered. Populated on all 1,225 repair lines, 27 distinct values.
   */
  requester: string | null
  /** The department's name for `requester`, when the department list knows
   *  it. Absent on an older backend. */
  requesterName?: string | null
  /** Which kind of repair document the row is: a repair PO line or an open
   *  repair PR line. Absent on an older backend (PO). */
  repairDocumentType?: "PO" | "PR" | null
  relatedRepairId: string
  /** The same repair line, unjoined — so the declaration form can send FR-4's
   *  link to the repair PO without splitting `relatedRepairId` on a hyphen. */
  repairPo?: ApiSAPDocumentReference | null
  /** Vendor code; null where the repair line carries no PO header. */
  vendor?: string | null
  /** LFA1's name for that vendor, where one was delivered. */
  vendorName?: string | null
  /** Where the REPAIR stands — PO Issued or At Vendor, never closed: every row
   *  is a repair SAP still has open. Not the declaration status (`status`). */
  repairStatus?: string | null
  /**
   * No "Pending": that would mean "submitted, awaiting sign-off", and the FRS
   * has no approval step — an attestation is recorded or it is not.
   */
  status: "Required" | "Completed" | "Flagged" | "Historical"
  /** The attestation covering this line, when one does. */
  declarationId?: string | null
  declaredBy: string | null
  declaredAt: string | null
  condition: "Repairable" | "Beyond Economical Repair" | "Scrap" | null
  nextAction: string
  createdAt: string | null
}

export type ApiDeclarationMeta = {
  total: number
  byStatus: Record<string, number>
  /** Required + Flagged — the rows wanting somebody's attention. */
  outstanding: number
  /** The matching rule that produced these statuses. */
  attestationWindowDays: number
}

/** One vendor the declaration queue can be narrowed to. */
export type ApiVendorOption = {
  /** The code — what the `vendor` filter takes. */
  vendor: string
  /** LFA1's name, where one was delivered. */
  name: string | null
}

/**
 * The values the declaration queue's filters can take. Taken after
 * `outstandingOnly`/`status` and before the filters themselves, so a paged
 * screen's dropdowns list every value rather than those on one page.
 */
export type ApiDeclarationFacets = {
  plants: ApiPlantReference[]
  vendors: ApiVendorOption[]
  repairStatuses: string[]
}

export type ApiDeclarationPage = ApiPage<ApiDeclarationItem, ApiDeclarationMeta> & {
  /** Absent from a backend older than server paging. */
  facets?: ApiDeclarationFacets
}

/**
 * One row of `GET /api/i8/exceptions`.
 *
 * `type` is a plain string, not a closed union. Among those raised are
 * `MISSING_ATTESTATION` (a repair line went out with no condition assessment)
 * and `UNJUSTIFIED_ACQUISITION` (a new unit was requested or bought while a
 * repair of the same material and plant was open, and nobody recorded why) — and the backend
 * declares more than it raises. A type this build has not heard of must still
 * render, so nothing may switch exhaustively over it.
 */
export type ApiExceptionItem = {
  id: string
  type: string
  severity: "info" | "warning" | "critical"
  material: ApiMaterialReference
  plant: ApiPlantReference | null
  /** The repair line. For `UNJUSTIFIED_ACQUISITION`, the repair that was open
   *  when the new unit was requested or bought: `type` `PO` for a repair PO
   *  line, `PR` (since 27-Oct-2026) for a repair PR with no PO yet. */
  repairLine: ApiSAPDocumentReference
  /**
   * The new-unit purchase, for `UNJUSTIFIED_ACQUISITION`: `type` `PR` for a
   * new-buy purchase request (the usual case since 27-Oct-2026), `PO` for a
   * PO ordered directly with no PR. An older backend always sent a PO line.
   * Null for the other types; optional until every backend in use serves it.
   */
  acquisitionLine?: ApiSAPDocumentReference | null
  title: string
  /** Says what is missing AND what was searched for. */
  detail: string
  /** The repair line's own date, not when the check ran. */
  raisedAt: string | null
  /**
   * The line predates the attestation control, so the gap is explained by when
   * it was raised rather than by anyone failing to act. Render it as a reason,
   * not a violation. Always false while no cutover date is configured, which is
   * the current state.
   */
  preAutomation: boolean
  /**
   * FR-11's workflow state. Optional on the wire until every backend in use
   * serves it: a build talking to an older API gets `undefined` and renders
   * the queue without a lifecycle rather than claiming everything is OPEN.
   */
  status?: "OPEN" | "CLOSED" | LegacyExceptionStatus
  /** Null or absent means unassigned, which is a real and common state. */
  owner?: string | null
  /** Whether a check still raises this. False only on an item fetched by id
   *  after the data moved under it. */
  stillDetected?: boolean
  history?: ApiExceptionEvent[]
}

/** Retired on 21-Oct-2026 for OPEN and CLOSED. Served only by a backend older
 *  than that; read through `toExceptionStatus`, never sent. */
export type LegacyExceptionStatus = "IN_PROGRESS" | "RESOLVED"

/** One entry in an exception's history. */
export type ApiExceptionEvent = {
  id: string
  kind: "ASSIGNED" | "COMMENT" | "STATUS" | "AUTO_RESOLVED"
  /** The status this entry set; null on a comment or an assignment. */
  status?: string | null
  /** Who the item was assigned to, on an `ASSIGNED` entry. Null there means
   *  it was unassigned — `kind` tells the two nulls apart. */
  owner?: string | null
  /** `system` on an AUTO_RESOLVED entry. */
  actor: string
  text: string
  at: string
}

export type ApiExceptionMeta = {
  total: number
  byType: Record<string, number>
  bySeverity: Record<string, number>
  linesChecked: number
  linesCovered: number
  attestationWindowDays: number
  /** Exceptions explained by predating the control rather than by a miss. */
  preAutomation: number
  /**
   * `total` less `preAutomation` — the work, where `total` is the business
   * case. Show both: quoting either alone misleads in a different direction.
   */
  actionable: number
  /** The cutover these counts were measured against. Null means none is set. */
  attestationCutoverDate: string | null
  /**
   * Which exception types the backend actually raises, so an empty count is
   * distinguishable from an unimplemented check. MISSING_SESSION_ID is
   * declared but never raised.
   */
  typesRaised: string[]
  /** New 80-series purchases the UNJUSTIFIED_ACQUISITION check looked at.
   *  Optional until every backend in use serves it. */
  acquisitionsChecked?: number
  /** How far either side of a purchase a NEW_ACQUISITION justification is
   *  searched for. */
  justificationWindowDays?: number
  /** The justification check's own cutover — purchases before it count as
   *  pre-automation. Null means none is set. */
  justificationCutoverDate?: string | null
}

/**
 * The values the exception queue's filters can take. Taken after `excludeType`
 * and before every filter, so a paged screen's dropdowns list every value
 * rather than those on one page.
 */
export type ApiExceptionFacets = {
  plants: ApiPlantReference[]
  /** Types present among the items; `meta.typesRaised` is the checks that run. */
  types: string[]
}

export type ApiExceptionPage = ApiPage<ApiExceptionItem, ApiExceptionMeta> & {
  /** Absent from a backend older than server paging. */
  facets?: ApiExceptionFacets
  /** Items per type after every filter but `type`: what each type tab holds.
   *  Unlike `meta.byType`, these follow the filters, status above all.
   *  Absent from a backend older than the redesign. */
  typeCounts?: Record<string, number> | null
}

/** One recorded attestation. */
export type ApiAttestation = {
  id: string
  material: ApiMaterialReference
  plant: ApiPlantReference
  quantity: string
  conditionDescription: string
  faultCategory: string
  recommendation: string
  /** The same judgement in DeclarationCondition wording, so the UI needs no
   *  second mapping. */
  condition: string
  serialNumber: string | null
  evidenceReference: string | null
  attestor: string
  attestedAt: string
  /** Always null. FR-8 session linkage is not in Initiative 8's scope. */
  sessionId: string | null
  supersedes: string | null
  /** Set when a later amendment replaced this one. The original is never
   *  edited or removed — this is how a reader knows it is not current. */
  supersededBy: string | null
  /** The repair line it was declared against (EKPO.EBELN / EBELP), when it
   *  was declared from one; null for "Declare a part". */
  repairDocument?: string | null
  repairItem?: string | null
  /** The name the declarer typed (not a sign-in). Absent on an older backend
   *  and on declarations recorded before it was asked for. */
  attestorName?: string | null
  /** Why this amendment was made. Absent on an older backend; null on an
   *  original declaration. */
  amendmentReason?: string | null
  /** Whether `repairDocument` names a repair PO or a repair PR. Absent on an
   *  older backend. */
  repairDocumentType?: "PO" | "PR" | null

  /**
   * Register line ids this attestation covers. **Present on POST only**, null
   * when reading history.
   *
   * Read `coverageNote` with it. An empty array is a real and expected answer:
   * the attestation's timestamp is server-set and the extract is a frozen
   * July-2026 snapshot, so a new assessment is months outside the matching
   * window of every line in the register and covers none of them.
   */
  coversRepairLines: string[] | null
  /** Why `coversRepairLines` is what it is, in words meant to be SHOWN to the
   *  person who submitted the form — not logged. Present on POST only. */
  coverageNote: string | null
}

export type ApiAttestationResponse = {
  items: ApiAttestation[]
  total: number
  /** The configured controlled list, served with the data so a form never
   *  hard-codes VZI's vocabulary. */
  faultCategories: string[]
}

/** The condition-to-repair form, as submitted.
 *
 * Note what is absent: `attestor` and `attestedAt`. Both are set by the server
 * — an audit record whose author and timestamp are the author's to choose is
 * not an audit record. Sending an `attestor` is ignored.
 */
export type AttestationRequest = {
  materialId: string
  plant: string
  quantity: number
  conditionDescription: string
  /** Must be one of `faultCategories` from `GET /api/i8/attestations`. */
  faultCategory: string
  recommendation: "REPAIRABLE" | "BEYOND_ECONOMICAL_REPAIR" | "SCRAP"
  serialNumber?: string
  /** A reference string only — file upload is descoped and SharePoint is not
   *  provisioned, so the platform does not pretend to hold the artefact. */
  evidenceReference?: string
  /** The attestation this one amends. Attestations are never edited: an
   *  amendment is a new record pointing at the one it replaces. */
  supersedes?: string
  /**
   * The repair line being declared against — `EKPO.EBELN` and `EKPO.EBELP`.
   *
   * FR-4's "link … to the repair PR or PO". Send both whenever the screen
   * knows which line it is declaring, which is every entry point except
   * "Declare a part". The backend then covers that line outright instead of
   * guessing from material + plant + a ±30-day window — a guess that matches
   * nothing on this data, because the repair lines are years old and a
   * declaration is stamped today.
   *
   * Both or neither: half a key identifies no line and is refused with a 422.
   */
  repairDocument?: string
  repairItem?: string
  /** `PR` binds to an open repair PR (`repairDocument` = the PR, `repairItem`
   *  = its item); default PO. */
  repairDocumentType?: "PO" | "PR"
  /** The declarer's typed name -- not a sign-in, and said so on the form. */
  attestorName?: string
  /** Required by the backend whenever `supersedes` is set. */
  amendmentReason?: string
}

// --- Query parameters -----------------------------------------------------

export type UniverseQuery = {
  plant?: string
  criticality?: string
  hasOpenRepair?: boolean
  /** True reproduces the 362-material material-master slice. */
  inMaterialMaster?: boolean
  search?: string
  page?: number
  pageSize?: number
}

export type RegisterQuery = {
  plant?: string
  /** A vendor code, or the literal `none` for the lines with no vendor. */
  vendor?: string
  material?: string
  status?: string
  overdueOnly?: boolean
  /** OVERDUE, ON_TIME or NO_DUE_DATE; NOT_ORDERED for repair PRs with no PO
   *  yet (a backend from 27-Oct-2026). */
  overdueStatus?: string
  /** The rating the line shows, or the literal `none` for unrated lines. */
  criticality?: string
  /** Required, Completed or Flagged. */
  declarationStatus?: string
  agingBucket?: string
  /** The aging band of the days in the line's CURRENT stage (agingBucket bands
   *  the days it has been open). What the Overview's stage-by-age cells open. */
  stageAgingBucket?: string
  /** Only lines a check has raised something against. */
  withExceptions?: boolean
  /** Comma-separated exception types left out of each line's `exceptions`
   *  and of `withExceptions`. */
  excludeExceptionType?: string
  /** A quick view on top of the filters: `overdue`, `undeclared`, `atVendor`,
   *  `withExceptions` or (a backend from 27-Oct-2026) `notOrdered`.
   *  `viewCounts` counts each before it applies. */
  view?: string
  /** Material number or description, repair line, or the PO or PR number. */
  q?: string
  page?: number
  pageSize?: number
}

function queryString(query: Record<string, unknown>): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue
    params.set(key, String(value))
  }
  const encoded = params.toString()
  return encoded ? `?${encoded}` : ""
}

// --- Endpoints ------------------------------------------------------------

/** `GET /api/i8/universe` — repairable materials, one row per material + plant. */
export function getUniverse(
  query: UniverseQuery = {},
): Promise<ApiPage<ApiUniverseItem, ApiUniverseMeta>> {
  return apiFetch(`/i8/universe${queryString(query)}`)
}

/**
 * `GET /api/i8/universe/{materialId}` — one material, its plants and its
 * repair history.
 *
 * The material number may be sent in either shape: `8000005632` or the
 * zero-padded `000000008000005632` that live SAP uses. The backend normalises
 * it. A 404 means "not a repairable 80-series material", which is a useful
 * answer in its own right — W5.5 defines a coding candidate that way.
 */
export function getUniverseMaterial(materialId: string): Promise<ApiUniverseDetail> {
  return apiFetch(`/i8/universe/${encodeURIComponent(materialId)}`)
}

/** `GET /api/i8/register` — repair lines at material + repair-PO-line grain,
 *  then (when switched on) open repair PRs with no PO yet. */
export function getRegister(query: RegisterQuery = {}): Promise<ApiRegisterPage> {
  return apiFetch(`/i8/register${queryString(query)}`)
}

/** `GET /api/i8/register/{ebeln}/{ebelp}` — one line with its lifecycle. */
export function getRepairLine(
  purchasingDocument: string,
  item: string,
): Promise<ApiRepairDetail> {
  return apiFetch(
    `/i8/register/${encodeURIComponent(purchasingDocument)}/${encodeURIComponent(item)}`,
  )
}

/**
 * `GET /api/i8/snapshot` — every headline count plus the rules that produced
 * them. The endpoint to quote in the UAT pack, because its figures are
 * reproducible rather than remembered.
 */
export function getSnapshot(): Promise<ApiSnapshot> {
  return apiFetch("/i8/snapshot")
}

export type DeclarationQuery = {
  plant?: string
  /** A vendor CODE, as `facets.vendors` lists it. */
  vendor?: string
  /** Where the repair stands — PO Issued or At Vendor. */
  repairStatus?: string
  /** Material number or description, repair line or requisition. */
  q?: string
  status?: string
  /** Only rows wanting attention — Required and Flagged. */
  outstandingOnly?: boolean
  page?: number
  pageSize?: number
}

/** `GET /api/i8/declarations` — the condition-to-repair declaration queue. */
export function getDeclarations(query: DeclarationQuery = {}): Promise<ApiDeclarationPage> {
  return apiFetch(`/i8/declarations${queryString(query)}`)
}

export type ExceptionQuery = {
  type?: string
  plant?: string
  /** One repair line, as the register keys it — `4500000677-20`. */
  repair?: string
  /** OPEN / CLOSED. */
  status?: string
  /** An owner, or the literal `unassigned`. */
  owner?: string
  /** Leave out items raised before the control existed (`preAutomation`). */
  actionableOnly?: boolean
  /**
   * Comma-separated types the queue does not carry. Unlike a filter, they come
   * off the meta counts and the facets as well as the items.
   */
  excludeType?: string
  /** Exception id, material number or description, or repair line. */
  q?: string
  page?: number
  pageSize?: number
}

/**
 * `GET /api/i8/exceptions` — repair lines that went out with no recorded
 * condition assessment, and new units bought while a repair was open with no
 * justification on record.
 *
 * Expect this to be large. Every historical repair line raises the first kind,
 * because the control did not exist before this platform — that number is the
 * business case for W5.3, not a bug in it.
 */
export function getExceptions(query: ExceptionQuery = {}): Promise<ApiExceptionPage> {
  return apiFetch(`/i8/exceptions${queryString(query)}`)
}

/**
 * `GET /api/i8/exceptions/{id}` — one item, with its status, owner and history.
 *
 * For a link to one item: the queue is paged, so the item may be on any page
 * of it, or filtered off them all. An item the checks no longer raise still
 * answers while it has a history, with `stillDetected` false; an id with
 * neither is a 404.
 */
export function getException(exceptionId: string): Promise<ApiExceptionItem> {
  return apiFetch(`/i8/exceptions/${encodeURIComponent(exceptionId)}`)
}

/**
 * `POST /api/i8/exceptions/{id}/events` — append one entry to the history.
 *
 * Writes the HISTORY, never the finding: the exception itself is recomputed
 * from SAP data on every read and has no stored form to edit. Its status and
 * owner are not columns either — they are folded from this log, which is why
 * assigning, commenting and moving are one call and there is no PATCH
 * anywhere in this application.
 *
 * `ASSIGNED` with `owner: null` is an unassignment, and gets its own entry:
 * handing something back is an action, not an absence.
 *
 * Closing needs `text`: the backend answers 422 without it, because a person
 * closing an item the check may still find has to say why. Reopening does not.
 */
export function appendExceptionEvent(
  exceptionId: string,
  body:
    | { kind: "ASSIGNED"; owner: string | null }
    | { kind: "STATUS"; status: "CLOSED"; text: string }
    | { kind: "STATUS"; status: "OPEN"; text?: string }
    | { kind: "COMMENT"; text: string },
): Promise<ApiExceptionItem> {
  return apiPost<ApiExceptionItem>(
    `/i8/exceptions/${encodeURIComponent(exceptionId)}/events`,
    body,
  )
}

/** `GET /api/i8/attestations` — recorded attestations, newest first. */
export function getAttestations(
  query: { materialId?: string; plant?: string; currentOnly?: boolean } = {},
): Promise<ApiAttestationResponse> {
  return apiFetch(`/i8/attestations${queryString(query)}`)
}

/**
 * `POST /api/i8/attestations` — **the only write in Initiative 8.**
 *
 * Writes one row to a table the backend owns. It does not write to SAP and
 * cannot, which is why this control can be recorded and reported but never
 * enforced.
 *
 * Attestations are never updated. To correct one, POST again with `supersedes`
 * set to the original's id: that creates a new row, leaves the original
 * readable, and the pair is the audit trail.
 *
 * **Read `coverageNote` on the result and show it.** A successful POST often
 * covers no repair line at all — see the field docs — and a UI that stays
 * silent about that looks broken.
 *
 * Throws `ApiError` with status 422 when a business rule is broken (an unknown
 * fault category, a `supersedes` pointing nowhere, a material that is not
 * 80-series or not in the repairable universe, a plant other than 1300/1500,
 * an out-of-range quantity); `detail` says what is allowed.
 */
export function createAttestation(body: AttestationRequest): Promise<ApiAttestation> {
  return apiFetch("/i8/attestations", {
    method: "POST",
    body: JSON.stringify(body),
  })
}

// --- W5.5: coding candidates ------------------------------------------------
//
// Advisory only (FR-2): materials whose PO free text talks about repair but
// are not 80-series coded. Nothing here writes anywhere -- the endpoint is a
// GET, same as everything except createAttestation above.

/** Which free-text field a line's words came from. FR-2 names three. */
export type CodingCandidateSource = "PO" | "PR" | "MOVEMENT"

export type ApiCodingCandidateLine = {
  /** PO (EKPO.TXZ01), PR (EBAN.TXZ01) or MOVEMENT (MSEG.SGTXT).
   *
   *  A closed union here, unlike `verdict`: these are the three fields the
   *  FRS names, not a vocabulary the backend is free to extend. */
  source: CodingCandidateSource
  /** EBELN for a PO, BANFN for a PR, MBLNR for a movement. */
  document: string
  /** EBELP, BNFPO or ZEILE -- the three number differently, which is why the
   *  source travels with them. */
  documentItem: string
  plant: ApiPlantReference | null
  /** The text the verdict was reached on -- served so a cataloguer can check
   *  the call without going back to SAP. */
  shortText: string
  matchedKeywords: string[]
  /** ERDAT on a PO line, BADAT on a requisition, BUDAT on a movement -- when
   *  the words were written, whichever document carries them. */
  raisedAt: string | null
  /** PSTYP on a PO or PR line. Always null on a movement, which has none. */
  itemCategory: string | null
}

export type ApiCodingCandidateTwin = {
  /** The 80-series material carrying the same text as this candidate. */
  materialId: string
  sharedText: string
}

/**
 * What a candidate costs new at one plant: MBEW's moving average price
 * (VERPR / PEINH, ZAR). One per plant in the candidate's `plants`.
 */
export type ApiCodingCandidatePrice = {
  plant: string
  /** Decimal string. Null whenever `missing` is set -- never "0" for unknown. */
  price: string | null
  /** "NEW" when the material is split-valuated at this plant; null when its
   *  one (unsplit) MBEW row was read. */
  valuationType: string | null
  /** Why there is no price: TOKEN_VALUE (MBEW holds a placeholder such as
   *  R1.00), NO_NEW_VALUATION (split-valuated, no NEW row) or NOT_IN_MBEW.
   *  A plain string: a reason added later must still render. */
  missing: string | null
  /** The value on the MBEW row read -- the placeholder, on TOKEN_VALUE. */
  mbewValue: string | null
}

/**
 * One material the screen judged.
 *
 * `verdict`/`confidence` are plain strings, not a closed union: the verdict
 * vocabulary is a backend implementation decision (see
 * `app/initiatives/i8/coding_candidates.py`), not an FRS-specified set, and
 * could change without a frontend deploy.
 */
export type ApiCodingCandidateItem = {
  materialId: string
  /** MISCODED_REPAIRABLE / REPAIR_SERVICE / CONSUMABLE_FOR_REPAIR / UNCLEAR /
   *  UNSCREENED. UNSCREENED means no model has answered yet -- never "not a
   *  candidate". */
  verdict: string
  /** high / medium / low, or "" when unscreened. */
  confidence: string
  /** Why, in the model's own words. */
  reason: string
  plants: string[]
  lines: ApiCodingCandidateLine[]
  distinctTexts: string[]
  twins: ApiCodingCandidateTwin[]
  /** SAP itself carries the counter-example: an 80-series material with the
   *  identical text. The strongest evidence this screen produces. */
  isCorroborated: boolean
  /** MISCODED_REPAIRABLE or UNCLEAR -- the ones a human should look at. */
  isActionable: boolean
  /** Whether the model's own confidence clears the configured threshold
   *  (`I8_CODING_CANDIDATE_CONFIDENCE_THRESHOLD`). A sibling to
   *  `isActionable`, not a replacement -- they answer different questions,
   *  and a below-threshold candidate is still served here, never dropped. */
  meetsConfidenceThreshold: boolean
  /** Expected false on every row -- true would mean this screen and the
   *  repairable universe (W5.1) disagree about the same material. */
  inRepairableUniverse: boolean
  model: string
  /** WHO answered -- "stub" means nothing was really judged. */
  provider: string
  promptVersion: number | null
  screenedAt: string | null
  /** What the part costs new, one entry per plant in `plants`. */
  newItemPrices: ApiCodingCandidatePrice[]
}

export type ApiCodingCandidateMeta = {
  /** Which free-text sources this run read. Every count below is relative to
   *  it, so two runs cannot be compared without it. */
  sources: CodingCandidateSource[]
  linesWithText: number
  linesWithTextBySource: Record<string, number>
  linesWithRepairLanguage: number
  /** Repair-language hits per source -- the number to read when deciding
   *  whether a source earns its keep. */
  linesBySource: Record<string, number>
  /** PR lines ignored because LOEKZ is set: a deleted requisition is not a
   *  request for anything. */
  deletedRequisitionsDropped: number
  /** PR lines ignored because the PO they became is in this same run. One
   *  request, counted once. */
  convertedRequisitionsDropped: number
  /** Verdicts served from the store rather than bought from the model again,
   *  because the material's text has not changed since it was judged. */
  verdictsReused: number
  linesAlreadyEightySeries: number
  linesWithoutMaterial: number
  linesScreened: number
  materialsFound: number
  materialsScreened: number
  /** True when a limit stopped the run short -- reported so a partial screen
   *  never reads as a complete one. */
  wasTruncated: boolean
  corroborated: number
  /** Material-plants by price state: PRICED, TOKEN_VALUE, NO_NEW_VALUATION,
   *  NOT_IN_MBEW. */
  newItemPriceCounts: Record<string, number>
  byVerdict: Record<string, number>
  keywords: string[]
  provider: string
  model: string
}

/** Not an `ApiPage`: this response carries no `page`/`pageSize`/`referenceDate`. */
export type ApiCodingCandidateResponse = {
  items: ApiCodingCandidateItem[]
  total: number
  meta: ApiCodingCandidateMeta
}

export type CodingCandidatesQuery = {
  /**
   * Run the language-judgement model pass. Off by default because it is one
   * model call per material -- 41 materials took 246 seconds against live
   * gpt-4o. Omitted, every verdict comes back UNSCREENED from the (instant)
   * keyword pass alone.
   */
  screen?: boolean
  /** Screen at most this many materials -- for demoing the model pass in
   *  seconds rather than minutes. */
  limit?: number
  /**
   * Which free-text sources to read, comma separated: `PO,PR,MOVEMENT`.
   * Omitted, the backend's configured default applies (PO and PR today).
   *
   * MOVEMENT is off by default because nobody has measured whether it finds
   * anything PO and PR text do not -- a 541 is already a part on its way to
   * repair, so its comments sit mostly on materials that ARE 80-series.
   */
  sources?: string
  verdict?: string
  actionableOnly?: boolean
  corroboratedOnly?: boolean
  meetsConfidenceThresholdOnly?: boolean
}

/**
 * `GET /api/i8/coding-candidates` — materials whose PO text says repair but
 * whose number does not.
 *
 * Read `meta` before `items`: it says how many lines were screened, how many
 * were dropped for carrying no material number, whether a `limit` truncated
 * the run, and which `provider` answered. `provider: "stub"` means no model
 * judged anything and every verdict is UNSCREENED.
 */
export function getCodingCandidates(
  query: CodingCandidatesQuery = {},
  init?: ApiRequestInit,
): Promise<ApiCodingCandidateResponse> {
  return apiFetch(`/i8/coding-candidates${queryString(query)}`, init)
}

/**
 * How many materials one `screen=true` call may judge.
 *
 * Measured against the deployed backend on 13-Oct-2026: about 5.5 seconds of
 * model time per material, strictly sequential. Ten is roughly a minute --
 * comfortably inside both the timeout below and Azure's own ~230-second
 * ceiling, and small enough that a failure costs one batch rather than ten
 * minutes of work.
 *
 * Nothing is re-bought when a batch is repeated: a verdict is stored against
 * the exact text it judged, so raising the limit screens only what is new.
 * That is what makes the whole pass resumable (and what a single unbounded
 * call could never be -- all 113 materials is about ten minutes, and the
 * platform would have killed it at four).
 */
export const CODING_SCREEN_BATCH = 10

/** Headroom for one batch. Well under Azure's ~230s, well over 10 x 5.5s. */
export const CODING_SCREEN_TIMEOUT_MS = 150_000

// --- Helpers --------------------------------------------------------------

/**
 * `formatApiDate` and `toNumber` now live in `lib/api/format.ts` and are
 * re-exported here unchanged.
 *
 * Neither was ever about repairs — an ISO date and a decimal-as-string cross
 * the wire identically on `/api/i13` and `/api/assistant`. They were written
 * here because this is where those problems were first met. Initiative 13's
 * client needs the same two functions, and having it import them from
 * `lib/api/i8` would make one initiative's module a dependency of another's
 * for no reason at all.
 *
 * Every existing `import { formatApiDate, toNumber } from "@/lib/api/i8"`
 * keeps working: same names, same behaviour, one implementation.
 */
export { formatApiDate, toNumber } from "@/lib/api/format"
