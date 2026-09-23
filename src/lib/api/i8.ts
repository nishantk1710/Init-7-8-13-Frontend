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
 * Consumed under `NEXT_PUBLIC_DATASET=live` by the register, the repair detail
 * page and the declaration queue (W5.4). Every other page, selector and
 * cross-initiative adapter still reads the scenario fixtures in every mode.
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

import { apiFetch } from "@/lib/api/client"

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

/** Where a repair line stands against its promised date. */
export type ApiOverdueStatus = "ON_TIME" | "OVERDUE" | "NO_DUE_DATE" | "RECEIVED"

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

/** One row of `GET /api/i8/register`. One material + one repair PO line. */
export type ApiRepairChain = {
  /** `{EBELN}-{EBELP}`. The register key as one string. */
  id: string
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

  repairStatus: string
  receiptStatus: string
  overdueStatus: ApiOverdueStatus
  leadTimeStatus: ApiLeadTimeStatus
  declarationStatus: "Required" | "Pending" | "Completed" | "Flagged"

  daysOpen: number | null
  agingBucket: string | null

  /**
   * MARC.PLIFZ for this material at this plant — planned delivery time in
   * CALENDAR days, measured PO to received. The same field Initiative 07 uses.
   * Null on every Gamsberg line: the planning extract omits plant 1500.
   */
  leadTimeDays: number | null
  /**
   * Raised to received, or raised to today while still out. What
   * `leadTimeStatus` is measured on — unlike `daysOpen`, it stops when the unit
   * comes back, so a repair that finished on time does not drift into breach.
   */
  daysElapsed: number | null
  /**
   * Positive once past the planned time, negative while inside it. Null when
   * there is no lead time to measure against — NOT 0, so "nobody told us how
   * long this takes" cannot average in as "finished exactly on time".
   */
  daysOverLeadTime: number | null
  /** Only computable for completed repairs in the current extract. */
  daysAtVendor: number | null
  daysInCurrentStage: number | null
  /** Negative once the promised date has passed. Null when there is no date. */
  daysRemainingInRepair: number | null

  /** ISO dates — `YYYY-MM-DD`, not display strings. */
  raisedAt: string | null
  poIssuedAt: string | null
  sentToVendorAt: string | null
  expectedReturn: string | null
  receivedAt: string | null

  orderedQty: string
  receivedQty: string
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
  /** SAP's delivery-complete flag. Reported, not trusted: it is set on 1,025
   *  lines of which only 436 have any goods receipt. */
  deliveryCompleted: boolean
  reversals: number
  scheduleLines: number
}

export type ApiRegisterMeta = {
  totalLines: number
  openLines: number
  receivedLines: number
  overdueLines: number
  noDueDateLines: number
  linesWithoutDueDate: number
  /** The population the two counts below were measured over. Short of
   *  `totalLines` while the planning extract omits Gamsberg. */
  linesWithLeadTime: number
  linesBeyondLeadTime: number
  /** The actionable half: still out, and already past the planned time. */
  openLinesBeyondLeadTime: number
  partiallyReceivedLines: number
  linesWithReversals: number
  linesOnEightySeries: number
  linesWithPoHeader: number
  linesCorroboratedByDocType: number
  linesWithDispatch: number
  /** Measured at zero: no open repair has a dispatch movement on record. */
  openLinesWithDispatch: number
  distinctMaterials: number
  distinctVendors: number
  vendorsResolvedToAName: number
  candidatesScanned: number
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

export type ApiVendorTurnaround = {
  vendor: string
  vendorName: string | null
  totalLines: number
  openCount: number
  overdueCount: number
  receivedCount: number
  /** Over COMPLETED repairs only. Null when none has both ends of the clock. */
  avgTurnaroundDays: number | null
  minTurnaroundDays: number | null
  maxTurnaroundDays: number | null
  /** How many repairs the average came from. A mean of one is not a record. */
  turnaroundSample: number
  onTimeRate: number | null
  avgDaysOpen: number | null
}

export type ApiVendorResponse = {
  items: ApiVendorTurnaround[]
  total: number
  referenceDate: string
  note: string
}

export type ApiSnapshot = {
  referenceDate: string
  builtAt: string
  buildSeconds: number
  repairRegister: ApiRegisterMeta
  universe: ApiUniverseMeta
  /** The configuration actually in force, echoed back so a surprising number
   *  can be traced to a setting without reading the deployment. */
  rules: Record<string, string | number>
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
  /**
   * **Null on every row, and that is the honest answer.**
   *
   * The SAP table that would decide Manual vs MRP-generated covers 521 of the
   * 1,201 repair requisitions, and every one of those 521 reads "created from
   * an order" — which is neither. Both labels are false for every row we can
   * see and unknown for the rest, so neither is sent.
   */
  source: "Manual" | "MRP-generated" | null
  hasActiveRepair: boolean
  relatedRepairId: string
  /**
   * "Pending" is never sent: it means "submitted, awaiting sign-off" and no
   * such state exists — there is no approval workflow in SAP or in the backend.
   */
  status: "Required" | "Pending" | "Completed" | "Flagged"
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

/** One row of `GET /api/i8/exceptions`. No frontend type existed before this. */
export type ApiExceptionItem = {
  id: string
  type: string
  severity: "info" | "warning" | "critical"
  material: ApiMaterialReference
  plant: ApiPlantReference | null
  repairLine: ApiSAPDocumentReference
  title: string
  /** Says what is missing AND what was searched for. */
  detail: string
  /** The repair line's own date, not when the check ran. */
  raisedAt: string | null
  isOpenRepair: boolean
  /**
   * The line predates the attestation control, so the gap is explained by when
   * it was raised rather than by anyone failing to act. Render it as a reason,
   * not a violation. Always false while no cutover date is configured, which is
   * the current state.
   */
  preAutomation: boolean
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
   * Which exception types the backend actually raises. MISSING_SESSION_ID and
   * UNJUSTIFIED_ACQUISITION are declared but never raised, so an empty count is
   * distinguishable from an unimplemented check.
   */
  typesRaised: string[]
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
  vendor?: string
  material?: string
  status?: string
  overdueOnly?: boolean
  openOnly?: boolean
  criticality?: string
  agingBucket?: string
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

/** `GET /api/i8/register` — repair lines at material + repair-PO-line grain. */
export function getRegister(
  query: RegisterQuery = {},
): Promise<ApiPage<ApiRepairChain, ApiRegisterMeta>> {
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

/** `GET /api/i8/vendors/turnaround` — vendor analytics over completed repairs. */
export function getVendorTurnaround(): Promise<ApiVendorResponse> {
  return apiFetch("/i8/vendors/turnaround")
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
  status?: string
  /** Only rows wanting attention — Required and Flagged. */
  outstandingOnly?: boolean
  page?: number
  pageSize?: number
}

/** `GET /api/i8/declarations` — the condition-to-repair declaration queue. */
export function getDeclarations(
  query: DeclarationQuery = {},
): Promise<ApiPage<ApiDeclarationItem, ApiDeclarationMeta>> {
  return apiFetch(`/i8/declarations${queryString(query)}`)
}

export type ExceptionQuery = {
  type?: string
  plant?: string
  /** Only exceptions on repairs still out at a vendor — the actionable ones. */
  openOnly?: boolean
  page?: number
  pageSize?: number
}

/**
 * `GET /api/i8/exceptions` — repair lines that went out with no recorded
 * condition assessment.
 *
 * Expect this to be large. Every historical repair line raises it, because the
 * control did not exist before this platform — that number is the business case
 * for W5.3, not a bug in it.
 */
export function getExceptions(
  query: ExceptionQuery = {},
): Promise<ApiPage<ApiExceptionItem, ApiExceptionMeta>> {
  return apiFetch(`/i8/exceptions${queryString(query)}`)
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
 * fault category, a `supersedes` pointing nowhere); `detail` says what is
 * allowed.
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

export type ApiCodingCandidateLine = {
  purchasingDocument: string
  item: string
  plant: ApiPlantReference | null
  /** The text the verdict was reached on -- served so a cataloguer can check
   *  the call without going back to SAP. */
  shortText: string
  matchedKeywords: string[]
  raisedAt: string | null
  itemCategory: string | null
}

export type ApiCodingCandidateTwin = {
  /** The 80-series material carrying the same text as this candidate. */
  materialId: string
  sharedText: string
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
}

export type ApiCodingCandidateMeta = {
  linesWithText: number
  linesWithRepairLanguage: number
  linesAlreadyEightySeries: number
  linesWithoutMaterial: number
  linesScreened: number
  materialsFound: number
  materialsScreened: number
  /** True when a limit stopped the run short -- reported so a partial screen
   *  never reads as a complete one. */
  wasTruncated: boolean
  corroborated: number
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
): Promise<ApiCodingCandidateResponse> {
  return apiFetch(`/i8/coding-candidates${queryString(query)}`)
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
