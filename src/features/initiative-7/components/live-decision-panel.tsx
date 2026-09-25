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

import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/shared/status-badge"
import { cn } from "@/lib/utils"
import { useLiveApproval, useLiveApprovalHistory } from "@/features/initiative-7/hooks/use-live-approval"
import { useLiveWorkflowState } from "@/features/initiative-7/hooks/use-live-approval-queue"
import type { ApiApprovalRole } from "@/features/initiative-7/types/api"

/** Stand-in for a real signed-in identity (see the AUTHENTICATION LIMITATION
 * note above) -- one fixed demo user/role, exactly like the scenario chain's
 * own DEMO_ROLE ("Engineering Manager", approvals-workspace.tsx). "End User"
 * is chosen here because it is the first step of both real routing chains
 * (criticality-tier and OAR/SOP 3.1.1), so a fresh recommendation is
 * immediately actionable rather than always showing "not your turn". */
const DEMO_ACTOR_ID = "demo-end-user"
const DEMO_ACTOR_ROLE: ApiApprovalRole = "End User"

/**
 * Decision controls for a LIVE recommendation. The acting role is always
 * DEMO_ACTOR_ROLE (see above) -- never chosen per action -- and the pending
 * role comes from the backend's own workflow state, matching
 * decision-panel.tsx's "Approve as {role}" pattern instead of a role picker.
 */
export function LiveDecisionActions({
  recommendationId,
  status,
  onChanged,
}: {
  recommendationId: string
  status: string
  onChanged: () => void
}) {
  const { submitting, error, act, submit } = useLiveApproval(recommendationId, onChanged)
  const { state: workflow, loading: workflowLoading } = useLiveWorkflowState(recommendationId)
  const [comment, setComment] = useState("")
  const commentId = useId()

  async function handle(action: "APPROVE" | "REJECT" | "SEND_BACK" | "ADJUST" | "HOLD" | "RELEASE_HOLD") {
    await act(DEMO_ACTOR_ID, DEMO_ACTOR_ROLE, action, comment.trim() || undefined)
    setComment("")
  }

  if (status === "NOT_EVALUABLE") {
    return (
      <p className="text-[13px] text-muted-foreground">
        Not reviewable yet — the backend has not computed a safety stock/ROP for this material-plant (see the
        blocking reason above). Submitting for approval is not possible until it is.
      </p>
    )
  }

  if (workflowLoading) {
    return <p className="text-[13px] text-muted-foreground">Loading workflow state…</p>
  }

  const pendingRole = workflow?.pending_role ?? null
  // READY_FOR_REVIEW is the one status that precedes submission -- route is
  // already populated at that point too (routing is decided by criticality/
  // OAR, not by submission state), so status is the correct signal here, not
  // an empty route.
  const notYetSubmitted = workflow?.status === "READY_FOR_REVIEW"
  const canAct = !submitting && pendingRole === DEMO_ACTOR_ROLE

  if (notYetSubmitted) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-[13px] text-muted-foreground">
          Not yet submitted — sending it for approval starts the chain with the first role in its route.
        </p>
        <Button size="sm" className="self-start" disabled={submitting} onClick={() => submit(DEMO_ACTOR_ID)}>
          <Send className="size-3.5" />
          Send for approval
        </Button>
        {error && <p className="text-[12px] text-destructive">{error.message}</p>}
      </div>
    )
  }

  if (pendingRole === null) {
    return (
      <StatusBadge tone={status === "REJECTED" ? "danger" : "success"}>
        {status === "REJECTED" ? "Rejected" : "Chain complete"}
      </StatusBadge>
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
          This demo session acts as {DEMO_ACTOR_ROLE}, not {pendingRole} — no real login exists yet to act as the
          role this recommendation is actually waiting on (see the note in this file).
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
              {entry.actor_id} ({entry.actor_role}) — {entry.action.replace(/_/g, " ").toLowerCase()}
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
