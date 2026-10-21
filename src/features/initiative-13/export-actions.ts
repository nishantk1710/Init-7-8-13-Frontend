"use server"

import { getI13ActUtilisationList, getI13ReclassificationList, type WatchMetric } from "@/lib/api/i13"
import {
  attachCriticalImpactIndicator,
  type NonMoverRow,
} from "@/features/initiative-13/utils/dashboard-transforms"
import type { WatchFilters } from "@/features/initiative-13/data/live-loaders"

/**
 * The dashboard's Excel exports, as Server Actions.
 *
 * The tables show one page of 25 rows, fetched by the server. An export has to
 * cover every row the filters match, not the page on screen, so the button
 * asks the server for all of them at the moment it is pressed -- in the same
 * order the screen pages through them.
 *
 * Read-only. Nothing here writes, so nothing here revalidates.
 */

/** The route's own maximum; the OAR WATCH population is well under it. */
const EXPORT_PAGE = 5000

/** Every OAR WATCH row the filters match, most recent activity first. */
export async function exportWatchRows(filters: WatchFilters = {}): Promise<WatchMetric[]> {
  const rows: WatchMetric[] = []
  for (let offset = 0; ; offset += EXPORT_PAGE) {
    const { items, total } = await getI13ActUtilisationList({
      plant: filters.plant || undefined,
      material: filters.material || undefined,
      agingBand: filters.agingBand || undefined,
      acquiredVsPlanStatus: filters.acquiredVsPlanStatus || undefined,
      limit: EXPORT_PAGE,
      offset,
    })
    rows.push(...items)
    if (items.length < EXPORT_PAGE || (total !== null && rows.length >= total)) return rows
  }
}

/**
 * Every non-moving OAR position the filters match, with its critical-impact
 * indicator joined from the reclassification feed. An aging-band filter other
 * than NON_MOVING leaves nothing, as on screen.
 */
export async function exportNonMoverRows(filters: WatchFilters = {}): Promise<NonMoverRow[]> {
  if (filters.agingBand && filters.agingBand !== "NON_MOVING") return []
  const scope = { plant: filters.plant || undefined, material: filters.material || undefined }
  const [rows, reclassification] = await Promise.all([
    exportWatchRows({ ...filters, agingBand: "NON_MOVING" }),
    getI13ReclassificationList(scope).catch(() => null),
  ])
  return attachCriticalImpactIndicator(rows, reclassification?.items ?? [])
}
