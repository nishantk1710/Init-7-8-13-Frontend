"use client"

import { Check, RotateCcw, Send, TriangleAlert, X } from "lucide-react"

import { StatusBadge } from "@/components/shared/status-badge"
import { Timeline, type TimelineEvent } from "@/components/shared/timeline"
import { WorkflowStepper } from "@/components/shared/workflow-stepper"
import { Button } from "@/components/ui/button"
import type { AuditEvent } from "@/lib/domain/contracts"
import { useRecommendationWorkflow, type SapUpdateStatus } from "@/features/initiative-7/hooks/use-recommendation-workflow"
import type { Recommendation } from "@/features/initiative-7/types/inventory"

const SAP_STATUS_TONE: Record<SapUpdateStatus, "default" | "success" | "warning" | "danger"> = {
  "Awaiting Final Approval": "default",
  "Approved — Ready for SAP Update": "warning",
  "SAP Update Simulated": "success",
  "Rejected — No SAP Update": "danger",
}

function auditEventTone(event: AuditEvent): TimelineEvent["tone"] {
  const t = event.eventType.toLowerCase()
  if (t.includes("rejected")) return "danger"
  if (t.includes("returned") || t.includes("escalated")) return "warning"
  if (t.includes("approved") || t.includes("simulated")) return "success"
  return "default"
}

export function ApprovalWorkflowPanel({ recommendation }: { recommendation: Recommendation }) {
  const { workflow, auditTrail, sapStatus, canAct, approve, reject, returnStep, escalate, simulateSapUpdate } =
    useRecommendationWorkflow(recommendation)

  const timelineEvents: TimelineEvent[] = auditTrail.map((e) => ({
    id: e.id,
    label: e.eventType,
    timestamp: e.timestamp,
    description: e.description,
    tone: auditEventTone(e),
  }))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase">
          SAP update status
        </span>
        <StatusBadge tone={SAP_STATUS_TONE[sapStatus]}>{sapStatus}</StatusBadge>
      </div>
      <p className="-mt-2 text-[11px] text-muted-foreground">
        No live SAP write ever occurs from this workspace — every SAP-facing state here is simulated for demo
        purposes only.
      </p>

      <WorkflowStepper steps={workflow} />

      {canAct ? (
        <div className="flex flex-wrap gap-2 px-3">
          <Button
            size="sm"
            variant="outline"
            className="border-success/40 text-success hover:bg-success/10"
            onClick={() => approve()}
          >
            <Check className="size-3.5" />
            Approve
          </Button>
          <Button size="sm" variant="destructive" onClick={() => reject()}>
            <X className="size-3.5" />
            Reject
          </Button>
          <Button size="sm" variant="outline" onClick={() => returnStep()}>
            <RotateCcw className="size-3.5" />
            Return
          </Button>
          <Button size="sm" variant="outline" className="text-warning" onClick={() => escalate()}>
            <TriangleAlert className="size-3.5" />
            Escalate
          </Button>
        </div>
      ) : sapStatus === "Approved — Ready for SAP Update" ? (
        <div className="px-3">
          <Button size="sm" onClick={simulateSapUpdate}>
            <Send className="size-3.5" />
            Simulate SAP Update
          </Button>
        </div>
      ) : (
        <p className="px-3 text-xs text-muted-foreground">
          {sapStatus === "Rejected — No SAP Update"
            ? "This recommendation was rejected — no further workflow action is available."
            : "This recommendation has completed its workflow."}
        </p>
      )}

      <div className="border-t border-dashed border-border pt-3">
        <h3 className="mb-2 text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase">
          Audit trail for this recommendation
        </h3>
        <Timeline events={timelineEvents} />
      </div>
    </div>
  )
}
