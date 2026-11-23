"use client"

import Link from "next/link"
import { MessagesSquare } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { SAPDocumentChip } from "@/components/shared/sap-document-chip"
import { StatusBadge } from "@/components/shared/status-badge"
import { StickyScrollTable } from "@/components/shared/sticky-scroll-table"
import {
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ColumnHead } from "@/features/initiative-13/components/ui/column-head"
import { formatApiDate, formatApiDateTime } from "@/lib/api/format"
import type { AcquiredVsPlanStatus, ConsumptionPlan, PlanVsIssuedStatus } from "@/lib/api/i13"
import { EmptyValue } from "@/features/initiative-13/components/empty-value"
import {
  badgeTone,
  PLAN_STATUS_LABEL,
  PLAN_STATUS_TONE,
  PLAN_VS_ISSUED_STATUS_LABEL,
  PLAN_VS_ISSUED_STATUS_TONE,
} from "@/features/initiative-13/utils/status-labels"
import { MaterialName } from "@/components/shared/material-name"
import { PersonName } from "@/components/shared/person-name"
import { sapPlantLabel } from "@/lib/shared-data/sap-plants"
import { formatQuantity } from "@/lib/utils"

/**
 * Consumption plans captured through the assistant — FR-4's record.
 *
 * Every row was stated by a person in a conversation: a purpose, a quantity,
 * and a window. Generated `REFERENCE_CSV`
 * rows, where the backend is configured to read them, are not here, and that
 * separation is the whole value of the screen.
 *
 * ## Why the session column is the important one
 *
 * FR-4 asks for traceability from a plan back to the advice that shaped it. The
 * session identifier is that link. The reservation carries it back through its
 * item text (`RESB.SGTXT`, see the backend's `session_link`), which only arrives
 * with the next SAP extract, so a newly captured plan links forward to its
 * conversation first and to its reservation later. An empty reservation column
 * means that extract has not arrived yet.
 */
export function PlansTable({ plans }: { plans: ConsumptionPlan[] }) {
  if (plans.length === 0) {
    return (
      <EmptyState
        title="No consumption plans have been captured yet."
        description="A plan is recorded when somebody completes the OAR flow in the reservation assistant. Until then, every material and plant reads Non-AI on Acquired vs required."
      />
    )
  }

  return (
    <div className="rounded-xl border border-border">
      <StickyScrollTable widths={[14, 7, 9, 9, 11, 9, 12, 11, 10, 8]} minWidth={1000} wrapCells>
        <TableHeader>
          <TableRow>
            <ColumnHead source="material">Material</ColumnHead>
            <ColumnHead source="plant">Plant</ColumnHead>
            <ColumnHead source="planPurpose">Purpose</ColumnHead>
            <ColumnHead source="planQty" className="text-right">Required qty</ColumnHead>
            <ColumnHead source="planWindow">Window</ColumnHead>
            <ColumnHead
              source="issuedOnReservation"
              className="text-right"
              note="Goods issued against the reservations whose item text carries this plan's session or request ID"
            >
              Issued
            </ColumnHead>
            <ColumnHead source="acquiredVsPlan">Acquired vs required</ColumnHead>
            <ColumnHead source="planReservation">Reservation</ColumnHead>
            <ColumnHead source="planSession">Session</ColumnHead>
            <ColumnHead source="planCaptured">Captured</ColumnHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {plans.map((plan) => (
            <TableRow key={plan.id}>
              <TableCell className="font-medium text-foreground">
                <div className="flex flex-col gap-0.5">
                  <MaterialName material={plan.material} description={plan.materialDescription} />
                </div>
              </TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">{sapPlantLabel(plan.plant)}</TableCell>
              <TableCell className="max-w-[260px] whitespace-normal text-foreground">{plan.purpose}</TableCell>
              <TableCell className="text-right text-foreground">
                {/* Rendered as the string the backend sent. A planned quantity
                    round-tripped through a JS number is not the number that was
                    recorded, and this one is read by a compliance engine. */}
                <span className="whitespace-nowrap tabular-nums">{formatQuantity(plan.plannedQuantity)}</span>
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
              <PlanOutcomeCells plan={plan} />
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
                    title="Not linked yet: no SAP reservation carrying this plan's reference has been loaded. It appears after the next SAP data load."
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
                  <span className="text-[11px]">
                    <PersonName id={plan.capturedBy} />
                  </span>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </StickyScrollTable>
    </div>
  )
}

/**
 * Issued and status for one plan, as the backend measured them. The issued
 * cell names the reservations it was counted on: a plan matched by its window
 * has none in the Reservation column, which shows SGTXT links only.
 */
function PlanOutcomeCells({ plan }: { plan: ConsumptionPlan }) {
  const status = plan.acquiredVsPlanStatus
  if (!status) {
    return (
      <>
        <TableCell className="text-right">
          <EmptyValue kind="notMeasured" />
        </TableCell>
        <TableCell>
          <EmptyValue kind="notMeasured" />
        </TableCell>
      </>
    )
  }
  const reservations = plan.matchedReservations ?? []
  const variance = plan.acquiredVsPlanVarianceQuantity
  const issued = issuedStatus(status, plan.issuedQuantity)
  return (
    <>
      <TableCell className="text-right text-foreground">
        {status === "NO_RESERVATION" ? (
          <EmptyValue kind="noReservationYet" />
        ) : (
          <div className="flex flex-col items-end gap-0.5">
            <span className="whitespace-nowrap tabular-nums">{formatQuantity(plan.issuedQuantity)}</span>
            <span className="text-[11px] text-muted-foreground" title={reservations.join(", ")}>
              on {reservations.length === 1 ? reservations[0] : `${reservations.length} reservations`}
            </span>
          </div>
        )}
      </TableCell>
      <TableCell>
        <div className="flex flex-col items-start gap-0.5">
          <StatusBadge tone={badgeTone(issued.tone)}>{issued.label}</StatusBadge>
          {variance !== null && variance !== undefined && Number(variance) !== 0 && (
            <span className="text-[11px] whitespace-nowrap text-muted-foreground">
              {Number(variance) > 0 ? "+" : ""}
              {formatQuantity(variance)}
            </span>
          )}
        </div>
      </TableCell>
    </>
  )
}

/**
 * The plan's status in the Acquired vs required words: not, partially or fully
 * issued against the required quantity (the backend's on / below / above plan,
 * read with what was issued), or its own words when there is nothing to issue
 * against yet.
 */
function issuedStatus(status: AcquiredVsPlanStatus, issuedQuantity: string | null | undefined) {
  if (status === "NO_RESERVATION" || status === "NO_PLAN") {
    return { label: PLAN_STATUS_LABEL[status], tone: PLAN_STATUS_TONE[status] }
  }
  const key: PlanVsIssuedStatus =
    Number(issuedQuantity ?? 0) <= 0 ? "NOT_ISSUED" : status === "BELOW_PLAN" ? "PARTIALLY_ISSUED" : "FULLY_ISSUED"
  return { label: PLAN_VS_ISSUED_STATUS_LABEL[key], tone: PLAN_VS_ISSUED_STATUS_TONE[key] }
}

/** A small count badge for the dashboard section header. */
export function CapturedPlanBadge({ count }: { count: number }) {
  return (
    <StatusBadge tone={count > 0 ? "success" : "warning"}>
      {count > 0 ? `${count} captured` : "None captured yet"}
    </StatusBadge>
  )
}
