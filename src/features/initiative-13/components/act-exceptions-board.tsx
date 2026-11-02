"use client"

import { Fragment, useState, useTransition } from "react"
import Link from "next/link"
import { CircleHelp, MessagesSquare } from "lucide-react"
import { toast } from "sonner"

import { EmptyState } from "@/components/shared/empty-state"
import { EmptyValue } from "@/features/initiative-13/components/empty-value"
import { DataTable, RowToggle, FITTED_TABLE } from "@/features/initiative-13/components/ui/data-table"
import { StatusPill } from "@/features/initiative-13/components/ui/status-pill"
import { relativeDue, type DisplayTone } from "@/features/initiative-13/utils/oar-display"
import { EMPTY_LABEL } from "@/features/initiative-13/utils/empty-labels"
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
import {
  EXCEPTION_STATUS_HINT,
  EXCEPTION_STATUS_LABEL,
  EXCEPTION_TYPE_HINT,
  EXCEPTION_TYPE_LABEL,
} from "@/features/initiative-13/utils/status-labels"
import { cn } from "@/lib/utils"
import { MaterialName } from "@/components/shared/material-name"
import { sapPlantLabel } from "@/lib/shared-data/sap-plants"

/** High-risk types red, medium amber -- the same split the risk badge used. */
const TYPE_TONE: Record<ActExceptionType, DisplayTone> = {
  PLAN_BREACH: "urgent",
  NO_PLAN: "caution",
  NO_PLAN_GRNI: "urgent",
  QUANTITY_OVERRIDE: "caution",
}

const STATUS_TONE: Record<ActExceptionStatus, DisplayTone> = {
  OPEN: "neutral",
  AWAITING_REQUESTER: "caution",
  CONFIRMED: "healthy",
  ESCALATED: "urgent",
  RESOLVED: "healthy",
}

/** `evidence.no_plan_reason`, the backend's NoPlanReason, in words. */
const NO_PLAN_REASON_LABEL: Record<string, string> = {
  MISSING_SESSION: "No assistant session",
  INVALID_SESSION: "Session not valid",
  SESSION_WITHOUT_PLAN: "Session without a plan",
}

/** A reservation number as a monospace chip: the form a storeman types into SAP. */
function ReservationChip({ number, item }: { number: string; item: string | null }) {
  return (
    <code className="inline-flex items-center rounded-md border border-border bg-muted/40 px-1.5 py-0.5 font-mono text-[11px] font-semibold whitespace-nowrap text-foreground">
      {number}
      {item && <span className="text-muted-foreground">/{item}</span>}
    </code>
  )
}

function DueCell({ dueAt }: { dueAt: string | null }) {
  if (!dueAt) return <EmptyValue kind="noDueDate" />
  const hint = relativeDue(dueAt)
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-foreground">{formatApiDateTime(dueAt)}</span>
      {hint && (
        <span className={cn("text-xs font-semibold", hint.overdue ? "text-destructive" : "text-warning")}>
          {hint.label}
        </span>
      )}
    </div>
  )
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
      <DataTable className={FITTED_TABLE}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <span className="sr-only">Details</span>
              </TableHead>
              <TableHead>Material</TableHead>
              <TableHead>Type</TableHead>
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
              // The state machine allows a confirmation only from
              // AWAITING_REQUESTER: ESCALATED goes on to RESOLVED and nothing
              // else. Mirrored here so the button explains itself rather than
              // producing a 422 on click.
              const canConfirm = exception.status === "AWAITING_REQUESTER"
              return (
                <Fragment key={exception.exceptionId}>
                  <TableRow
                    className="cursor-pointer"
                    onClick={() =>
                      setExpandedId(isExpanded ? null : exception.exceptionId)
                    }
                  >
                    <TableCell className="px-1">
                      <RowToggle
                        expanded={isExpanded}
                        onToggle={() => setExpandedId(isExpanded ? null : exception.exceptionId)}
                        label={`${EXCEPTION_TYPE_LABEL[exception.exceptionType]} exception on material ${exception.material}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium text-foreground">
                      <div className="flex flex-col gap-0.5">
                        <MaterialName material={exception.material} description={exception.materialDescription} />
                        <span
                          className="flex items-center gap-1"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {/* The exception's OWN session, where it has one —
                              a plan breach or a quantity override knows the
                              exact conversation it came from, which is a
                              stronger link than a material+plant lookup. */}
                          {exception.sessionId ? (
                            <Link
                              href={`/assistant/sessions/${encodeURIComponent(exception.sessionId)}`}
                              className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-xs font-medium text-action transition-colors hover:bg-action/10"
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
                    <TableCell>
                      <StatusPill
                        tone={TYPE_TONE[exception.exceptionType]}
                        title={EXCEPTION_TYPE_HINT[exception.exceptionType]}
                        className="h-auto py-0.5 leading-tight whitespace-normal"
                      >
                        {EXCEPTION_TYPE_LABEL[exception.exceptionType]}
                      </StatusPill>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {sapPlantLabel(exception.plant)}
                    </TableCell>
                    <TableCell>
                      {exception.reservationNumber ? (
                        <ReservationChip number={exception.reservationNumber} item={exception.reservationItem} />
                      ) : (
                        <EmptyValue kind="noReservationLinked" />
                      )}
                    </TableCell>
                    <TableCell className="font-semibold text-foreground">
                      {exception.ownerRequesterId ?? (
                        <span
                          className="font-semibold text-destructive"
                          title="No requester could be resolved, so this exception has never been routed and cannot escalate."
                        >
                          Unresolved
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusPill tone={STATUS_TONE[exception.status]} title={EXCEPTION_STATUS_HINT[exception.status]} className="h-auto py-0.5 leading-tight whitespace-normal">
                        {EXCEPTION_STATUS_LABEL[exception.status]}
                      </StatusPill>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatApiDateTime(exception.detectedAt)}
                    </TableCell>
                    <TableCell>
                      <DueCell dueAt={exception.requesterDueAt} />
                    </TableCell>
                    <TableCell
                      className="text-right"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 min-h-9! px-3 font-semibold"
                        disabled={!canConfirm || isPending}
                        onClick={() => setConfirming(exception)}
                        title={
                          canConfirm
                            ? "Record a structured confirmation against this exception"
                            : CONFIRM_BLOCKED_HINT[exception.status]
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
                          <div className="bg-muted/40 px-4 py-5">
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
      </DataTable>

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
  const noPlanReason = exception.evidence.no_plan_reason
  const otherEvidence = Object.entries(exception.evidence).filter(([key]) => key !== "no_plan_reason")
  const whyNot = whyCannotClear(exception)
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill tone={TYPE_TONE[exception.exceptionType]}>
            {EXCEPTION_TYPE_LABEL[exception.exceptionType]}
          </StatusPill>
          <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
            {exception.exceptionType}
          </code>
        </div>
        <h3 className="text-base font-semibold whitespace-normal text-foreground">{EXCEPTION_HEADING[exception.exceptionType]}</h3>
        {/* Detection's own wording, kept for whoever traces a row back to the run. */}
        <p className="text-xs whitespace-normal text-muted-foreground">Detection note: {exception.reason}</p>
      </div>

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Reservation">
          {exception.reservationNumber ? (
            <ReservationChip number={exception.reservationNumber} item={exception.reservationItem} />
          ) : (
            <EmptyValue kind="noReservationLinked" />
          )}
        </Tile>
        <Tile label="No-plan reason">
          {noPlanReason ? (
            <span title={noPlanReason}>{NO_PLAN_REASON_LABEL[noPlanReason] ?? noPlanReason.replaceAll("_", " ").toLowerCase()}</span>
          ) : (
            <span className="text-muted-foreground">Not applicable</span>
          )}
        </Tile>
        <Tile label="Routing">{exception.routingStatus ?? EMPTY_LABEL.notRouted.label}</Tile>
        <Tile label="Assignee">
          {exception.currentAssigneeId
            ? exception.currentAssigneeType
              ? `${exception.currentAssigneeId} (${exception.currentAssigneeType})`
              : exception.currentAssigneeId
            : EMPTY_LABEL.unassigned.label}
          {exception.escalatedAt && (
            <span className="mt-0.5 block text-xs font-medium text-destructive">
              Escalated {formatApiDateTime(exception.escalatedAt)}
            </span>
          )}
        </Tile>
      </dl>

      {otherEvidence.length > 0 && (
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
          {otherEvidence.map(([key, value]) => (
            <div key={key} className="flex gap-1.5">
              <dt className="text-muted-foreground">{key.replaceAll("_", " ")}</dt>
              <dd className="font-semibold text-foreground">{value}</dd>
            </div>
          ))}
        </dl>
      )}

      {whyNot.length > 0 && (
        <section className="rounded-xl border border-attention-line bg-attention p-4 text-attention-ink">
          <h4 className="flex items-center gap-2 text-sm font-semibold">
            <CircleHelp aria-hidden className="size-4 shrink-0" />
            Why this cannot clear yet
          </h4>
          <div className="mt-2 flex flex-col gap-2 text-sm leading-relaxed whitespace-normal">{whyNot}</div>
        </section>
      )}
    </div>
  )
}

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-card p-3">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm font-semibold whitespace-normal text-foreground">{children}</dd>
    </div>
  )
}

/** The expanded row's heading: what the exception is, in words, not detection's own text. */
const EXCEPTION_HEADING: Record<ActException["exceptionType"], string> = {
  PLAN_BREACH: "The planned use has passed and nothing was issued",
  NO_PLAN: "OAR reservation with no consumption plan from the assistant",
  NO_PLAN_GRNI: "OAR reservation with no plan, and stock received 30+ days ago is not issued",
  QUANTITY_OVERRIDE: "The requested quantity differs from the assistant's suggestion",
}

/** Why Confirm is disabled, for every status but AWAITING_REQUESTER (the one it is enabled for). */
const CONFIRM_BLOCKED_HINT: Record<ActException["status"], string> = {
  OPEN: "Only an exception that was routed to somebody can be confirmed — this one has no owner, so nobody was asked.",
  AWAITING_REQUESTER: "",
  ESCALATED:
    "The requester's 5-day window has passed and it has moved to the HOD, so a requester reason can no longer be recorded.",
  CONFIRMED: "A reason has already been recorded for this exception.",
  RESOLVED: "This exception is closed.",
}

/** What the no-plan reason means, for a NO_PLAN or NO_PLAN_GRNI exception. */
const NO_PLAN_REASON_TEXT: Record<string, string> = {
  MISSING_SESSION:
    "The reservation's item text carries no assistant session or request reference, so it was made without the assistant and has no consumption plan.",
  INVALID_SESSION:
    "The reservation's item text names an assistant session or request reference that does not match this material. Check the reference typed into SAP.",
  SESSION_WITHOUT_PLAN:
    "The reservation is linked to an assistant session, but that session recorded no consumption plan (for example, a line marked not needed).",
}

/** What closes each type of exception. Detection closes it on its next run once this holds. */
const CLEARS_WHEN: Record<ActException["exceptionType"], string> = {
  PLAN_BREACH: "It closes when a goods issue is recorded for the planned reservation, or the plan is closed.",
  NO_PLAN:
    "It closes when the reservation is linked to an assistant session with a plan, or is deleted in SAP. Issuing the material does not close it.",
  NO_PLAN_GRNI:
    "It closes when the reservation is linked to an assistant session with a plan, is deleted in SAP, or this material at this plant no longer has stock received 30+ days ago and not issued.",
  QUANTITY_OVERRIDE: "It does not close by itself: the requester records why they chose a different quantity.",
}

/** What is holding the exception open, from the text the board already carried. */
function whyCannotClear(exception: ActException): React.ReactNode[] {
  const reasons: React.ReactNode[] = []
  if (exception.status === "OPEN") {
    reasons.push(
      <p key="open">
        <strong>Requester not identified.</strong> No requester could be resolved for it, so nobody has been asked to
        confirm and the escalation clock has not started. Detection takes the owner from the assistant session first
        and from the SAP reservation&rsquo;s goods recipient second — where neither names anyone, or SAP names more
        than one goods recipient for the line, the exception is deliberately left unowned rather than assigned to a
        guess.
      </p>
    )
  } else if (exception.status !== "RESOLVED") {
    reasons.push(<p key="status">{EXCEPTION_STATUS_HINT[exception.status]}.</p>)
  }
  if (exception.status === "CONFIRMED" || exception.status === "RESOLVED") return reasons
  const noPlanReason = exception.evidence.no_plan_reason
  if (noPlanReason && NO_PLAN_REASON_TEXT[noPlanReason]) {
    reasons.push(<p key="no-plan">{NO_PLAN_REASON_TEXT[noPlanReason]}</p>)
  }
  reasons.push(<p key="clears">{CLEARS_WHEN[exception.exceptionType]}</p>)
  return reasons
}
