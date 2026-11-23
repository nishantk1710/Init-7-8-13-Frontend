import { ArrowDown, ArrowUp } from "lucide-react"

import { cn } from "@/lib/utils"
import type { StockParameters } from "@/features/initiative-7/types/inventory"

type Row = { key: keyof StockParameters; label: string }

const ROP_ROW: Row = { key: "rop", label: "Reorder Point" }
const SAFETY_STOCK_ROW: Row = { key: "safetyStock", label: "Safety Stock" }
const MAX_ROW: Row = { key: "maxStock", label: "Maximum Stock" }

/** The boxes to show. Safety Stock only when the recommendation carries one (an older recommendation, or one made
 * while safety stock is switched on in the backend): a missing one is not a 0, so it gets no box. */
export function parameterRows(recommended: StockParameters): Row[] {
  return recommended.safetyStock != null ? [ROP_ROW, SAFETY_STOCK_ROW, MAX_ROW] : [ROP_ROW, MAX_ROW]
}

/**
 * One current -> recommended stat box. Colour tracks the direction of the
 * change, not whether it's "good": down releases working capital, up buys
 * risk cover, and both are legitimate outcomes.
 */
function ParameterStatBox({
  label,
  current,
  recommended,
}: {
  label: string
  /** SAP's figure now; null when SAP holds none (shown as a dash, never as 0). */
  current: number | null
  recommended: number
}) {
  const delta = current === null ? null : recommended - current
  const pct = current === null || current === 0 || delta === null ? 0 : Math.round((delta / current) * 100)
  const DeltaIcon = delta !== null && delta < 0 ? ArrowDown : ArrowUp
  const tone =
    delta === null || delta === 0 ? "text-muted-foreground" : delta < 0 ? "text-success" : "text-warning"

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <div className="text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold tabular-nums text-foreground">
        {current ?? "—"} → {recommended}
      </div>
      {delta === null ? null : delta === 0 ? (
        <div className="mt-0.5 text-[11px] text-muted-foreground">no change</div>
      ) : (
        <div className={cn("mt-0.5 flex items-center gap-0.5 text-[11px] font-medium", tone)}>
          <DeltaIcon className="size-3 shrink-0" />
          {Math.abs(delta)} ({pct > 0 ? "+" : ""}
          {pct}%)
        </div>
      )}
    </div>
  )
}

/** "Current -> recommended" parameter comparison, one box per SAP parameter. */
export function ParameterComparison({
  current,
  recommended,
}: {
  current: StockParameters
  recommended: StockParameters
}) {
  const rows = parameterRows(recommended)
  return (
    <div className={cn("grid grid-cols-1 gap-3", rows.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
      {rows.map((row) => (
        <ParameterStatBox
          key={row.key}
          label={row.label}
          current={current[row.key]}
          recommended={recommended[row.key] as number}
        />
      ))}
    </div>
  )
}
