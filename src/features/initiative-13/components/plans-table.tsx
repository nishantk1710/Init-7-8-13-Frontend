"use client"

import Link from "next/link"
import { MessagesSquare } from "lucide-react"

import { AskAssistantLink } from "@/components/assistant/ask-assistant-link"
import { EmptyState } from "@/components/shared/empty-state"
import { SAPDocumentChip } from "@/components/shared/sap-document-chip"
import { StatusBadge } from "@/components/shared/status-badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatApiDate, formatApiDateTime } from "@/lib/api/format"
import type { ConsumptionPlan } from "@/lib/api/i13"

/**
 * Consumption plans captured through the assistant — FR-4's record.
 *
 * Every row was stated by a person in a conversation: a purpose, a quantity,
 * a window, and where known a cost centre or order. The 742 `REFERENCE_CSV`
 * rows that most acquired-versus-plan figures still rest on are not here, and
 * that separation is the whole value of the screen.
 *
 * ## Why the session column is the important one
 *
 * FR-4 asks for traceability from a plan back to the advice that shaped it. The
 * session identifier is that link, and it is the only one that exists: the
 * reservation cannot carry it yet, because the field that would
 * (`RESB.BEDNR`) is not exposed on the SAP entity set. So a plan links forward
 * to its conversation and not yet to its reservation, and the empty
 * reservation column is the honest picture of that.
 */
export function PlansTable({ plans }: { plans: ConsumptionPlan[] }) {
  if (plans.length === 0) {
    return (
      <EmptyState
        title="No consumption plans have been captured yet."
        description="A plan is recorded when somebody completes the OAR flow in the reservation assistant. Until then, every acquired-versus-plan figure on these screens rests on generated reference data."
      />
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Material</TableHead>
            <TableHead>Plant</TableHead>
            <TableHead>Purpose</TableHead>
            <TableHead className="text-right">Planned qty</TableHead>
            <TableHead>Window</TableHead>
            <TableHead>Cost centre / order</TableHead>
            <TableHead>Reservation</TableHead>
            <TableHead>Session</TableHead>
            <TableHead>Captured</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {plans.map((plan) => (
            <TableRow key={plan.id}>
              <TableCell className="font-medium text-foreground">
                <div className="flex flex-col gap-0.5">
                  <span>{plan.material}</span>
                  <AskAssistantLink
                    materialId={plan.material}
                    plant={plan.plant}
                    variant="chip"
                    label="Ask"
                  />
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">{plan.plant}</TableCell>
              <TableCell className="max-w-[260px] text-foreground">{plan.purpose}</TableCell>
              <TableCell className="text-right text-foreground">
                {/* Rendered as the string the backend sent. A planned quantity
                    round-tripped through a JS number is not the number that was
                    recorded, and this one is read by a compliance engine. */}
                {plan.plannedQuantity}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {plan.windowStart || plan.windowEnd ? (
                  <>
                    {formatApiDate(plan.windowStart)} → {formatApiDate(plan.windowEnd)}
                  </>
                ) : (
                  <span title="No window was given. A plan with no window end cannot breach — there is nothing to measure against.">
                    Not given
                  </span>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {plan.costCentre ?? plan.orderNumber ?? "—"}
              </TableCell>
              <TableCell>
                {plan.reservationNumber ? (
                  <SAPDocumentChip
                    doc={{
                      type: "RESERVATION",
                      documentNumber: plan.reservationNumber,
                      line: plan.reservationItem ?? undefined,
                    }}
                  />
                ) : (
                  <span
                    className="text-muted-foreground"
                    title="The reservation does not exist yet when the plan is captured, and the field that would carry the session identifier back (RESB.BEDNR) is not exposed on the SAP entity set."
                  >
                    Not linked
                  </span>
                )}
              </TableCell>
              <TableCell>
                <Link
                  href={`/assistant/sessions/${encodeURIComponent(plan.sessionId)}`}
                  className="inline-flex items-center gap-1 text-[11px] text-primary underline-offset-4 hover:underline"
                >
                  <MessagesSquare className="size-3" aria-hidden />
                  Trace
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">
                <div className="flex flex-col gap-0.5">
                  <span>{formatApiDateTime(plan.capturedAt)}</span>
                  <span className="text-[11px]">{plan.capturedBy}</span>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

/** A small count badge for the dashboard section header. */
export function CapturedPlanBadge({ count }: { count: number }) {
  return (
    <StatusBadge tone={count > 0 ? "success" : "warning"}>
      {count > 0 ? `${count} captured` : "None captured yet"}
    </StatusBadge>
  )
}
