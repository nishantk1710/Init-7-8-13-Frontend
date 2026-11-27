/**
 * Typed client for the Initiative 8 backend — `/api/i8/*`.
 *
 * **Read-only.** Every endpoint here is a GET. Until 3-Nov-2026 two wrote: a
 * declaration from an I08 screen (`POST /api/i8/attestations`) and the
 * exception queue's history. A declaration is recorded by the reservation
 * assistant now, and the exception queue was removed. **Nothing in Initiative
 * 8 writes to SAP** — the platform reads SAP and records its own findings
 * beside it.
 *
 * Consumed by the overview, the register, the repair detail page, the
 * declaration log and the coding-candidate screen. The Home
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

import { apiFetch, type ApiRequestInit } from "@/lib/api/client"

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
  /**
   * The stock at this plant in a usable condition (the backend's configured
   * usable conditions, e.g. NEW and REFURBISHD), and in a damaged one.
   * Decimal strings. Null when the condition split is not known for this
   * material; absent on a backend older than 28-Oct-2026.
   */
  usableStock?: string | null
  damagedStock?: string | null
  /** Whether the stock's condition split is known for this material at this
   *  plant. Null or absent when the backend does not say. */
  stockConditionKnown?: boolean | null
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
  /** Net order price of the repair line, in `repairCostCurrency`. Decimal, sent
   *  as a string. Null when there is no price, a zero, or a placeholder. */
  repairCost: string | null
  /** EKKO.WAERS (`ZAR`, `USD`); null when the PO has no currency. Absent from
   *  a backend older than 29-Oct-2026. */
  repairCostCurrency?: string | null
  /** The PO's net price when it is only a placeholder (R 1.00); null otherwise.
   *  Absent from a backend older than 29-Oct-2026. */
  repairCostPlaceholder?: string | null
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
  /**
   * How the covering declaration was matched to this line: it named the line
   * (`BOUND`), the R-reference typed on the repair order (`REFERENCE`), or the
   * material, plant and date window (`WINDOW`). Null when nothing covers it.
   * Absent on an older backend.
   */
  declarationLink?: "BOUND" | "REFERENCE" | "WINDOW" | null
  /** The assistant session behind the declaration that covers this line,
   *  when there is one. Absent on a backend older than 28-Oct-2026. */
  declarationSessionId?: string | null
  /** How that session is quoted: `R…/n` for a request line, the session ID
   *  for an older single-material session. Absent before 4-Nov-2026. */
  declarationSessionReference?: string | null
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
  // No `justification` or `exceptions` since 3-Nov-2026: the exception queue
  // and the register's justification cell were removed.
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
  /** Repair lines received in full (goods receipts) that SAP has not closed
   *  yet: back from the vendor, so not out for repair. Left out since
   *  4-Nov-2026; absent on an older backend. */
  excludedReceivedLines?: number

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
  /** The departments that raised the listed repairs (3-Nov-2026): a code, the
   *  `department` filter's value, and its name when the department list knows
   *  it. Absent on an older backend. */
  departments?: { value: string; name: string | null }[]
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
  /** PR rows (PR raised, no PO yet) among the filtered lines; 0 while
   *  the backend does not serve them. Absent on an older backend. */
  notOrdered?: number
}

export type ApiUniverseItem = {
  id: string
  material: ApiMaterialReference
  plant: ApiPlantReference | null
  materialType: string | null
  stockOnHand: string | null
  /** Usable and damaged stock, as on a register row. Null when the condition
   *  split is not known; absent on a backend older than 28-Oct-2026. */
  usableStock?: string | null
  damagedStock?: string | null
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
  /** The aging band of the days a line is past its expected return date
   *  (3-Nov-2026): what the Overview's "days past expected return" cells open.
   *  Only lines past their date match. */
  lateAgingBucket?: string
  /** A department code, as `facets.departments` lists it (3-Nov-2026). */
  department?: string
  /** A quick view on top of the filters: `overdue`, `undeclared`, `atVendor`
   *  or `notOrdered` (PR raised, no PO yet). `viewCounts` counts each before
   *  it applies. */
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

/** `GET /api/i8/attestations` — recorded attestations, newest first. */
export function getAttestations(
  query: { materialId?: string; plant?: string; currentOnly?: boolean } = {},
): Promise<ApiAttestationResponse> {
  return apiFetch(`/i8/attestations${queryString(query)}`)
}

/** One goods movement against a job's reservation line. Quantity as a string. */
export interface ApiJobMovement {
  postedOn: string
  quantity: string
}

/** A reservation line whose item text carries the session's R-reference. */
export interface ApiJobReservation {
  reservation: string
  item: string
  order: string | null
  material: string
  plant: string
  quantity: string
  requirementDate: string | null
  /** 261: issued to the job. */
  issued: ApiJobMovement[]
  /** 262: returned to stock -- posted on the day the repaired unit came back. */
  returned: ApiJobMovement[]
}

/** A repair PR or PO whose repair-order line carries the same R-reference. */
export interface ApiJobRepair {
  /** The register row id: `{PO}-{item}` or `PR-{BANFN}-{BNFPO}`. */
  rowId: string
  type: "PR" | "PO"
  document: string
  item: string
  status: string
}

export interface ApiSessionJob {
  sessionId: string
  reservations: ApiJobReservation[]
  repairs: ApiJobRepair[]
}

/**
 * `GET /api/i8/sessions/{sessionId}/job` -- the job behind an assistant
 * session: its reservation lines, their 261/262 movements, and the repair
 * rows linked by the same R-reference. 404 for an unknown session (or an
 * older backend without the route); empty lists when nothing is linked yet.
 */
export function getSessionJob(sessionId: string): Promise<ApiSessionJob> {
  return apiFetch(`/i8/sessions/${encodeURIComponent(sessionId)}/job`)
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
/**
 * `GET /api/i8/coding-candidates/unscreened` -- how many candidates wait for
 * the AI screen, for the menu's badge (4-Nov-2026). `unscreened` is null when
 * the backend has not built the screen since it started: it never builds one
 * to answer, so this is cheap enough to ask on every page.
 */
export function getCodingUnscreened(): Promise<{ unscreened: number | null }> {
  return apiFetch("/i8/coding-candidates/unscreened")
}

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

// --- How current the data is ----------------------------------------------

/** One source table and when it last loaded. */
export interface ApiI8SourceTable {
  table: string
  /** Null for a table that has never loaded, which is not the same as one
   *  that loaded long ago. */
  loadedAt?: string | null
}

/**
 * What `GET /i8/status` says about how current the I08 screens are.
 *
 * A separate route from `/i8/snapshot` on purpose: that one takes the snapshot
 * as a dependency and answers 503 until a build finishes, so it cannot tell a
 * screen anything during the ~90s it takes — the one moment the question is
 * worth asking.
 */
export interface ApiI8Freshness {
  referenceDate: string
  /** The OLDEST source load behind the data: everything is at least this
   *  fresh. Deliberately not the newest, which would read "updated today"
   *  while one table had been stuck for weeks. */
  loadedAt?: string | null
  /** The newest source load. Equal to `loadedAt` when everything loaded
   *  together; the gap between them is the finding. */
  newestLoadedAt?: string | null
  tables?: ApiI8SourceTable[]
  /** The newest activity the data holds — creations and postings only. Null
   *  until a snapshot has been built, because it is measured there. */
  coverageTo?: string | null
  builtAt?: string | null
  buildingSince?: string | null
}

/** How current the I08 screens are. Answers during a build too. */
export function getI8Freshness(): Promise<ApiI8Freshness> {
  return apiFetch<ApiI8Freshness>("/i8/status")
}

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
