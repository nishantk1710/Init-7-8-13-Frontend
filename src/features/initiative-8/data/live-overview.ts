/**
 * The Initiative 8 overview, from the backend.
 *
 * Every KPI and chart on the overview reads one of four sources, and nothing
 * else:
 *
 *   register      `GET /api/i8/register` (via `loadLiveRegister`) — counts from
 *                 its `meta`, charts from its rows
 *   universe      `GET /api/i8/universe` — how many repairable materials exist,
 *                 and the stock they hold, by plant
 *   declarations  `GET /api/i8/declarations` — its `meta` only
 *   exceptions    `GET /api/i8/exceptions` — its `meta` only
 *
 * The register is the page: if it fails, the overview says so. The other three
 * are best-effort, and a failure shows as "could not be loaded" on the tiles
 * that needed it rather than taking the page down or, worse, as a zero.
 *
 * No vendor turnaround figure appears anywhere here. The vendor chart counts
 * open repair lines per vendor, which the register states directly; how long
 * vendors take is a derived number still under question.
 */

import { loadLiveRegister, type LiveRegister } from "@/features/initiative-8/data/live-register"
import type { RepairChain } from "@/features/initiative-8/types/repair"
import { isOpenRepair, vendorLabel } from "@/features/initiative-8/utils/status"
import type {
  ApiDeclarationMeta,
  ApiExceptionMeta,
  ApiUniverseItem,
  ApiUniverseMeta,
} from "@/lib/api/i8"
import { getDeclarations, getExceptions, getUniverse, toNumber } from "@/lib/api/i8"

/** The API caps pageSize at 500. */
const PAGE_SIZE = 500

export type PlantStock = {
  plant: string
  /** Summed over rows with a stock record. An understatement where rows have
   *  none — never padded. */
  stock: number
}

export type StockByPlant = {
  /** One bar per plant that has at least one stock record. */
  plants: PlantStock[]
  /** Material-plant rows with no stock record, which add nothing to any bar. */
  unknownRows: number
}

/** Stock on hand by plant over the repairable universe. */
export function stockByPlant(items: ApiUniverseItem[]): StockByPlant {
  const byPlant = new Map<string, number>()
  let unknownRows = 0
  for (const item of items) {
    const stock = toNumber(item.stockOnHand)
    // Unknown is not zero: counted separately, so the footnote can say how
    // much is missing rather than a bar quietly implying none.
    if (stock === undefined) {
      unknownRows += 1
      continue
    }
    const plant = item.plant?.name ?? "Unknown plant"
    byPlant.set(plant, (byPlant.get(plant) ?? 0) + stock)
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
 * vendor", never dropped: in the July extract they are the largest single
 * group, and excluding them would badly under-report the work in progress.
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
  const top = ranked.slice(0, limit)
  return {
    top,
    vendorCount: ranked.length,
    otherLines: ranked.slice(limit).reduce((sum, v) => sum + v.count, 0),
  }
}

/** Units still out on open lines. Received lines carry 0, so a plain sum. */
export function quantityUnderRepair(chains: RepairChain[]): number {
  return chains.reduce((sum, chain) => sum + chain.qtyUnderRepair, 0)
}

/**
 * The duplicate-procurement count: UNJUSTIFIED_ACQUISITION exceptions.
 *
 * `undefined` — not 0 — when the backend does not raise that type at all. A
 * zero from a check that never ran would read as "no duplicates", which is the
 * one answer this screen must never give by accident.
 */
export function unjustifiedAcquisitions(
  meta: Pick<ApiExceptionMeta, "byType" | "typesRaised">,
): number | undefined {
  if (!meta.typesRaised.includes("UNJUSTIFIED_ACQUISITION")) return undefined
  return meta.byType.UNJUSTIFIED_ACQUISITION ?? 0
}

export type LiveUniverseStock = {
  meta: ApiUniverseMeta
  stockByPlant: StockByPlant
}

/** Every universe row, first page then the rest in parallel. */
async function loadUniverseStock(): Promise<LiveUniverseStock> {
  const first = await getUniverse({ page: 1, pageSize: PAGE_SIZE })
  const pages = Math.ceil(first.total / PAGE_SIZE)
  const rest = await Promise.all(
    Array.from({ length: Math.max(0, pages - 1) }, (_, i) =>
      getUniverse({ page: i + 2, pageSize: PAGE_SIZE }),
    ),
  )
  const items = [first, ...rest].flatMap((body) => body.items)
  return { meta: first.meta, stockByPlant: stockByPlant(items) }
}

export type LiveOverview = {
  register: LiveRegister
  /** Null when that source could not be read — shown as such, never as 0. */
  universe: LiveUniverseStock | null
  declarations: ApiDeclarationMeta | null
  exceptions: ApiExceptionMeta | null
}

/** Throws only if the register fails; the rest degrade to null. */
export async function loadLiveOverview(): Promise<LiveOverview> {
  const [register, universe, declarations, exceptions] = await Promise.all([
    loadLiveRegister(),
    loadUniverseStock().catch(() => null),
    getDeclarations({ pageSize: 1 })
      .then((body) => body.meta)
      .catch(() => null),
    getExceptions({ pageSize: 1 })
      .then((body) => body.meta)
      .catch(() => null),
  ])
  return { register, universe, declarations, exceptions }
}
