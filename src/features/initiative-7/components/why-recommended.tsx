import { expectedLeadTimeDemand } from "@/features/initiative-7/data/recommendations"
import type { Recommendation } from "@/features/initiative-7/types/inventory"
import { USING_LIVE_DATA } from "@/lib/sap/dataset-mode"

/** Factor list + the simple explainability equation:
 * Expected Lead-Time Demand + Safety Buffer = Recommended ROP.
 *
 * Part 22: the equation itself (`expectedLeadTimeDemand`, `safetyBuffer`) is
 * a client-side calculation over `avgDailyConsumption`/`leadTimeDays`, which
 * the architecture rule forbids recomputing in live mode -- the backend's
 * own rationale (`recommendation.rationale`, see recommendation-review-panel.tsx's
 * equivalent live-aware branch) is the real explanation there. This
 * component is not currently mounted anywhere in the app, but is fixed here
 * too since the same rule applies wherever this equation would be shown. */
/** See recommendation-review-panel.tsx's identical helper -- kept as a
 * separate copy rather than a shared import since these two components
 * aren't otherwise coupled and the split logic is a few lines. */
function rationaleBullets(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.replace(/^[\s]*[-•*]\s*/, "").trim())
    .filter((line) => line.length > 0)
}

export function WhyRecommended({ recommendation }: { recommendation: Recommendation }) {
  const showEquation = !USING_LIVE_DATA

  return (
    <div className="flex flex-col gap-4">
      {showEquation && <EquationStrip recommendation={recommendation} />}

      {recommendation.rationale?.text ? (
        <div className="flex flex-col gap-1.5">
          <ul className="list-disc space-y-1.5 pl-4.5 text-[13px] leading-relaxed text-foreground marker:text-primary">
            {rationaleBullets(recommendation.rationale.text).map((bullet, index) => (
              <li key={index}>{bullet}</li>
            ))}
          </ul>
          <span className="self-start text-[10px] font-medium tracking-[0.5px] text-muted-foreground uppercase">
            {recommendation.rationale.source === "AI_GENERATED" ? "AI-generated" : "Deterministic (rule-based)"}
          </span>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {recommendation.factors.map((factor) => (
            <li key={factor.label} className="py-2 first:pt-0 last:pb-0">
              <div className="text-xs font-medium text-foreground">{factor.label}</div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{factor.detail}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function EquationStrip({ recommendation }: { recommendation: Recommendation }) {
  const ltd = expectedLeadTimeDemand(recommendation)
  const safetyBuffer = recommendation.recommended.rop - ltd

  return (
    <div className="flex flex-col items-stretch gap-2 rounded-lg border border-dashed border-border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-center sm:gap-3">
      <EquationTerm label="Expected lead-time demand" value={ltd} />
      <span className="self-center text-lg font-medium text-muted-foreground">+</span>
      <EquationTerm label="Safety buffer" value={safetyBuffer} />
      <span className="self-center text-lg font-medium text-muted-foreground">=</span>
      <EquationTerm label="Recommended ROP" value={recommendation.recommended.rop} emphasize />
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
