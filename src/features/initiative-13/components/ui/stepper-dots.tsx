import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

export type Step = { key: string; label: string; reached: boolean; detail?: string }

function readOut(steps: Step[]): string {
  return steps.map((s) => `${s.label}: ${s.reached ? "reached" : "not reached"}`).join(", ")
}

/**
 * A chain of steps as connected dots: filled green with a tick once reached,
 * a hollow grey ring before. Shape and colour both say it, and the count
 * beside the dots says it in words.
 */
export function StepperDots({ steps, className }: { steps: Step[]; className?: string }) {
  const reached = steps.filter((s) => s.reached).length
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <ol role="img" aria-label={`Journey: ${readOut(steps)}`} className="flex items-center">
        {steps.map((step, i) => (
          <li key={step.key} className="flex items-center" title={`${step.label}: ${step.reached ? "reached" : "not reached"}`}>
            {i > 0 && (
              <span
                aria-hidden
                className={cn("h-0.5 w-3", step.reached && steps[i - 1].reached ? "bg-healthy" : "bg-line")}
              />
            )}
            <span
              aria-hidden
              className={cn(
                "flex size-3.5 items-center justify-center rounded-full border-2",
                step.reached ? "border-healthy bg-healthy" : "border-ink-muted/40 bg-card"
              )}
            />
          </li>
        ))}
      </ol>
      <span className="text-xs font-semibold text-ink-muted tabular-nums">
        {reached}/{steps.length}
      </span>
    </div>
  )
}

/** The same chain at full size: every step labelled, with its document or date. */
export function Stepper({ steps, className }: { steps: Step[]; className?: string }) {
  return (
    <div className={cn("max-w-full overflow-x-auto", className)}>
      <ol className="flex min-w-[560px]">
        {steps.map((step, i) => (
          <li key={step.key} className="relative flex flex-1 flex-col items-center gap-2 px-2 text-center">
            {i > 0 && (
              <span
                aria-hidden
                className={cn(
                  "absolute top-3.5 right-1/2 h-0.5 w-full -translate-y-1/2",
                  step.reached && steps[i - 1].reached ? "bg-healthy" : "bg-line"
                )}
              />
            )}
            <span
              className={cn(
                "relative flex size-7 items-center justify-center rounded-full border-2",
                step.reached ? "border-healthy bg-healthy text-white" : "border-ink-muted/40 bg-card text-ink-muted"
              )}
            >
              {step.reached ? (
                <Check aria-hidden className="size-4" strokeWidth={3} />
              ) : (
                <span aria-hidden className="text-xs font-bold">
                  {i + 1}
                </span>
              )}
            </span>
            <span className="text-sm font-bold text-ink">{step.label}</span>
            <span className="sr-only">{step.reached ? "Reached." : "Not reached."}</span>
            {step.detail && (
              <span className={cn("text-xs", step.reached ? "text-ink" : "text-ink-muted")}>{step.detail}</span>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}
