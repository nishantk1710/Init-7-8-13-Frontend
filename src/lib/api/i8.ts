/**
 * Typed client for the Initiative 8 backend — `GET /api/i8/*`.
 *
 * Read-only. Every endpoint here is a GET, because W5.1 and W5.2 are read
 * models: there is no write path to SAP or to the backend's database anywhere
 * in Initiative 8 yet. The first one will be W5.3's attestation.
 *
 * Nothing in the UI calls this yet. The pages still render the scenario
 * fixtures in `features/initiative-8/data/`, and swapping them over is W5.4's
 * work. This exists so that when the swap happens the wire shape is already
 * described in one place and typed — rather than each page inventing its own
 * `fetch` and its own idea of what comes back.
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
  declarationStatus: "Required" | "Pending" | "Completed" | "Flagged"

  daysOpen: number | null
  agingBucket: string | null
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

// --- Helpers --------------------------------------------------------------

/**
 * An ISO date from the API as the display string the UI uses elsewhere.
 *
 * The scenario fixtures hold `"28 Jul 2026"` and the API sends `"2026-07-28"`,
 * so anything showing both needs this. Returns the placeholder for null, never
 * "Invalid Date" and never today's date.
 */
export function formatApiDate(iso: string | null | undefined, fallback = "—"): string {
  if (!iso) return fallback
  const parsed = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return fallback
  return parsed.toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })
}

/**
 * A decimal the API sent as a string, as a number — or undefined.
 *
 * Decimals cross the wire as strings so that quantities and prices do not lose
 * precision in JSON. `undefined` is preserved rather than coerced to 0: for
 * stock on hand and reorder point the difference between "unknown" and "zero"
 * is the whole point.
 */
export function toNumber(value: string | null | undefined): number | undefined {
  if (value === null || value === undefined || value === "") return undefined
  const parsed = Number(value)
  return Number.isNaN(parsed) ? undefined : parsed
}
