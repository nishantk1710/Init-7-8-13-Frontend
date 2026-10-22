import type { RepairChain, RepairStatus } from "@/features/initiative-8/types/repair"
import { ALL } from "@/features/initiative-8/utils/register-view"
import {
  NO_CRITICALITY,
  hasNoDueDate,
  isOpenRepair,
  isRepairOverdue,
  vendorLabel,
} from "@/features/initiative-8/utils/status"

/**
 * The overview dashboard's filtering and counting, as plain functions.
 *
 * Pulled out of the component for the same reason `register-view.ts` was: the
 * rules are testable without React, and the PDF is drawn from exactly the
 * slice the tiles and charts on screen were drawn from, so the file and the
 * screen can never disagree about which rows a filter matched.
 *
 * ## Why every figure is computed from rows
 *
 * The tiles used to read the register's `meta`, which the backend computes
 * over the WHOLE register. A filtered `meta` does not exist, so a dashboard
 * with filters has to count the rows itself. Doing that only while a filter is
 * active would make a number jump as the last filter was cleared, so the page
 * counts rows always.
 *
 * That is safe because the counts agree. Verified against the deployed API on
 * 12-Oct-2026, over all 5,155 register lines:
 *
 *   openLines      824 computed, 824 in meta
 *   overdueLines   820 computed, 820 in meta
 *   noDueDate        0 computed,   0 in meta
 *   qtyUnderRepair 869,000 computed, as the tile already showed
 *
 * `isOpenRepair` is the same predicate the backend's `open_lines` uses, which
 * is why they match — see its note in `status.ts`.
 */

export { ALL }

export type OverviewFilters = {
  plant: string
  /** A vendor label, or `ALL`. Narrows repair lines only — see `filterOverview`. */
  vendor: string
  /** A criticality rating, `NO_CRITICALITY` for unrated rows, or `ALL`. */
  criticality: string
}

export const NO_OVERVIEW_FILTERS: OverviewFilters = {
  plant: ALL,
  vendor: ALL,
  criticality: ALL,
}

/**
 * One repairable-universe row, trimmed to what the dashboard needs.
 *
 * The universe is 3,701 rows and the page already ships 5,155 register rows to
 * the browser; sending four fields per universe row rather than the whole
 * object keeps the filter client-side without doubling the payload.
 */
export type UniverseRow = {
  materialId: string
  plantId: string
  plantName: string
  criticality?: string
  /** Undefined where no MARD row exists — unknown, never 0. */
  stock?: number
}

export type OverviewSlice = {
  chains: RepairChain[]
  universe: UniverseRow[]
}

/**
 * The rows matching every active filter.
 *
 * Vendor is the odd one out and deliberately so: only repair lines have a
 * vendor. The repairable universe does not, so a vendor filter leaves it
 * alone — "how many repairable materials does this vendor hold" is not a
 * question the data can answer, and silently emptying the universe to zero
 * would answer it wrongly. The screen says this next to the filters.
 */
export function filterOverview(
  chains: RepairChain[],
  universe: UniverseRow[],
  filters: OverviewFilters,
): OverviewSlice {
  return {
    chains: chains.filter((c) => {
      if (filters.plant !== ALL && c.plant.plantId !== filters.plant) return false
      if (filters.vendor !== ALL && vendorLabel(c) !== filters.vendor) return false
      if (
        filters.criticality !== ALL &&
        (c.criticality ?? NO_CRITICALITY) !== filters.criticality
      ) {
        return false
      }
      return true
    }),
    universe: universe.filter((row) => {
      if (filters.plant !== ALL && row.plantId !== filters.plant) return false
      if (
        filters.criticality !== ALL &&
        (row.criticality ?? NO_CRITICALITY) !== filters.criticality
      ) {
        return false
      }
      return true
    }),
  }
}

export type PlantStock = {
  plant: string
  /** Summed over rows that have a stock record. Never padded with zeroes. */
  stock: number
}

export type StockByPlant = {
  /** One bar per plant with at least one stock record. */
  plants: PlantStock[]
  /** Rows with no stock record, which add nothing to any bar. */
  unknownRows: number
}

/** Stock on hand by plant, over whichever universe rows were handed in. */
export function stockByPlant(rows: UniverseRow[]): StockByPlant {
  const byPlant = new Map<string, number>()
  let unknownRows = 0
  for (const row of rows) {
    // Unknown is not zero: counted separately so the footnote can say how much
    // is missing, rather than a bar quietly implying none.
    if (row.stock === undefined) {
      unknownRows += 1
      continue
    }
    const plant = row.plantName || "Unknown plant"
    byPlant.set(plant, (byPlant.get(plant) ?? 0) + row.stock)
  }
  return {
    plants: [...byPlant]
      .map(([plant, stock]) => ({ plant, stock }))
      .sort((a, b) => a.plant.localeCompare(b.plant)),
    unknownRows,
  }
}

export type VendorLines = {
  /** The busiest vendors, most open lines first. */
  top: { vendor: string; count: number }[]
  /** Distinct vendors with at least one open line, including "Unknown vendor". */
  vendorCount: number
  /** Open lines held by vendors outside `top`. */
  otherLines: number
}

/**
 * Open repair lines per vendor — a count, not a turnaround.
 *
 * Lines with no PO header have no vendor and are grouped under "Unknown
 * vendor", never dropped: excluding them would under-report the work in
 * progress.
 */
export function openLinesByVendor(chains: RepairChain[], limit = 10): VendorLines {
  const byVendor = new Map<string, number>()
  for (const chain of chains) {
    if (!isOpenRepair(chain)) continue
    const vendor = vendorLabel(chain)
    byVendor.set(vendor, (byVendor.get(vendor) ?? 0) + 1)
  }
  const ranked = [...byVendor]
    .map(([vendor, count]) => ({ vendor, count }))
    .sort((a, b) => b.count - a.count || a.vendor.localeCompare(b.vendor))
  return {
    top: ranked.slice(0, limit),
    vendorCount: ranked.length,
    otherLines: ranked.slice(limit).reduce((sum, v) => sum + v.count, 0),
  }
}

/** One bar on the repair status distribution. */
export type StatusBucket = {
  label: string
  count: number
  color: string
}

/**
 * The lifecycle as the status chart draws it, in order.
 *
 * Not `REPAIR_STATUS_ORDER` — that is the five statuses the register serves,
 * and two of them cannot stand as their own bar.
 *
 * **Received and Closed are counted together.** Both mean the unit is back
 * from the vendor; the only thing separating them is SAP's delivery-complete
 * flag (EKPO.ELIKZ), and that flag carries almost no information here.
 * Measured against the deployed register on 13-Oct-2026: of 400 lines with
 * NOTHING received, 358 (90%) were already flagged delivery-complete, and the
 * corner that defines "Received" — fully back AND not flagged — held 0 of
 * 5,155 lines. A flag set on nine lines in ten regardless of receipts cannot
 * carry a lifecycle split, and an empty "Received" bar beside a full "Closed"
 * one reads as a stage nothing reaches, which is a claim about repairs rather
 * than about a flag.
 *
 * The register's own Repair Status column and filter still show all five, so
 * the distinction stays one click away wherever it does occur.
 *
 * Live, neither occurs any more: since 19-Oct-2026 the register serves only
 * lines SAP still has open, so the chart draws PO Issued and At Vendor and the
 * Received / Closed bucket drops out as empty.
 */
const STATUS_BUCKETS: { label: string; statuses: RepairStatus[]; color: string }[] = [
  { label: "PR Raised", statuses: ["PR Raised"], color: "var(--chart-4)" },
  { label: "PO Issued", statuses: ["PO Issued"], color: "var(--chart-1)" },
  { label: "At Vendor", statuses: ["At Vendor"], color: "var(--chart-2)" },
  { label: "Received / Closed", statuses: ["Received", "Closed"], color: "var(--chart-3)" },
]

/**
 * Repair lines per lifecycle bucket, empty buckets dropped.
 *
 * An empty bar is a claim that the stage is tracked and nothing reached it.
 * For `PR Raised` neither half of that is true — the register is built from PO
 * lines, so nothing produces it. It stays a bucket rather than being deleted
 * so that a requisition-stage row, if one ever arrives, draws itself.
 */
export function repairStatusBuckets(chains: RepairChain[]): StatusBucket[] {
  return STATUS_BUCKETS.map((bucket) => ({
    label: bucket.label,
    color: bucket.color,
    count: chains.filter((c) => bucket.statuses.includes(c.repairStatus)).length,
  })).filter((bucket) => bucket.count > 0)
}

export type OverviewMetrics = {
  /** Distinct materials in the filtered universe. */
  universeMaterials: number
  /** Material-plant rows in the filtered universe. */
  universeRows: number
  /** Plants represented in the filtered universe. */
  universePlants: number
  qtyUnderRepair: number
  openLines: number
  totalLines: number
  overdueLines: number
  noDueDateLines: number
  stock: StockByPlant
}

/** Every figure the tiles and charts need, from one pass over the slice. */
export function summariseOverview(slice: OverviewSlice): OverviewMetrics {
  const open = slice.chains.filter(isOpenRepair)
  return {
    universeMaterials: new Set(slice.universe.map((r) => r.materialId)).size,
    universeRows: slice.universe.length,
    // Rows whose plant the extract never carried are not a plant. Counting
    // them as one read as "3 plants" against a universe meta that says 2.
    universePlants: new Set(slice.universe.map((r) => r.plantId).filter(Boolean)).size,
    // Received lines carry 0, so summing the open ones is the same number the
    // tile has always shown — and stays right under a filter.
    qtyUnderRepair: open.reduce((sum, c) => sum + c.qtyUnderRepair, 0),
    openLines: open.length,
    totalLines: slice.chains.length,
    overdueLines: slice.chains.filter(isRepairOverdue).length,
    noDueDateLines: open.filter(hasNoDueDate).length,
    stock: stockByPlant(slice.universe),
  }
}

/**
 * The name the PDF is saved under.
 *
 * The browser's "Save as PDF" offers the page's `document.title` as the file
 * name, so the dashboard sets this as the title while the print dialog is
 * open. Dated by the figures' as-at day, which is what tells two saved copies
 * apart.
 */
export function overviewPdfTitle(referenceDate: string): string {
  return referenceDate ? `i08-overview-${referenceDate}` : "i08-overview"
}


// --- The redesigned Overview (I08_Live_UI_Redesign_Plan.md, L1) -------------

/**
 * Which configured aging band a number of days falls in: "0-15", "60+".
 *
 * The same rule as the backend's `aging_bucket` -- a negative count is day
 * zero, "60+" starts at 61 -- so a cell's count and the register lines its
 * link opens are the same lines.
 */
export function bandOf(days: number | null | undefined, bands: string[]): string | undefined {
  if (days === null || days === undefined || bands.length === 0) return undefined
  const value = Math.max(days, 0)
  for (const band of bands) {
    if (band.endsWith("+")) {
      if (value > Number(band.slice(0, -1))) return band
      continue
    }
    const [low, high] = band.split("-").map(Number)
    if (value >= low && value <= high) return band
  }
  return bands[bands.length - 1]
}

/** The lifecycle stages a repair line can be in, in order. */
export const STAGE_ORDER: RepairStatus[] = ["PR Raised", "PO Issued", "At Vendor"]

export type StageAging = {
  /** One row per stage that holds a line: how many lines sit in each band of
   *  days in that stage. A stage with no lines has no row -- an empty row
   *  would claim the stage is tracked and nothing reached it. */
  rows: { stage: RepairStatus; cells: number[] }[]
  /** Every open line, by days open (the whole repair). */
  total: number[]
  /** The largest cell, for shading. */
  max: number
}

/**
 * FR-9's aging per stage, as a table of counts rather than a bar chart: a
 * chart with one bar said less than the number, and on today's data every
 * line sits in one cell.
 */
export function stageAging(chains: RepairChain[], bands: string[]): StageAging {
  const open = chains.filter(isOpenRepair)
  const rows = STAGE_ORDER.filter((stage) => open.some((c) => c.repairStatus === stage)).map(
    (stage) => ({
      stage,
      cells: bands.map(
        (band) =>
          open.filter((c) => c.repairStatus === stage && bandOf(c.daysInCurrentStage, bands) === band)
            .length,
      ),
    }),
  )
  // The days-open band is the backend's own, so the total row and the
  // register's "days open" filter count the same lines.
  const total = bands.map((band) => open.filter((c) => c.agingBucket === band).length)
  const max = Math.max(1, ...rows.flatMap((row) => row.cells), ...total)
  return { rows, total, max }
}

export type VendorRow = {
  /** What the register's vendor filter takes: the code, or `none`. */
  code: string
  name: string
  open: number
  late: number
}

/** Open repair lines per vendor, most first, with how many are late. */
export function vendorRows(chains: RepairChain[]): VendorRow[] {
  const byVendor = new Map<string, VendorRow>()
  for (const chain of chains) {
    if (!isOpenRepair(chain)) continue
    const code = chain.vendor ?? "none"
    const row = byVendor.get(code) ?? { code, name: vendorLabel(chain), open: 0, late: 0 }
    row.open += 1
    if (isRepairOverdue(chain)) row.late += 1
    byVendor.set(code, row)
  }
  return [...byVendor.values()].sort((a, b) => b.open - a.open || a.name.localeCompare(b.name))
}

/** The open exception items raised against these lines, by type. */
export function openExceptionCounts(
  chains: RepairChain[],
  items: { repairId?: string; type: string }[],
): { total: number; missing: number; overdue: number } {
  const ids = new Set(chains.map((c) => c.id))
  const mine = items.filter((item) => item.repairId && ids.has(item.repairId))
  return {
    total: mine.length,
    missing: mine.filter((item) => item.type === "MISSING_ATTESTATION").length,
    overdue: mine.filter((item) => item.type === "OVERDUE_REPAIR").length,
  }
}
