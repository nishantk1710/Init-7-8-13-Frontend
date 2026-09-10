import { ArrowDown, ArrowUp } from "lucide-react"

import { cn } from "@/lib/utils"
import type { StockParameters } from "@/features/initiative-7/types/inventory"

const ROWS: { key: keyof StockParameters; label: string }[] = [
  { key: "rop", label: "Reorder Point" },
  { key: "safetyStock", label: "Safety Stock" },
  { key: "maxStock", label: "Maximum Stock" },
]

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
  current: number
  recommended: number
}) {
  const delta = recommended - current
  const pct = current === 0 ? 0 : Math.round((delta / current) * 100)
  const DeltaIcon = delta < 0 ? ArrowDown : ArrowUp
  const tone =
    delta < 0 ? "text-success" : delta > 0 ? "text-warning" : "text-muted-foreground"

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <div className="text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold tabular-nums text-foreground">
        {current} → {recommended}
      </div>
      {delta === 0 ? (
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
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {ROWS.map((row) => (
        <ParameterStatBox
          key={row.key}
          label={row.label}
          current={current[row.key]}
          recommended={recommended[row.key]}
        />
      ))}
    </div>
  )
}
