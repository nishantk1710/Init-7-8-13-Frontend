import { Check } from "lucide-react"

import type { WorkflowStepData } from "@/lib/types"
import { cn } from "@/lib/utils"

function StepIndicator({
  status,
  index,
  tone = "default",
}: {
  status: WorkflowStepData["status"]
  index: number
  tone?: "default" | "warning" | "danger"
}) {
  if (status === "done") {
    return (
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
        <Check className="size-3" />
      </span>
    )
  }

  if (status === "active") {
    return (
      <span
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-medium",
          tone === "danger" && "bg-destructive/15 text-destructive",
          tone === "warning" && "bg-warning/15 text-warning",
          tone === "default" && "bg-accent text-accent-foreground"
        )}
      >
        {index}
      </span>
    )
  }

  return (
    <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-border text-[10px] font-medium text-muted-foreground">
      {index}
    </span>
  )
}

function stepLabelClass(step: WorkflowStepData): string {
  if (step.status === "pending") return "text-muted-foreground"
  if (step.status === "done") return "text-foreground"
  if (step.tone === "danger") return "font-medium text-destructive"
  if (step.tone === "warning") return "font-medium text-warning"
  return "font-medium text-primary"
}

export function ApprovalStepper({ steps }: { steps: WorkflowStepData[] }) {
  return (
    <div className="p-3">
      <h3 className="mb-2 text-[11px] font-medium uppercase tracking-[0.5px] text-muted-foreground">
        Approval workflow
      </h3>
      <ol className="flex flex-col">
        {steps.map((step, index) => (
          <li key={step.id} className="flex items-center gap-2 py-[5px]">
            <StepIndicator
              status={step.status}
              index={index + 1}
              tone={step.tone}
            />
            <div>
              <div className={cn("text-xs", stepLabelClass(step))}>
                {step.label}
              </div>
              {step.meta && (
                <div className="text-[11px] text-muted-foreground">
                  {step.meta}
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
