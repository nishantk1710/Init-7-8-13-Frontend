// Part 21 — I07 frontend/backend integration.
//
// Live (backend-driven) counterpart to decision-panel.tsx's DecisionActions/
// DecisionHistory. Rendered only when NEXT_PUBLIC_DATASET=live (see
// recommendation-detail-page.tsx) -- decision-panel.tsx itself is untouched
// and keeps driving the scenario/generated simulation exactly as before.
//
// AUTHENTICATION LIMITATION (Part 13 deferred, revisited Part 35): no real
// login exists yet. Until one does, this follows decision-panel.tsx's own
// existing pattern exactly (see DEMO_ROLE in approvals-workspace.tsx) rather
// than asking the user to type an actor id and pick a role from every
// possible value: a single fixed demo identity acts, and the role it acts AS
// is derived from the backend's own pending_role for this recommendation
// (GET .../workflow-state) -- never a free choice. If pending_role does not
// match DEMO_ACTOR_ROLE, the actions are disabled with an explanation rather
// than let the user pick a role that was never theirs; the backend would
// reject a mismatched role anyway (HTTP 409 INVALID_WORKFLOW_ACTION), but the
// UI should not offer an action it already knows will fail.

"use client"

import { useId, useState } from "react"
import { CircleCheck, CircleX, Pause, Play, RotateCcw, Send, SlidersHorizontal } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { SentForApprovalNotice } from "@/features/initiative-7/components/sent-for-approval-notice"
import { StatusBadge } from "@/components/shared/status-badge"
import { cn } from "@/lib/utils"
import { useLiveApproval, useLiveApprovalHistory } from "@/features/initiative-7/hooks/use-live-approval"
import { useLiveWorkflowState } from "@/features/initiative-7/hooks/use-live-approval-queue"
import type { ApiApprovalRole } from "@/features/initiative-7/types/api"
import {
  decisionPanelMode,
  panelContentFor,
  type DecisionSurface,
} from "@/features/initiative-7/utils/decision-panel-mode"

/** Stand-in for a real signed-in identity (see the AUTHENTICATION LIMITATION
 * note above) -- one fixed demo user/role, exactly like the scenario chain's
 * own DEMO_ROLE ("Engineering Manager", approvals-workspace.tsx). "End User"
 * is chosen here because it is the first step of both real routing chains
 * (criticality-tier and OAR/SOP 3.1.1), so a fresh recommendation is
 * immediately actionable rather than always showing "not your turn". */
const DEMO_ACTOR_ID = "end-user"

const DECISION_TOAST: Record<"APPROVE" | "REJECT" | "SEND_BACK" | "ADJUST" | "HOLD" | "RELEASE_HOLD", string> = {
  APPROVE: "Approved",
  REJECT: "Rejected",
  SEND_BACK: "Sent back",
  ADJUST: "Adjusted",
  HOLD: "Put on hold",
  RELEASE_HOLD: "Hold released",
}

/** History written before the ID lost its "demo-" prefix still reads cleanly. */
function actorLabel(actorId: string): string {
  return actorId.replace(/^demo-/, "")
}
const DEMO_ACTOR_ROLE: ApiApprovalRole = "End User"

/**
 * Decision controls for a LIVE recommendation. The acting role is always
 * DEMO_ACTOR_ROLE (see above) -- never chosen per action -- and the pending
 * role comes from the backend's own workflow state, matching
 * decision-panel.tsx's "Approve as {role}" pattern instead of a role picker.
 *
 * `surface` decides what is offered. On a recommendation page ("recommendation", the default) a planner
 * can Send for approval or Reject (with a reason, so a recommendation they will not adopt does not have to
 * go through the chain only to be rejected there); once sent, the page shows where it is and points to the
 * Action Center. The approve / adjust / send back / hold / reject buttons for a recommendation that is in
 * the chain exist only on the Action Center ("action-center").
 */
export function LiveDecisionActions({
  recommendationId,
  onChanged,
  surface = "recommendation",
  convertToMinMax = false,
}: {
  recommendationId: string
  onChanged: () => void
  surface?: DecisionSurface
  /** An OAR material (the backend made a Min-Max conversion decision for it): the one action on
   * its page is worded as that conversion, not as a generic "approval". It goes through the same
   * chain either way. */
  convertToMinMax?: boolean
}) {
  const { submitting, error, act, submit, reject, lastState } = useLiveApproval(recommendationId, onChanged)
  const { state: loadedWorkflow, loading: workflowLoading } = useLiveWorkflowState(recommendationId)
  // The state the backend returned for the last action is the newest there is; the loaded one is from before it.
  const workflow = lastState ?? loadedWorkflow
  const [comment, setComment] = useState("")
  const commentId = useId()
  // Declining from the recommendation page: the reason box opens on Reject, and Confirm sends it.
  const [rejecting, setRejecting] = useState(false)
  const [rejectReason, setRejectReason] = useState("")
  const rejectReasonId = useId()

  async function handle(action: "APPROVE" | "REJECT" | "SEND_BACK" | "ADJUST" | "HOLD" | "RELEASE_HOLD") {
    const accepted = await act(DEMO_ACTOR_ID, DEMO_ACTOR_ROLE, action, comment.trim() || undefined)
    if (accepted) toast.success(DECISION_TOAST[action])
    setComment("")
  }

  async function handleSend() {
    const accepted = await submit(DEMO_ACTOR_ID)
    if (accepted && convertToMinMax) {
      toast.success("Sent for conversion to Min-Max", {
        description: "It is now in the Action Center, where it is reviewed and approved.",
      })
    } else if (accepted) {
      toast.success("Sent for approval", {
        description: "It is now in the Action Center, where it is reviewed and approved.",
      })
    }
  }

  async function handleReject() {
    const accepted = await reject(DEMO_ACTOR_ID, rejectReason.trim())
    if (accepted) {
      toast.success("Rejected", {
        description: "It is not sent for approval and leaves the Recommendations list.",
      })
      setRejecting(false)
      setRejectReason("")
    }
  }

  if (workflowLoading) {
    return <p className="text-[13px] text-muted-foreground">Loading workflow state…</p>
  }

  // Decided from the backend's own status, never from the display label the table shows
  // ("Pending Review"): see utils/decision-panel-mode.ts.
  const rawStatus = workflow?.status ?? ""
  const pendingRole = workflow?.pending_role ?? null
  const mode = decisionPanelMode(rawStatus, pendingRole)
  const content = panelContentFor(mode, surface)
  const canAct = !submitting && pendingRole === DEMO_ACTOR_ROLE

  if (content === "not-reviewable") {
    return (
      <p className="text-[13px] text-muted-foreground">
        Not reviewable yet — the backend has not computed a safety stock/ROP for this material-plant (see the
        blocking reason above). Submitting for approval is not possible until it is.
      </p>
    )
  }

  if (content === "not-submitted-note") {
    return (
      <p className="text-[13px] text-muted-foreground">
        Not yet sent for approval — it is sent from its recommendation page, and then waits here to be decided.
      </p>
    )
  }

  if (content === "submit-button") {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-[13px] text-muted-foreground">
          {convertToMinMax
            ? "Not yet submitted — converting it from OAR to Min-Max ordering starts the approval chain with the first role in its route."
            : "Not yet submitted — sending it for approval starts the chain with the first role in its route."}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" disabled={submitting || rejecting} onClick={handleSend}>
            <Send className="size-3.5" />
            {convertToMinMax ? "Convert OAR into Min-Max" : "Send for approval"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-destructive/40 text-destructive hover:bg-destructive/10"
            disabled={submitting || rejecting}
            onClick={() => setRejecting(true)}
          >
            <CircleX className="size-3.5" />
            Reject
          </Button>
        </div>
        {rejecting ? (
          <div className="flex flex-col gap-2">
            <label
              htmlFor={rejectReasonId}
              className="text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase"
            >
              Reason for rejecting (required)
            </label>
            <textarea
              id={rejectReasonId}
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              rows={2}
              placeholder="Why this should not be adopted -- it is recorded with the decision…"
              className="w-full min-w-0 resize-y rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="border-destructive/40 text-destructive hover:bg-destructive/10"
                disabled={submitting || rejectReason.trim().length === 0}
                onClick={handleReject}
              >
                <CircleX className="size-3.5" />
                Confirm reject
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={submitting}
                onClick={() => {
                  setRejecting(false)
                  setRejectReason("")
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            Not adopting it? Reject it here with a reason -- it does not need to go through approval first.
          </p>
        )}
        {error && <p className="text-[12px] text-destructive">{error.message}</p>}
      </div>
    )
  }

  if (content === "sent-notice") {
    return (
      <SentForApprovalNotice
        pendingRole={pendingRole ?? "the next approver"}
        step={(workflow?.chain_index ?? 0) + 1}
        steps={workflow?.route.length ?? 0}
      />
    )
  }

  if (content === "rejected") {
    return <StatusBadge tone="danger">Rejected</StatusBadge>
  }

  if (content === "chain-complete") {
    return <StatusBadge tone="success">Chain complete</StatusBadge>
  }

  if (content === "no-pending-step") {
    return (
      <p className="text-[13px] text-muted-foreground">
        No approval step is waiting on this recommendation{rawStatus ? ` (status ${rawStatus})` : ""}.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="text-[13px] text-muted-foreground">
        Step {(workflow?.chain_index ?? 0) + 1} of {workflow?.route.length ?? 0} — awaiting{" "}
        <span className="font-medium text-foreground">{pendingRole}</span>
      </div>

      {pendingRole !== DEMO_ACTOR_ROLE && (
        <p className="text-[12px] text-muted-foreground">
          Acting as {DEMO_ACTOR_ROLE} — this step is awaiting {pendingRole}.
        </p>
      )}

      <div>
        <label htmlFor={commentId} className="text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase">
          Comment (required for Reject / Send back / Adjust / Hold)
        </label>
        <textarea
          id={commentId}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          rows={2}
          placeholder="Record the reasoning that will travel with this decision…"
          className="mt-1.5 w-full min-w-0 resize-y rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          className="bg-success text-white hover:bg-success/90"
          disabled={!canAct}
          onClick={() => handle("APPROVE")}
        >
          <CircleCheck className="size-3.5" />
          Approve as {DEMO_ACTOR_ROLE}
        </Button>
        <Button size="sm" variant="outline" disabled={!canAct} onClick={() => handle("ADJUST")}>
          <SlidersHorizontal className="size-3.5" />
          Adjust
        </Button>
        <Button size="sm" variant="outline" disabled={!canAct} onClick={() => handle("SEND_BACK")}>
          <RotateCcw className="size-3.5" />
          Send back
        </Button>
        <Button size="sm" variant="outline" disabled={!canAct} onClick={() => handle("HOLD")}>
          <Pause className="size-3.5" />
          Hold
        </Button>
        <Button size="sm" variant="outline" disabled={!canAct} onClick={() => handle("RELEASE_HOLD")}>
          <Play className="size-3.5" />
          Release hold
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="border-destructive/40 text-destructive hover:bg-destructive/10"
          disabled={!canAct}
          onClick={() => handle("REJECT")}
        >
          <CircleX className="size-3.5" />
          Reject
        </Button>
      </div>

      {error && (
        <p className="text-[12px] text-destructive">
          {error.message}
        </p>
      )}
    </div>
  )
}

/** Live counterpart to DecisionHistory, reading the real approval ledger
 * (GET .../approval-history) instead of in-memory scenario state. */
export function LiveDecisionHistory({ recommendationId, reloadKey }: { recommendationId: string; reloadKey: unknown }) {
  const { entries, loading, error } = useLiveApprovalHistory(recommendationId, reloadKey)

  if (loading) {
    return <p className="text-[13px] text-muted-foreground">Loading approval history…</p>
  }

  if (error) {
    return <p className="text-[13px] text-destructive">Could not load approval history: {error.message}</p>
  }

  if (entries.length === 0) {
    return (
      <p className="text-[13px] text-muted-foreground">
        Nothing recorded yet — the history starts once this recommendation is submitted for approval.
      </p>
    )
  }

  return (
    <ul className="flex flex-col divide-y divide-border">
      {entries.map((entry, index) => (
        <li key={`${entry.timestamp}-${index}`} className="py-2 first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
            <span className={cn("text-[13px]", entry.action === "REJECT" ? "text-destructive" : "text-primary")}>
              {actorLabel(entry.actor_id)} ({entry.actor_role}) —{entry.action.replace(/_/g, " ").toLowerCase()}
            </span>
            <span className="text-[11px] whitespace-nowrap text-muted-foreground tabular-nums">
              {new Date(entry.timestamp).toLocaleString()}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5">
            <StatusBadge tone="default">{entry.previous_status}</StatusBadge>
            <span className="text-[11px] text-muted-foreground">→</span>
            <StatusBadge tone="default">{entry.new_status}</StatusBadge>
          </div>
          {entry.comment && <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">“{entry.comment}”</p>}
        </li>
      ))}
    </ul>
  )
}
