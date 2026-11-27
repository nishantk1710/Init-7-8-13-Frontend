"use client"

import { useId, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { useRoles } from "@/hooks/use-roles"
import { testLoginApprovalRole } from "@/lib/api/actor"
import type { ReverseRequestState } from "@/features/initiative-7/hooks/use-reverse-request"
import type { ReverseRequestAction } from "@/features/initiative-7/services/reverse-conversion-requests-api"
import type { ApiApprovalRole } from "@/features/initiative-7/types/api"
import type { ApiReverseRequest } from "@/features/initiative-7/types/reverse-conversion"
import { resolveActingRole } from "@/features/initiative-7/utils/acting-role"
import {
  ACTION_DONE,
  ACTION_LABEL,
  actionNeedsComment,
  availableActions,
  isRequestOpen,
} from "@/features/initiative-7/utils/reverse-request-state"

/**
 * "Your decision" on a Convert to OAR request: where it is in the approval chain, and -- for the person who holds the
 * pending step -- the comment box and the actions. It lives on the Action Center's decision page, as the OAR decision
 * panel does on the Action Center; the Stock item to OAR card only says the request was sent.
 *
 * Who is acting is the signed-in person (the backend records them); the approval role they act as is the one their token
 * holds, never a free choice. Approval is a recorded decision only: nothing here writes to SAP.
 */
export function ConvertToOarDecisionPanel({
  request,
  busy,
  error,
  act,
}: {
  request: ApiReverseRequest
  busy: boolean
  error: string | null
  act: ReverseRequestState["act"]
}) {
  const [comment, setComment] = useState("")
  const commentId = useId()
  const { roles, authEnabled } = useRoles()

  const open = isRequestOpen(request.status)
  const actingRole = resolveActingRole({
    roles,
    authEnabled,
    pendingRole: request.pending_role,
    testLoginRole: testLoginApprovalRole() as ApiApprovalRole | null,
  })
  const actions = availableActions(request.status, request.pending_role, actingRole)

  async function decide(action: ReverseRequestAction) {
    if (await act(actingRole, action, comment.trim() || undefined)) {
      toast.success(ACTION_DONE[action])
      setComment("")
    }
  }

  let body: React.ReactNode
  if (request.status === "REJECTED") {
    body = <p className="text-[13px] text-muted-foreground">This request was rejected. Nothing is waiting for a decision.</p>
  } else if (request.status === "SAP_EXECUTION_PENDING") {
    body = <p className="text-[13px] text-muted-foreground">Every approver has approved. SAP is changed by hand.</p>
  } else if (!open) {
    body = <p className="text-[13px] text-muted-foreground">No approval step is waiting on this request.</p>
  } else {
    body = (
      <>
        <p className="text-[13px] text-muted-foreground">
          Step {request.chain_index + 1} of {request.route.length} — awaiting{" "}
          <span className="font-medium text-foreground">{request.pending_role ?? "the next approver"}</span>
        </p>
        {actions.length === 0 ? (
          <p className="text-[12px] text-muted-foreground">
            Acting as {actingRole} — this step is awaiting {request.pending_role ?? "the next approver"}. Only the{" "}
            {request.pending_role ?? "next approver"} can decide it.
          </p>
        ) : (
          <>
            <label htmlFor={commentId} className="text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase">
              Comment (needed to send back, hold or reject)
            </label>
            <textarea
              id={commentId}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="Record the reasoning that will travel with this decision…"
              className="w-full min-w-0 resize-y rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            />
            <div className="flex flex-wrap gap-2">
              {actions.map((action) => (
                <Button
                  key={action}
                  variant={action === "APPROVE" ? "default" : "outline"}
                  className="min-h-11 px-4"
                  disabled={busy || (actionNeedsComment(action) && comment.trim() === "")}
                  onClick={() => decide(action)}
                >
                  {ACTION_LABEL[action]}
                </Button>
              ))}
            </div>
          </>
        )}
      </>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-xs font-medium tracking-[0.5px] text-muted-foreground uppercase">Your decision</h2>
      {body}
      {error && (
        <p role="alert" className="text-[12px] text-destructive">
          {error}
        </p>
      )}
      <p className="text-[12px] text-muted-foreground">A recorded decision only: nothing is written to SAP from this page.</p>
    </div>
  )
}
