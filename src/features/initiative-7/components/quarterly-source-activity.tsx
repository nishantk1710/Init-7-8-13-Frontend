import { StatusBadge } from "@/components/shared/status-badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { ApiSourceActivitySection } from "@/features/initiative-7/types/api"
import {
  countOrDash,
  SOURCE_STATUS_EXPLANATION,
  SOURCE_STATUS_LABEL,
  sourceMonthLabel,
  sourceStatusTone,
} from "@/features/initiative-7/utils/source-activity"
import type { ReportKind } from "@/features/initiative-7/utils/report-period"

/**
 * Consumption by calendar month for the report's period, from the staged SAP data -- what happened in the
 * quarter, whenever I07 generated its outputs. A month the data does not cover shows dashes, not zeros; a
 * month it covers with no movement shows a confirmed 0. Quantities are not shown (the note says why);
 * transaction counts are.
 */
export function QuarterlySourceActivity({
  section,
  kind = "quarterly",
}: {
  section: ApiSourceActivitySection
  /** A monthly report covers one month, so its totals row would only repeat that month: it is left out. */
  kind?: ReportKind
}) {
  const { totals } = section
  const monthly = kind === "monthly"
  return (
    <div className="flex flex-col gap-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Month</TableHead>
            <TableHead>Source data</TableHead>
            <TableHead className="text-right">Material-plants</TableHead>
            <TableHead className="text-right">With demand</TableHead>
            <TableHead className="text-right">Issue transactions</TableHead>
            <TableHead className="text-right">Reversals</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {section.months.map((month) => (
            <TableRow key={month.month}>
              <TableCell className="font-medium">{sourceMonthLabel(month.month)}</TableCell>
              <TableCell>
                <span title={SOURCE_STATUS_EXPLANATION[month.status]}>
                  <StatusBadge tone={sourceStatusTone(month.status)}>{SOURCE_STATUS_LABEL[month.status]}</StatusBadge>
                </span>
              </TableCell>
              <TableCell className="text-right tabular-nums">{countOrDash(month.material_plants_with_movements)}</TableCell>
              <TableCell className="text-right tabular-nums">{countOrDash(month.material_plants_with_demand)}</TableCell>
              <TableCell className="text-right tabular-nums">{countOrDash(month.issue_transactions)}</TableCell>
              <TableCell className="text-right tabular-nums">{countOrDash(month.reversal_transactions)}</TableCell>
            </TableRow>
          ))}
          {!monthly && (
            <TableRow className="font-medium">
              <TableCell>Quarter</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {totals.months_available} of {section.months.length} months with data
              </TableCell>
              <TableCell className="text-right tabular-nums">{countOrDash(totals.material_plants_with_movements)}</TableCell>
              <TableCell className="text-right tabular-nums">
                {countOrDash(totals.material_plants_with_demand_in_any_month)}
              </TableCell>
              <TableCell className="text-right tabular-nums">{countOrDash(totals.issue_transactions)}</TableCell>
              <TableCell className="text-right tabular-nums">{countOrDash(totals.reversal_transactions)}</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <div className="flex flex-col gap-1 text-[11px] leading-relaxed text-muted-foreground">
        <p>
          {monthly ? (
            <>Each material-plant is counted once. &ldquo;With demand&rdquo; means issues outweighed reversals.</>
          ) : (
            <>
              Material-plants are counted once per month; the Quarter row counts each material-plant once across the
              quarter. &ldquo;With demand&rdquo; means issues outweighed reversals.
            </>
          )}
        </p>
        <p>{section.output_note}</p>
        <p>{section.quantity_note}</p>
      </div>
    </div>
  )
}
