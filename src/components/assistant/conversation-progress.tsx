import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Where the conversation is, as a row of stages.
 *
 * Read from the id of the latest step the server sent — presentation only. The
 * backend still decides every next step; an id this map does not know simply
 * hides the strip rather than guessing.
 */
const FLOWS: { prefix: string; stages: { label: string; ids: string[] }[] }[] = [
  {
    prefix: "i08_",
    stages: [
      { label: "Assess", ids: ["i08_assessment"] },
      { label: "Justify", ids: ["i08_justification"] },
      { label: "Done", ids: ["i08_done"] },
    ],
  },
  {
    prefix: "i13_",
    stages: [
      { label: "Assess", ids: ["i13_assessment"] },
      { label: "Plan", ids: ["i13_capture_plan"] },
      { label: "Quantity", ids: ["i13_quantity", "i13_quantity_justification"] },
      { label: "Done", ids: ["i13_done"] },
    ],
  },
]

export function ConversationProgress({
  stepId,
  finished,
  className,
}: {
  /** Id of the most recent step in the transcript. */
  stepId: string | null
  /** True once the conversation has reached its terminal step. */
  finished: boolean
  className?: string
}) {
  const flow = stepId ? FLOWS.find((f) => stepId.startsWith(f.prefix)) : undefined
  if (!flow || !stepId) return null
  const found = flow.stages.findIndex((stage) => stage.ids.includes(stepId))
  if (found === -1) return null
  const current = finished ? flow.stages.length : found

  return (
    <ol
      aria-label="Conversation progress"
      className={cn("flex items-center gap-1.5 overflow-x-auto", className)}
    >
      {flow.stages.map((stage, index) => {
        const done = index < current
        const now = index === current
        return (
          <li key={stage.label} className="flex items-center gap-1.5">
            {index > 0 && (
              <span
                aria-hidden
                className={cn(
                  "h-0.5 w-5 rounded-full transition-colors duration-500 sm:w-8",
                  done || now ? "ai-gradient" : "bg-border"
                )}
              />
            )}
            <span
              aria-current={now ? "step" : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-all duration-500",
                done && "bg-ai-2/10 text-ai-2",
                now && "ai-gradient text-white shadow-md shadow-ai-2/30",
                !done && !now && "bg-muted text-muted-foreground"
              )}
            >
              {done ? (
                <Check className="size-3" aria-hidden />
              ) : (
                <span
                  aria-hidden
                  className={cn(
                    "relative flex size-1.5 rounded-full",
                    now ? "bg-white" : "bg-muted-foreground/50"
                  )}
                >
                  {now && (
                    <span className="animate-ai-ping absolute inset-0 rounded-full bg-white" />
                  )}
                </span>
              )}
              {stage.label}
              {done && <span className="sr-only"> (done)</span>}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
