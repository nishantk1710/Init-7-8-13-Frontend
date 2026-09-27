"use client"

import { Fragment, useState, useTransition } from "react"
import Link from "next/link"
import { ChevronRight, MessagesSquare } from "lucide-react"
import { toast } from "sonner"

import { AskAssistantLink } from "@/components/assistant/ask-assistant-link"
import { AlertBanner } from "@/components/shared/alert-banner"
import { EmptyState } from "@/components/shared/empty-state"
import { RiskBadge } from "@/components/shared/risk-badge"
import { SAPDocumentChip } from "@/components/shared/sap-document-chip"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { confirmExceptionAction } from "@/features/initiative-13/actions"
import { ConfirmExceptionDialog } from "@/features/initiative-13/components/confirm-exception-dialog"
import { SessionChips } from "@/features/initiative-13/components/session-chips"
import type { ApiSessionSummary } from "@/lib/api/assistant"
import type { ActException, ActExceptionStatus, ActExceptionType } from "@/lib/api/i13"
import { formatApiDateTime } from "@/lib/api/format"
import { cn } from "@/lib/utils"

const TYPE_LABEL: Record<ActExceptionType, string> = {
  PLAN_BREACH: "Plan breach",
  NO_PLAN: "No plan",
  NO_PLAN_GRNI: "No plan + 30-day GRNI",
  QUANTITY_OVERRIDE: "Quantity override",
}

const TYPE_RISK: Record<ActExceptionType, "low" | "medium" | "high"> = {
  PLAN_BREACH: "high",
  NO_PLAN: "medium",
  NO_PLAN_GRNI: "high",
  QUANTITY_OVERRIDE: "medium",
}

const STATUS_TONE: Record<
  ActExceptionStatus,
  "default" | "warning" | "success" | "danger"
> = {
  OPEN: "default",
  AWAITING_REQUESTER: "warning",
  CONFIRMED: "success",
  ESCALATED: "danger",
  RESOLVED: "success",
}

const STATUS_LABEL: Record<ActExceptionStatus, string> = {
  OPEN: "Open — not routed",
  AWAITING_REQUESTER: "Awaiting requester",
  CONFIRMED: "Confirmed",
  ESCALATED: "Escalated to HOD",
  RESOLVED: "Resolved",
}

/**
 * The FR-9 exception queue.
 *
 * ## What this replaces, and why it is a different screen
 *
 * The Exceptions page used to render `GET /i13/exceptions` — W6.3's older,
 * ephemeral queue, recomputed on every request. It has no owner, no state
 * machine, no audit trail and no session reference, so the board built on it
 * advanced statuses with local `useState` and a toast. A user acknowledged an
 * exception, the badge changed, and nothing was recorded anywhere.
 *
 * This reads `GET /i13/act/exceptions` — the persisted W6.6 queue the FRS
 * actually describes — and its one action is a real POST through a Server
 * Action, validated by the backend's state machine and appended to an audit
 * trail that cannot be edited.
 *
 * ## Why a row can be un-actionable, and why that is shown rather than hidden
 *
 * An exception in `OPEN` has never been routed to anybody, because no requester
 * could be resolved for it. The state machine will refuse a confirmation on it —
 * correctly: nobody was asked, so nobody can answer. Rather than hide the
 * button or let the click fail, the row says why.
 */
export function ActExceptionsBoard({
  exceptions,
  reasonCategories,
  sessionsByKey,
}: {
  exceptions: ActException[]
  /** VZI's vocabulary, served by the backend — never a list held here. */
  reasonCategories: string[]
  sessionsByKey?: Map<string, ApiSessionSummary[]>
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<ActException | null>(null)
  const [isPending, startTransition] = useTransition()

  function submit(exceptionId: string, formData: FormData) {
    startTransition(async () => {
      const result = await confirmExceptionAction(exceptionId, formData)
      if (result.ok) {
        toast.success(result.message)
        setConfirming(null)
      } else {
        toast.error(result.message)
      }
    })
  }

  if (exceptions.length === 0) {
    return (
      <EmptyState
        title="No exceptions match these filters."
        description="Detection raises exceptions when it runs — it has no schedule, so an empty queue may mean it has not run since the data changed."
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Type</TableHead>
              <TableHead>Material</TableHead>
              <TableHead>Plant</TableHead>
              <TableHead>Reservation</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Detected</TableHead>
              <TableHead>Due</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {exceptions.map((exception) => {
              const isExpanded = expandedId === exception.exceptionId
              // The state machine allows a confirmation only from a state that
              // was routed to somebody. Mirrored here so the button explains
              // itself rather than producing a 422 on click.
              const canConfirm =
                exception.status === "AWAITING_REQUESTER" ||
                exception.status === "ESCALATED"
              return (
                <Fragment key={exception.exceptionId}>
                  <TableRow
                    className="cursor-pointer"
                    onClick={() =>
                      setExpandedId(isExpanded ? null : exception.exceptionId)
                    }
                    aria-expanded={isExpanded}
                  >
                    <TableCell>
                      <ChevronRight
                        className={cn(
                          "size-4 text-muted-foreground transition-transform duration-300 ease-out",
                          isExpanded && "rotate-90"
                        )}
                      />
                    </TableCell>
                    <TableCell>
                      <RiskBadge level={TYPE_RISK[exception.exceptionType]}>
                        {TYPE_LABEL[exception.exceptionType]}
                      </RiskBadge>
                    </TableCell>
                    <TableCell className="font-medium text-foreground">
                      <div className="flex flex-col gap-0.5">
                        <span>{exception.material}</span>
                        <span
                          className="flex items-center gap-1"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <AskAssistantLink
                            materialId={exception.material}
                            plant={exception.plant}
                            variant="chip"
                            label="Ask"
                          />
                          {/* The exception's OWN session, where it has one —
                              a plan breach or a quantity override knows the
                              exact conversation it came from, which is a
                              stronger link than a material+plant lookup. */}
                          {exception.sessionId ? (
                            <Link
                              href={`/assistant/sessions/${encodeURIComponent(exception.sessionId)}`}
                              className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            >
                              <MessagesSquare className="size-3" aria-hidden />
                              Session
                            </Link>
                          ) : (
                            <SessionChips
                              sessions={sessionsByKey?.get(
                                `${exception.material}::${exception.plant}`
                              )}
                            />
                          )}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {exception.plant}
                    </TableCell>
                    <TableCell>
                      {exception.reservationNumber ? (
                        <SAPDocumentChip
                          doc={{
                            type: "RESERVATION",
                            documentNumber: exception.reservationNumber,
                            line: exception.reservationItem ?? undefined,
                          }}
                        />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-foreground">
                      {exception.ownerRequesterId ?? (
                        <span
                          className="text-muted-foreground"
                          title="No requester could be resolved, so this exception has never been routed and cannot escalate."
                        >
                          Unresolved
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={STATUS_TONE[exception.status]}>
                        {STATUS_LABEL[exception.status]}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatApiDateTime(exception.detectedAt)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatApiDateTime(exception.requesterDueAt)}
                    </TableCell>
                    <TableCell
                      className="text-right"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!canConfirm || isPending}
                        onClick={() => setConfirming(exception)}
                        title={
                          canConfirm
                            ? "Record a structured confirmation against this exception"
                            : "Only an exception that was routed to somebody can be confirmed — this one has no owner, so nobody was asked."
                        }
                      >
                        Confirm
                      </Button>
                    </TableCell>
                  </TableRow>
                  <TableRow className="hover:bg-transparent">
                    <TableCell className="p-0" />
                    <TableCell colSpan={9} className="p-0">
                      <div
                        className={cn(
                          "grid transition-[grid-template-rows] duration-300 ease-out",
                          isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                        )}
                      >
                        <div className="min-h-0 overflow-hidden">
                          <div className="bg-muted/30 px-4 py-3">
                            {isExpanded && <ExceptionDetail exception={exception} />}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                </Fragment>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {confirming && (
        <ConfirmExceptionDialog
          exception={confirming}
          reasonCategories={reasonCategories}
          submitting={isPending}
          onCancel={() => setConfirming(null)}
          onSubmit={(formData) => submit(confirming.exceptionId, formData)}
        />
      )}
    </div>
  )
}

/** The evidence the backend recorded, and the routing state, in full. */
function ExceptionDetail({ exception }: { exception: ActException }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-foreground">{exception.reason}</p>

      {Object.keys(exception.evidence).length > 0 && (
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-[11px]">
          {Object.entries(exception.evidence).map(([key, value]) => (
            <div key={key} className="flex gap-1.5">
              <dt className="text-muted-foreground">{key.replaceAll("_", " ")}</dt>
              <dd className="text-foreground">{value}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="flex flex-wrap gap-x-6 gap-y-1 text-[11px]">
        <span className="text-muted-foreground">
          Routing: <span className="text-foreground">{exception.routingStatus ?? "—"}</span>
        </span>
        <span className="text-muted-foreground">
          Assignee:{" "}
          <span className="text-foreground">
            {exception.currentAssigneeId
              ? `${exception.currentAssigneeId} (${exception.currentAssigneeType ?? "?"})`
              : "—"}
          </span>
        </span>
        {exception.escalatedAt && (
          <span className="text-muted-foreground">
            Escalated:{" "}
            <span className="text-foreground">
              {formatApiDateTime(exception.escalatedAt)}
            </span>
          </span>
        )}
      </div>

      {exception.status === "OPEN" && (
        <AlertBanner tone="warning" title="This exception has never been routed">
          No requester could be resolved for it, so nobody has been asked to
          confirm and the escalation clock has not started. Detection resolves an
          owner from the consumption plan first and from the reservation&rsquo;s
          goods recipient second — where neither is available, or where the two
          disagree, the exception is deliberately left unowned rather than
          assigned to a guess.
        </AlertBanner>
      )}

      {exception.exceptionType === "NO_PLAN" && (
        <p className="text-[11px] text-muted-foreground">
          A consumption plan captured through the assistant cannot clear this
          exception yet: the reservation field carrying the session identifier
          (<code className="font-mono">RESB.BEDNR</code>) is not exposed on the
          SAP entity set, so a captured plan has no reservation to attach to. The
          backend has a test asserting this, which will fail the day the field
          lands — that is the signal to finish the link.
        </p>
      )}
    </div>
  )
}
