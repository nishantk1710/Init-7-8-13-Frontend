"use client"

import { Download } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { WatchMetric } from "@/lib/api/i13"
import { downloadCsv } from "@/lib/utils"

/**
 * CSV export of the full WATCH set — FR-10's "with filters and export".
 *
 * A one-button client component so the dashboard around it can stay a server
 * component: `downloadCsv` builds a blob and clicks an anchor, which is browser
 * work. Exporting the rows the page already holds means the export always
 * matches what is on screen, including the current filters.
 */
export function NonMoverExport({ rows }: { rows: WatchMetric[] }) {
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={() =>
        downloadCsv(
          "i13-utilisation.csv",
          [
            "Material",
            "Plant",
            "Aging band",
            "Months of cover",
            "Days since movement",
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
            row.daysSinceLastMovement ?? "",
            row.consumptionCount12m,
            row.acquiredVsPlanStatus,
          ])
        )
      }
    >
      <Download className="size-3.5" />
      Export full utilisation set
    </Button>
  )
}
