"use client"

import { ArrowDown, ArrowUp, ChartColumn, Eye, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { ImpactRow } from "@/features/initiative-7/utils/kpi-formulas"

const TONE: Record<ImpactRow["tone"], string> = {
  good: "text-success",
  bad: "text-destructive",
  neutral: "text-muted-foreground",
}

/**
 * "Preview impact": what this calculation's draft would do to the portfolio, before anything is saved. Before a
 * preview has been run it offers one; after, it shows the current and after-change figures with the change, and
 * the button opens the full results. Nothing here saves or applies.
 */
export function PreviewImpactPanel({
  rows,
  pending,
  disabled,
  note,
  onPreview,
  onFullResults,
}: {
  /** The figures, or null when no preview has been run for the draft as it stands. */
  rows: ImpactRow[] | null
  pending: boolean
  disabled: boolean
  /** A caveat that applies to these figures (for example, a changed usage window that is not applied yet). */
  note?: string
  onPreview: () => void
  onFullResults: () => void
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-2">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-action/10 text-action">
          <ChartColumn className="size-3.5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-foreground">Preview impact</h3>
          <p className="text-xs text-muted-foreground">Based on latest data. Nothing is saved.</p>
        </div>
      </div>

      {rows ? (
        <div
          className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-x-4 gap-y-2 rounded-md border border-border px-3 py-2 text-xs"
          role="table"
          aria-label="Preview impact"
        >
          <span role="columnheader" />
          <span role="columnheader" className="text-right text-muted-foreground">
            Current
          </span>
          <span role="columnheader" className="text-right text-muted-foreground">
            After change
          </span>
          <span role="columnheader" />
          {rows.map((row) => (
            <div key={row.label} role="row" className="contents">
              <span role="cell" className="text-foreground">
                {row.label}
              </span>
              <span role="cell" className="text-right font-medium text-foreground tabular-nums">
                {row.now}
              </span>
              <span role="cell" className="text-right font-medium text-foreground tabular-nums">
                {row.next}
              </span>
              <span role="cell" className={cn("flex items-center justify-end gap-0.5 font-medium tabular-nums", TONE[row.tone])}>
                {row.delta !== null && row.delta !== 0 &&
                  (row.delta > 0 ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden />)}
                {row.deltaText}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
          See what your change would do to the whole portfolio before you apply it.
        </p>
      )}

      {rows && note && <p className="text-xs text-warning">{note}</p>}

      <Button
        type="button"
        variant="outline"
        className="w-full border-action/40 text-action hover:text-action"
        disabled={disabled || pending}
        onClick={rows ? onFullResults : onPreview}
      >
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Eye className="size-3.5" />}
        {rows ? "Preview full results" : "Preview impact"}
      </Button>
    </div>
  )
}
