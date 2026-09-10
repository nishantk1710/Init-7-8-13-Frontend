import { expectedLeadTimeDemand } from "@/features/initiative-7/data/recommendations"
import type { Recommendation } from "@/features/initiative-7/types/inventory"

/** Factor list + the simple explainability equation:
 * Expected Lead-Time Demand + Safety Buffer = Recommended ROP. */
export function WhyRecommended({ recommendation }: { recommendation: Recommendation }) {
  const ltd = expectedLeadTimeDemand(recommendation)
  const safetyBuffer = recommendation.recommended.rop - ltd

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-stretch gap-2 rounded-lg border border-dashed border-border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-center sm:gap-3">
        <EquationTerm label="Expected lead-time demand" value={ltd} />
        <span className="self-center text-lg font-medium text-muted-foreground">+</span>
        <EquationTerm label="Safety buffer" value={safetyBuffer} />
        <span className="self-center text-lg font-medium text-muted-foreground">=</span>
        <EquationTerm label="Recommended ROP" value={recommendation.recommended.rop} emphasize />
      </div>

      <ul className="flex flex-col divide-y divide-border">
        {recommendation.factors.map((factor) => (
          <li key={factor.label} className="py-2 first:pt-0 last:pb-0">
            <div className="text-xs font-medium text-foreground">{factor.label}</div>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{factor.detail}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}

function EquationTerm({ label, value, emphasize }: { label: string; value: number; emphasize?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-md px-2 py-1 text-center">
      <span
        className={
          emphasize
            ? "text-xl font-semibold text-primary tabular-nums"
            : "text-xl font-semibold text-foreground tabular-nums"
        }
      >
        {value}
      </span>
      <span className="text-[10px] whitespace-nowrap text-muted-foreground">{label}</span>
    </div>
  )
}
