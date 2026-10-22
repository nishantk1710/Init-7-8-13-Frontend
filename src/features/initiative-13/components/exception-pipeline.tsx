import { SegmentedBar } from "@/features/initiative-13/components/ui/progress-bar"
import { TONE_BORDER, TONE_INK } from "@/features/initiative-13/components/ui/tones"
import type { ActExceptionStatus } from "@/lib/api/i13"
import { percentLabel, type DisplayTone } from "@/features/initiative-13/utils/oar-display"
import { EXCEPTION_STATUS_HINT } from "@/features/initiative-13/utils/status-labels"
import { cn, formatCount } from "@/lib/utils"

export type PipelineStep = { key: string; label: string; count: number; tone: DisplayTone }

/**
 * The exception follow-up pipeline: one bar split by status, then a card per
 * step with its count and share. The steps arrive in workflow order from the
 * count endpoint; a status the order does not know is still shown, last.
 */
export function ExceptionPipeline({ steps, unrouted }: { steps: PipelineStep[]; unrouted: number }) {
  const total = steps.reduce((sum, s) => sum + s.count, 0)
  return (
    <div className="flex flex-col gap-4">
      <SegmentedBar segments={steps} label="Exceptions by follow-up step" />
      <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {steps.map((step, i) => (
          <li
            key={step.key}
            className={cn("flex flex-col gap-1 rounded-xl border border-t-4 border-line bg-card p-4", TONE_BORDER[step.tone])}
            title={EXCEPTION_STATUS_HINT[step.key as ActExceptionStatus]}
          >
            <span className="text-xs font-bold text-ink-muted uppercase">Step {i + 1}</span>
            <span className="text-sm font-semibold text-ink">{step.label}</span>
            <span className="text-3xl font-extrabold tabular-nums text-ink">{formatCount(step.count)}</span>
            <span className={cn("text-sm font-semibold tabular-nums", TONE_INK[step.tone])}>
              {percentLabel(step.count, total)}
            </span>
          </li>
        ))}
      </ol>
      {unrouted > 0 && (
        <p className="rounded-lg bg-urgent-tint px-3 py-2 text-sm font-medium text-urgent-ink">
          <span className="font-extrabold">{formatCount(unrouted)}</span> have no identified requester, so nobody has
          been asked for a reason yet.
        </p>
      )}
    </div>
  )
}
