"use client"

// One row of the "Current vs recommended stock level" table: Current (SAP) / Recommended / Change for one
// metric, with the real mean values from Section 12's baseline comparison.

import { TableCell, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { AvailabilityValue, formatDecimal } from "@/features/initiative-7/components/availability-value"
import type { ApiBaselineComparisonRow } from "@/features/initiative-7/types/api"

/** The mockup's "How the stock policy is changing" table -- Current (SAP) /
 * Recommended / Change, one row per metric, with REAL mean values (not
 * populated-counts) -- sourced from Section 12's baseline_comparison.rows,
 * the one place the report already computes the mean current value, mean
 * recommended value, and their delta/delta% over rows where both are
 * populated (see BaselineComparisonRow's own docstring on the backend: never
 * derived from two separately-scoped aggregates). A missing SAP baseline
 * (baseline_value === null, e.g. Safety Stock's confirmed 0-populated
 * current_safety_stock) renders as an explicit dash + "not set in SAP" via
 * AvailabilityValue, never a bare 0 or an invented number. */
export function StockPolicyRow({
  label,
  sublabel,
  row,
  showRecords = false,
}: {
  label: string
  sublabel: string
  row: ApiBaselineComparisonRow
  /** Adds the number of recommendations the average is over (those with both values), so a mean over a few rows is
   * never read like one over all of them. */
  showRecords?: boolean
}) {
  const currentAvailable = row.baseline_value !== null
  const recommendedAvailable = row.recommendation_value !== null
  const changeKnown = row.delta !== null

  const deltaTone = row.delta === null ? "text-muted-foreground" : Number(row.delta) >= 0 ? "text-success" : "text-destructive"

  return (
    <TableRow>
      <TableCell>
        {label} <span className="text-xs text-muted-foreground">· {sublabel}</span>
      </TableCell>
      <TableCell className="text-right">
        {currentAvailable ? (
          <span className="tabular-nums">{formatDecimal(row.baseline_value, 0)}</span>
        ) : (
          <AvailabilityValue status="NOT_AVAILABLE" size="sm" className="justify-end" />
        )}
      </TableCell>
      <TableCell className="text-right">
        {recommendedAvailable ? (
          <span className="tabular-nums">{formatDecimal(row.recommendation_value, 0)}</span>
        ) : (
          <AvailabilityValue status="NOT_AVAILABLE" size="sm" className="justify-end" />
        )}
      </TableCell>
      <TableCell className={cn("text-right tabular-nums", deltaTone)}>
        {changeKnown ? (
          <>
            {Number(row.delta) >= 0 ? "+" : ""}
            {formatDecimal(row.delta, 0)}
            {row.delta_percentage !== null && (
              <span className="ml-1">
                ({Number(row.delta_percentage) >= 0 ? "+" : ""}
                {formatDecimal(row.delta_percentage, 0)}%)
              </span>
            )}
          </>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      {showRecords && (
        <TableCell className="text-right tabular-nums text-muted-foreground">{row.both_available_count.toLocaleString("en-US")}</TableCell>
      )}
    </TableRow>
  )
}
