"use client"

import type { WatchFilters } from "@/features/initiative-13/data/live-loaders"
import { ExportButton } from "@/features/initiative-13/components/export-button"
import { exportWatchRows } from "@/features/initiative-13/export-actions"
import { downloadExcel } from "@/lib/utils"

/**
 * Excel export of the full WATCH set — FR-10's "with filters and export".
 *
 * Every OAR position the current filters match, fetched when the button is
 * pressed: the dashboard itself only holds a page of 25. A client component so
 * the dashboard around it can stay a server component — `downloadExcel` builds
 * a workbook and clicks an anchor, which is browser work.
 */
export function NonMoverExport({ filters }: { filters: WatchFilters }) {
  return (
    <ExportButton
      label="Export all materials"
      onExport={async () => {
        const rows = await exportWatchRows(filters)
        downloadExcel(
          "oar-consumption-tracking.xlsx",
          [
            "Material",
            "Plant",
            "Aging band",
            "Months of cover",
            "Days since last issue",
            "Days since last movement",
            "Consumption (12m)",
            "Acquired vs plan",
          ],
          rows.map((row) => [
            row.material,
            row.plant,
            row.agingBand,
            // Empty rather than 0: no consumption means cover cannot be
            // calculated, and a 0 would read as "no cover left" — the opposite
            // of what an unconsumed part means.
            row.monthsOfCover ?? "",
            // The band's basis (SOP 3.15), then FR-6's separate figure.
            row.daysSinceLastIssue ?? "Never issued",
            row.daysSinceLastMovement ?? "",
            row.consumptionCount12m,
            row.acquiredVsPlanStatus,
          ])
        )
      }}
    />
  )
}
