"use client"

import { useId, useState } from "react"
import { CircleCheck, CircleX, Send, SlidersHorizontal } from "lucide-react"

import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { approverName } from "@/features/initiative-7/data/approval-chain"
import { CHAIN_LENGTH, useInventoryWorkflow } from "@/features/initiative-7/context/workflow-context"
import { DEMO_ROLE } from "@/features/initiative-7/components/approvals-workspace"
import type { Recommendation } from "@/features/initiative-7/types/inventory"

/**
 * The decision step for one recommendation: who it is waiting on, the comment
 * that travels with the decision, and the three actions open to that approver.
 */
export function DecisionActions({ recommendation }: { recommendation: Recommendation }) {
  const { stateFor, pendingRole, sendForApproval, approve, adjust, reject } = useInventoryWorkflow()
  const [comment, setComment] = useState("")
  const commentId = useId()

  const state = stateFor(recommendation.id)
  const role = pendingRole(recommendation.id)
  const canDecide = comment.trim().length > 0

  function act(action: (rec: Recommendation, comment?: string) => void) {
    action(recommendation, comment)
    setComment("")
  }

  if (!state.submitted) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-[13px] text-muted-foreground">
          Not yet submitted — still with the planner. Sending it for approval starts the four-step chain with the
          End User.
        </p>
        <Button size="sm" className="self-start" onClick={() => sendForApproval(recommendation)}>
          <Send className="size-3.5" />
          Send for approval
        </Button>
      </div>
    )
  }

  if (!role) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone={state.outcome === "rejected" ? "danger" : "success"}>
          {state.outcome === "rejected"
            ? "Rejected"
            : state.outcome === "adjusted"
              ? "Approved with adjustments"
              : "Fully approved"}
        </StatusBadge>
        <span className="text-[11px] text-muted-foreground">
          {state.outcome === "rejected"
            ? "Current SAP parameters retained — no update simulated."
            : "Chain complete — ready for the simulated SAP parameter update."}
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="text-[13px] text-muted-foreground">
        Step {state.stepIndex + 1} of {CHAIN_LENGTH} — awaiting{" "}
        <span className="font-medium text-foreground">{role}</span>{" "}
        <span>({role === DEMO_ROLE ? `Demo ${role}` : approverName(role)})</span>
      </div>

      <div>
        <label
          htmlFor={commentId}
          className="text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase"
        >
          Decision comment (required)
        </label>
        <textarea
          id={commentId}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          rows={3}
          placeholder="Record the reasoning that will travel with this decision…"
          className="mt-1.5 w-full min-w-0 resize-y rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        />
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          The comment is kept with the decision history as the justification for the parameter change.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          className="bg-success text-white hover:bg-success/90"
          disabled={!canDecide}
          onClick={() => act(approve)}
        >
          <CircleCheck className="size-3.5" />
          Approve as {role}
        </Button>
        <Button size="sm" variant="outline" disabled={!canDecide} onClick={() => act(adjust)}>
          <SlidersHorizontal className="size-3.5" />
          Adjust
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="border-destructive/40 text-destructive hover:bg-destructive/10"
          disabled={!canDecide}
          onClick={() => act(reject)}
        >
          <CircleX className="size-3.5" />
          Reject
        </Button>
        {!canDecide && (
          <span className="text-[11px] text-muted-foreground">Add a comment to enable the decision.</span>
        )}
      </div>
    </div>
  )
}

/** The running record of who did what to this recommendation, and when. The
 * heading is left to the caller, which already titles the section. */
export function DecisionHistory({ recommendation }: { recommendation: Recommendation }) {
  const { stateFor } = useInventoryWorkflow()
  const state = stateFor(recommendation.id)

  return (
    <div>
      {state.history.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">
          Nothing recorded yet — the history starts when this is sent for approval.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {state.history.map((entry, index) => (
            <li key={`${entry.actor}-${entry.action}-${index}`} className="py-2 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                <span
                  className={cn(
                    "text-[13px]",
                    entry.action.startsWith("rejected") ? "text-destructive" : "text-primary"
                  )}
                >
                  {entry.actor} {entry.action}
                </span>
                <span className="text-[11px] whitespace-nowrap text-muted-foreground tabular-nums">
                  {entry.timestamp}
                </span>
              </div>
              {entry.comment && (
                <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                  “{entry.comment}”
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
