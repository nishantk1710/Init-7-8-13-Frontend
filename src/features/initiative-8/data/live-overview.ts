/**
 * The Initiative 8 overview, from the backend.
 *
 * Every KPI and table on the overview reads one of two sources, and nothing
 * else:
 *
 *   register      `GET /api/i8/register` (via `loadLiveRegister`) — the rows,
 *                 which the dashboard counts itself so its filters work
 *   universe      `GET /api/i8/universe` — how many repairable materials exist,
 *                 and the stock they hold, by plant
 *
 * The register is the page: if it fails, the overview says so. The universe is
 * best-effort, and a failure shows as "could not be loaded" on its tile rather
 * than taking the page down or, worse, as a zero. (The declaration counts and
 * the exception queue were read too, for two cards removed on 3-Nov-2026.)
 *
 * No vendor turnaround since 19-Oct-2026: it was dispatch to goods receipt
 * over closed repairs, and the register serves only lines SAP still has open.
 *
 * ## Rows, not `meta`
 *
 * The dashboard filters by plant, vendor and department. The backend's `meta`
 * is computed over the whole register and cannot be narrowed,
 * so the dashboard counts the rows it is holding instead. See the note in
 * `utils/overview-view.ts` for the check that the two agree.
 *
 * ## PO lines only
 *
 * Since 27-Oct-2026 the register can also list PRs raised for repair with no
 * PO yet (PR rows). The Overview's figures about repairs that are out -- lines
 * open, units under repair, late -- are PO lines, so the PR rows are kept
 * apart here, before any figure or filter sees them: they have a card, a row
 * in the waiting table and a note of their own (`repairRequestsNote`).
 */

import {
  buildRegisterOptions,
  loadLiveRegister,
  type LiveRegister,
} from "@/features/initiative-8/data/live-register"
import { isPrOnly } from "@/features/initiative-8/utils/status"
import type { RepairChain } from "@/features/initiative-8/types/repair"
import type { UniverseRow } from "@/features/initiative-8/utils/overview-view"
import type { ApiUniverseItem, ApiUniverseMeta } from "@/lib/api/i8"
import { getUniverse, toNumber } from "@/lib/api/i8"

/** The API caps pageSize at 500. */
const PAGE_SIZE = 500

/**
 * The universe, trimmed to the four fields the dashboard filters and sums on.
 *
 * Stock stays `undefined` where the row has no MARD record: unknown is not
 * zero, and the bar chart counts those rows separately so its footnote can say
 * how much is missing.
 */
export function toUniverseRows(items: ApiUniverseItem[]): UniverseRow[] {
  return items.map((item) => ({
    materialId: item.material?.materialId ?? item.id,
    plantId: item.plant?.plantId ?? "",
    plantName: item.plant?.name ?? "Unknown plant",
    criticality: item.criticality ?? undefined,
    stock: toNumber(item.stockOnHand),
    // The condition split, when the backend sends it (28-Oct-2026).
    usable: toNumber(item.usableStock),
    damaged: toNumber(item.damagedStock),
  }))
}

export type LiveUniverse = {
  meta: ApiUniverseMeta
  rows: UniverseRow[]
}

/** Every universe row, first page then the rest in parallel. */
async function loadUniverse(): Promise<LiveUniverse> {
  const first = await getUniverse({ page: 1, pageSize: PAGE_SIZE })
  const pages = Math.ceil(first.total / PAGE_SIZE)
  const rest = await Promise.all(
    Array.from({ length: Math.max(0, pages - 1) }, (_, i) =>
      getUniverse({ page: i + 2, pageSize: PAGE_SIZE }),
    ),
  )
  const items = [first, ...rest].flatMap((body) => body.items)
  return { meta: first.meta, rows: toUniverseRows(items) }
}

export type LiveOverview = {
  /** PO lines only: see `withoutRepairRequests`. */
  register: LiveRegister
  /** The PRs raised for repair with no PO yet (PR rows), kept apart: their
   *  card, the process tile and the waiting table count them under the
   *  filters. Empty when the backend serves none. */
  requests: RepairChain[]
  /** Null when that source could not be read — shown as such, never as 0. */
  universe: LiveUniverse | null
}

/**
 * The register with its PR rows (PR raised, no PO yet) taken out, and
 * the filter choices rebuilt from what is left -- so no dropdown offers a
 * choice that only a PR row held, such as "Unknown vendor".
 *
 * `meta` is kept as it is: its `openLines` and `totalLines` are PO lines
 * already, and its `openRepairRequests` is what the page's note reads.
 */
export function withoutRepairRequests(register: LiveRegister): LiveRegister {
  const chains = register.chains.filter((chain) => !isPrOnly(chain))
  if (chains.length === register.chains.length) return register
  return { ...register, chains, ...buildRegisterOptions(chains) }
}

/** Throws only if the register fails; the universe degrades to null. */
export async function loadLiveOverview(): Promise<LiveOverview> {
  const [register, universe] = await Promise.all([loadLiveRegister(), loadUniverse().catch(() => null)])
  return {
    register: withoutRepairRequests(register),
    requests: register.chains.filter(isPrOnly),
    universe,
  }
}
