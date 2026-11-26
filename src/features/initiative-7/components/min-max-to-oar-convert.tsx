"use client"

import { useId, useState } from "react"
import { ArrowRightLeft, Check, Circle, CircleDot, CircleX, Send } from "lucide-react"
import { toast } from "sonner"

import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { useRoles } from "@/hooks/use-roles"
import { testLoginApprovalRole } from "@/lib/api/actor"
import { cn } from "@/lib/utils"
import { useReverseRequest } from "@/features/initiative-7/hooks/use-reverse-request"
import type { ReverseRequestAction } from "@/features/initiative-7/services/reverse-conversion-requests-api"
import type { ApiApprovalRole } from "@/features/initiative-7/types/api"
import type { ApiReverseLedgerEntry, ApiReverseRecommendation } from "@/features/initiative-7/types/reverse-conversion"
import { resolveActingRole } from "@/features/initiative-7/utils/acting-role"
import {
  ACTION_DONE,
  ACTION_LABEL,
  actionNeedsComment,
  availableActions,
  chainSteps,
  isRequestOpen,
  requestStatusLabel,
  requestStatusTone,
} from "@/features/initiative-7/utils/reverse-request-state"
import { formatLoadedAt } from "@/features/initiative-7/utils/reverse-conversion-query"

const STEP_ICON = { done: Check, current: CircleDot, waiting: Circle } as const

function History({ entries }: { entries: ApiReverseLedgerEntry[] }) {
  if (entries.length === 0) return null
  return (
    <ul className="mt-2 flex flex-col gap-1.5 border-t border-border pt-2">
      {entries.map((entry) => (
        <li key={entry.id} className="text-[12px] leading-snug text-muted-foreground">
          <span className="font-medium text-foreground">{entry.action === "SUBMIT" ? "Requested" : ACTION_DONE[entry.action as ReverseRequestAction] ?? entry.action}</span>
          {" by "}
          {entry.actor_role === "Requester" ? entry.actor_id : entry.actor_role}
          {" · "}
          {formatLoadedAt(entry.timestamp)}
          {entry.comment ? <span className="block text-foreground/80">“{entry.comment}”</span> : null}
        </li>
      ))}
    </ul>
  )
}

/**
 * "Convert to OAR" for one Eligible material, inside its open row: the planner asks for the conversion, and it walks
 * the same fixed chain an OAR conversion does (Inventory Controller, Engineering Head, Plant Head, Commercial Head).
 * An approver who holds the pending step decides it here. Approval is a recorded decision only: SAP is changed by
 * hand afterwards, and nothing on this page writes to SAP.
 *
 * Who is acting is the signed-in person (the backend records them); the approval role they act as is the one their
 * token holds, as on the OAR decision panel -- never a free choice.
 */
export function ConvertToOarSection({ row, onChanged }: { row: ApiReverseRecommendation; onChanged?: () => void }) {
  const { detail, loading, error, unavailable, busy, submit, decline, act } = useReverseRequest(row.material, row.plant, onChanged)
  const [comment, setComment] = useState("")
  const commentId = useId()
  // Declining from the row: the reason box opens on Reject, and Confirm sends it (as on the OAR decision panel).
  const [rejecting, setRejecting] = useState(false)
  const [rejectReason, setRejectReason] = useState("")
  const rejectReasonId = useId()
  const { roles, authEnabled } = useRoles()

  if (row.conversion_eligibility !== "eligible") return null

  const current = detail?.current ?? null
  const open = isRequestOpen(current?.status)
  const actingRole = resolveActingRole({
    roles,
    authEnabled,
    pendingRole: current?.pending_role ?? null,
    testLoginRole: testLoginApprovalRole() as ApiApprovalRole | null,
  })
  const actions = current ? availableActions(current.status, current.pending_role, actingRole) : []
  // Why the last request was rejected: the comment on its newest REJECT entry.
  const rejectionReason = [...(detail?.history ?? [])].reverse().find((entry) => entry.action === "REJECT")?.comment ?? null

  async function request() {
    if (await submit()) {
      toast.success("Sent for conversion to OAR", { description: "It now waits for the first approver." })
    }
  }

  async function reject() {
    if (await decline(rejectReason.trim())) {
      toast.success("Rejected", { description: "It is not sent for approval. You can ask again later." })
      setRejecting(false)
      setRejectReason("")
    }
  }

  async function decide(action: ReverseRequestAction) {
    if (await act(actingRole, action, comment.trim() || undefined)) {
      toast.success(ACTION_DONE[action])
      setComment("")
    }
  }

  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <h4 className="flex items-center gap-1.5 text-xs font-medium tracking-[0.5px] text-muted-foreground uppercase">
        <ArrowRightLeft className="size-3.5" />
        Convert to OAR
      </h4>

      {loading ? (
        <p className="mt-2 text-[13px] text-muted-foreground">Loading…</p>
      ) : unavailable ? (
        <p className="mt-2 text-[13px] text-muted-foreground">
          Conversion requests are not available on this server yet, so nothing can be sent or decided from here.
        </p>
      ) : !detail ? (
        <p role="alert" className="mt-2 text-[13px] text-destructive">
          The conversion request could not be loaded{error ? `: ${error}` : "."}
        </p>
      ) : (
        <>
          {current && (
            <div className="mt-2 flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge tone={requestStatusTone(current.status)}>{requestStatusLabel(current.status)}</StatusBadge>
                {current.pending_role && open && (
                  <span className="text-[12px] text-muted-foreground">Waiting for {current.pending_role}</span>
                )}
                {current.status === "SAP_EXECUTION_PENDING" && (
                  <span className="text-[12px] text-muted-foreground">Every approver has approved. SAP is changed by hand.</span>
                )}
              </div>
              <ol className="flex flex-wrap gap-x-4 gap-y-1">
                {chainSteps(current.route, current.chain_index, current.status).map((step) => {
                  const Icon = STEP_ICON[step.state]
                  return (
                    <li
                      key={step.role}
                      className={cn(
                        "flex items-center gap-1 text-[12px]",
                        step.state === "waiting" ? "text-muted-foreground" : "font-medium text-foreground",
                      )}
                    >
                      <Icon className={cn("size-3.5", step.state === "done" && "text-success")} aria-hidden="true" />
                      {step.role}
                    </li>
                  )
                })}
              </ol>
            </div>
          )}

          {!open && (
            <div className="mt-2 flex flex-col gap-2">
              {current?.status === "REJECTED" && (
                <div className="flex flex-col gap-1">
                  <div>
                    <StatusBadge tone="danger">Rejected</StatusBadge>
                  </div>
                  {rejectionReason && <p className="text-[12px] leading-relaxed text-muted-foreground">Reason: {rejectionReason}</p>}
                  <p className="text-[13px] text-muted-foreground">
                    The earlier request stays in the history. Asking again starts the approval chain again from its first role.
                  </p>
                </div>
              )}
              {current?.status !== "REJECTED" && (
                <p className="text-[13px] text-muted-foreground">
                  Not yet submitted — converting it to OAR starts the approval chain with the first role in its route.
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" disabled={busy || rejecting} onClick={request}>
                  <Send className="size-3.5" />
                  Convert to OAR
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-destructive/40 text-destructive hover:bg-destructive/10"
                  disabled={busy || rejecting}
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
                    maxLength={1000}
                    placeholder="Why this should not be converted -- it is recorded with the decision…"
                    className="w-full min-w-0 resize-y rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-destructive/40 text-destructive hover:bg-destructive/10"
                      disabled={busy || rejectReason.trim().length === 0}
                      onClick={reject}
                    >
                      <CircleX className="size-3.5" />
                      Confirm reject
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
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
            </div>
          )}

          {open && actions.length > 0 && (
            <div className="mt-2 flex flex-col gap-2 border-t border-border pt-2">
              <label htmlFor={commentId} className="text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase">
                Your comment (needed to send back, hold or reject)
              </label>
              <textarea
                id={commentId}
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                rows={2}
                maxLength={1000}
                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-[13px]"
              />
              <div className="flex flex-wrap gap-2">
                {actions.map((action) => (
                  <Button
                    key={action}
                    size="sm"
                    variant={action === "APPROVE" ? "default" : "outline"}
                    disabled={busy || (actionNeedsComment(action) && comment.trim() === "")}
                    onClick={() => decide(action)}
                  >
                    {ACTION_LABEL[action]}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {open && actions.length === 0 && current?.status !== "SAP_EXECUTION_PENDING" && (
            <p className="mt-2 text-[12px] text-muted-foreground">
              Only the {current?.pending_role ?? "next approver"} can decide this step.
            </p>
          )}

          {error && (
            <p role="alert" className="mt-2 text-[12px] text-destructive">
              {error}
            </p>
          )}

          <History entries={detail?.history ?? []} />
          <p className="mt-2 text-[11px] text-muted-foreground">
            A recorded decision only: nothing is written to SAP from this page.
          </p>
        </>
      )}
    </div>
  )
}
