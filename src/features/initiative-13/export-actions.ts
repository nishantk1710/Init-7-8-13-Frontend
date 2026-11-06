"use server"

import {
  getI13ActUtilisationList,
  getI13PlanVsIssuedList,
  type PlanVsIssuedRow,
  type WatchMetric,
} from "@/lib/api/i13"
import type { PlanVsIssuedFilters, WatchFilters } from "@/features/initiative-13/data/live-loaders"

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
 * Every non-moving OAR position the filters match. An aging-band filter other
 * than NON_MOVING leaves nothing, as on screen.
 */
export async function exportNonMoverRows(filters: WatchFilters = {}): Promise<WatchMetric[]> {
  if (filters.agingBand && filters.agingBand !== "NON_MOVING") return []
  return exportWatchRows({ ...filters, agingBand: "NON_MOVING" })
}

/** Every acquired-vs-plan tab row the filters match, latest due date first. */
export async function exportPlanVsIssuedRows(filters: PlanVsIssuedFilters = {}): Promise<PlanVsIssuedRow[]> {
  const rows: PlanVsIssuedRow[] = []
  for (let offset = 0; ; offset += EXPORT_PAGE) {
    const { items, total } = await getI13PlanVsIssuedList({
      plant: filters.plant || undefined,
      material: filters.material || undefined,
      source: filters.source || undefined,
      status: filters.status || undefined,
      reservation: filters.reservation || undefined,
      overdue: filters.overdue || undefined,
      limit: EXPORT_PAGE,
      offset,
    })
    rows.push(...items)
    if (items.length < EXPORT_PAGE || (total !== null && rows.length >= total)) return rows
  }
}
