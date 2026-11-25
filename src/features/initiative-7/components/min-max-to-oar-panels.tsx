"use client"

import { CheckCircle2, TriangleAlert } from "lucide-react"

import { cn, formatCount } from "@/lib/utils"
import type {
  ApiReverseAnchor,
  ApiReversePolicy,
  ApiReverseReconciliation,
  ApiReverseSummary,
} from "@/features/initiative-7/types/reverse-conversion"
import {
  describeAnchor,
  describePolicy,
  formatLoadedAt,
  formatYearMonth,
  reverseCategoryLabel,
} from "@/features/initiative-7/utils/reverse-conversion-query"

/**
 * "How these were generated": the calculation anchor, when the data was loaded, the policy version and every
 * threshold that was applied, in plain words. Built from what the backend returned, so it cannot drift from
 * what was actually applied.
 */
export function HowGeneratedPanel({ anchor, policy }: { anchor: ApiReverseAnchor; policy: ApiReversePolicy }) {
  return (
    <details className="group rounded-lg border border-border bg-card px-4 py-3 text-sm">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 font-medium text-foreground">
        <span>How these were generated</span>
        <span className="text-xs font-normal text-muted-foreground">
          Calculated to {formatYearMonth(anchor.month)} · Policy {policy.version} · open to see every threshold applied
        </span>
      </summary>
      <div className="mt-3 flex flex-col gap-2 text-muted-foreground">
        <p>
          <span className="font-medium text-foreground">Anchor:</span> {describeAnchor(anchor)} Data loaded:{" "}
          {formatLoadedAt(anchor.data_loaded_at)}.
        </p>
        {anchor.warnings.map((warning) => (
          <p key={warning} className="flex items-start gap-1.5 text-warning">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            {warning}
          </p>
        ))}
        <p>
          <span className="font-medium text-foreground">Policy:</span> {policy.version}. These thresholds were applied to every row:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          {describePolicy(policy.parameters).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
    </details>
  )
}

/** One line that says the numbers add up to the population that was read: the eligible materials (Convert to
 * OAR) plus the not eligible ones, which the OAR conversion filter shows. */
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
        {reconciliation.excluded > 0 ? ` + ${formatCount(reconciliation.excluded)} excluded` : ""}
        {" · "}
        {reconciliation.reconciled ? "reconciled" : "DOES NOT RECONCILE"}
        {reconciliation.duplicate_keys > 0 ? ` (${reconciliation.duplicate_keys} duplicate material-plants)` : ""}
      </span>
    </p>
  )
}
