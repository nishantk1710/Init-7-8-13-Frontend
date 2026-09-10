import { Check, X } from "lucide-react"

import { cn } from "@/lib/utils"

export type WorkflowStepStatus =
  | "pending"
  | "active"
  | "done"
  | "rejected"
  | "returned"
  | "skipped"

export interface WorkflowStep {
  id: string
  label: string
  status: WorkflowStepStatus
  /** e.g. "Awaiting response", "Reminder sent 2d ago", "Escalated to HOD" */
  meta?: string
  tone?: "default" | "warning" | "danger"
}

function StepIndicator({
  status,
  index,
  tone = "default",
}: {
  status: WorkflowStepStatus
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
  if (status === "rejected") {
    return (
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-destructive">
        <X className="size-3" />
      </span>
    )
  }
  if (status === "returned") {
    return (
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-warning/15 text-warning text-[10px] font-medium">
        !
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

function stepLabelClass(step: WorkflowStep): string {
  if (step.status === "pending" || step.status === "skipped")
    return "text-muted-foreground"
  if (step.status === "done") return "text-foreground"
  if (step.status === "rejected") return "font-medium text-destructive"
  if (step.status === "returned") return "font-medium text-warning"
  if (step.tone === "danger") return "font-medium text-destructive"
  if (step.tone === "warning") return "font-medium text-warning"
  return "font-medium text-primary"
}

/**
 * Generic multi-step approval/workflow stepper, business-agnostic — the
 * configuration (who the steps are, how many, what advances them) belongs to
 * each initiative; this just renders whatever `WorkflowStep[]` it's given.
 */
export function WorkflowStepper({
  title = "Approval workflow",
  steps,
  className,
}: {
  title?: string
  steps: WorkflowStep[]
  className?: string
}) {
  return (
    <div className={cn("p-3", className)}>
      {title && (
        <h3 className="mb-2 text-[11px] font-medium uppercase tracking-[0.5px] text-muted-foreground">
          {title}
        </h3>
      )}
      <ol className="flex flex-col">
        {steps.map((step, index) => (
          <li key={step.id} className="flex items-center gap-2 py-[5px]">
            <StepIndicator status={step.status} index={index + 1} tone={step.tone} />
            <div>
              <div className={cn("text-xs", stepLabelClass(step))}>{step.label}</div>
              {step.meta && (
                <div className="text-[11px] text-muted-foreground">{step.meta}</div>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
