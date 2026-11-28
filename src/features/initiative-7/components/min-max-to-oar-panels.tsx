"use client"

import { CheckCircle2, TriangleAlert } from "lucide-react"

import { cn, formatCount } from "@/lib/utils"
import type { ApiReverseReconciliation, ApiReverseSummary } from "@/features/initiative-7/types/reverse-conversion"
import { reverseCategoryLabel } from "@/features/initiative-7/utils/reverse-conversion-query"

/** One line, shown below the table, that says the numbers add up to the population that was read: the eligible
 * materials (Convert to OAR) plus the not eligible ones, which the OAR conversion filter shows. */
export function ReconciliationLine({
  summary,
  reconciliation,
}: {
  summary: ApiReverseSummary
  reconciliation: ApiReverseReconciliation
}) {
  const convert = summary.by_category.find((totals) => totals.category === "recommended_for_oar")
  const others = summary.by_category.filter((totals) => totals.category !== "recommended_for_oar")

  return (
    <p
      className={cn(
        "flex flex-wrap items-center gap-x-1.5 text-xs",
        reconciliation.reconciled ? "text-muted-foreground" : "font-medium text-destructive",
      )}
    >
      {reconciliation.reconciled ? (
        <CheckCircle2 className="size-3.5 text-success" aria-hidden="true" />
      ) : (
        <TriangleAlert className="size-3.5" aria-hidden="true" />
      )}
      <span>
        {formatCount(reconciliation.source_population)} material-plants read = {formatCount(convert?.count ?? 0)} eligible (Convert to OAR)
        {" + "}
        {formatCount(others.reduce((sum, totals) => sum + totals.count, 0))} not eligible (
        {others.map((totals) => `${formatCount(totals.count)} ${reverseCategoryLabel(totals.category)}`).join(" + ")})
        {reconciliation.excluded > 0 ? ` + ${formatCount(reconciliation.excluded)} left out (flagged for deletion, or a price not in ZAR or NAD)` : ""}
        {" · "}
        {reconciliation.reconciled ? "reconciled" : "DOES NOT RECONCILE"}
        {reconciliation.duplicate_keys > 0 ? ` (${reconciliation.duplicate_keys} duplicate material-plants)` : ""}
      </span>
    </p>
  )
}
