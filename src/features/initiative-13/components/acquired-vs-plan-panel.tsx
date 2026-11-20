"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { EmptyState } from "@/components/shared/empty-state"
import { StatusBadge } from "@/components/shared/status-badge"
import { EmptyValue } from "@/features/initiative-13/components/empty-value"
import { StickyScrollTable } from "@/components/shared/sticky-scroll-table"
import {
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ColumnHead } from "@/features/initiative-13/components/ui/column-head"
import { ExportButton } from "@/features/initiative-13/components/export-button"
import { I13UrlFilters } from "@/features/initiative-13/components/url-filters"
import type { PlanVsIssuedFilters } from "@/features/initiative-13/data/live-loaders"
import { exportPlanVsIssuedRows } from "@/features/initiative-13/export-actions"
import type { PlanVsIssuedCounts, PlanVsIssuedRow } from "@/lib/api/i13"
import { formatApiDate } from "@/lib/api/format"
import { planVsIssuedRowsToCsv } from "@/features/initiative-13/utils/dashboard-transforms"
import {
  badgeTone,
  PLAN_VS_ISSUED_STATUS_LABEL,
  PLAN_VS_ISSUED_STATUS_TONE,
} from "@/features/initiative-13/utils/status-labels"
import { downloadExcel, formatCount } from "@/lib/utils"
import { MaterialName } from "@/components/shared/material-name"
import { sapPlantLabel } from "@/lib/shared-data/sap-plants"

/** Acquired vs plan (§9), reservation by reservation: every captured plan
 * ("via assistant") and every OAR reservation raised directly in SAP, read the
 * same way -- planned (asked for: the plan's quantity, or the reservation's
 * reserved one) against issued (used). A reservation a plan owns is on that
 * plan's row only. Issued is the goods issue, never a receipt -- OAR is issued
 * from stock. Statuses and the Overdue marker are the backend's, rendered
 * as-is.
 *
 * Kept to four columns on purpose: the source is a filter, and each row links
 * to its reservation in the Utilization Ledger, which holds the rest (dates,
 * PR/PO, every movement). The required-by date shows on the status's hover,
 * since "Not due yet" and "Overdue" mean nothing without it. The export keeps
 * the full detail. One server page of 25, latest required-by date first. */
export function AcquiredVsPlanPanel({
  rows,
  total,
  counts,
  pagination,
  filters,
}: {
  rows: PlanVsIssuedRow[]
  total: number | null
  counts: PlanVsIssuedCounts | null
  /**
   * The pager, rendered by the server page and handed in as a node. Not built
   * here from an `hrefFor` function: a function cannot cross from a server
   * component to a client one, and passing one made the dashboard fail to
   * render at all.
   */
  pagination: ReactNode
  filters: PlanVsIssuedFilters
}) {
  async function exportExcel() {
    downloadExcel(
      "i13-acquired-vs-plan.xlsx",
      [
        "Source",
        "Material",
        "Plant",
        "Reservation",
        "Planned qty",
        "Issued qty",
        "Status",
        "Required by",
        "Overdue",
      ],
      planVsIssuedRowsToCsv(await exportPlanVsIssuedRows(filters))
    )
  }

  const shown = total ?? rows.length
  const assistant = counts?.bySource.ASSISTANT ?? null
  const sap = counts?.bySource.SAP ?? null
  const overdue = counts?.overdue ?? null

  return (
    <div className="flex flex-col gap-3">
      <I13UrlFilters fields={["source", "planStatus", "overdue", "reservation"]} pin={{ tab: "plan" }} />
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] text-muted-foreground">
          {formatCount(shown)} row{shown === 1 ? "" : "s"}
          {assistant !== null && sap !== null && (
            <>
              {" "}
              ({formatCount(assistant)} via assistant, {formatCount(sap)} direct from SAP)
            </>
          )}
          {overdue !== null && overdue > 0 && <> · {formatCount(overdue)} overdue</>}, latest required-by date first
        </p>
        <ExportButton label="Export Excel" onExport={exportExcel} />
      </div>
      {rows.length === 0 && !total ? (
        <EmptyState title="No plans or reservations for the selected filters." />
      ) : (
        <div className="rounded-xl border border-border">
          <StickyScrollTable widths={[38, 14, 12, 12, 24]} minWidth={720} wrapCells>
            <TableHeader>
              <TableRow>
                <ColumnHead source="material" className="w-[40%]">Material &amp; plant</ColumnHead>
                <ColumnHead source="reservation" className="w-[14%]">Reservation</ColumnHead>
                <ColumnHead
                  source="planned"
                  className="w-[12%] text-right"
                  note="What was asked for: the plan's quantity, or the SAP reservation's reserved quantity"
                >
                  Planned
                </ColumnHead>
                <ColumnHead
                  source="issuedOnReservation"
                  className="w-[12%] text-right"
                  note="What was used: goods issued on the reservation(s), reversals netted. A goods issue, not a receipt: OAR is issued from stock."
                >
                  Issued
                </ColumnHead>
                <ColumnHead source="acquiredVsPlan">Status</ColumnHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.rowId}>
                  <TableCell className="whitespace-normal">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <MaterialName material={r.material} description={r.materialDescription} className="max-w-none" />
                      <span className="text-[11px] text-muted-foreground">{sapPlantLabel(r.plant)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    <ReservationLinks reservations={r.reservations} />
                  </TableCell>
                  {/* Rendered as the strings the backend sent, as on the plans table. */}
                  <TableCell className="text-right text-foreground">{r.plannedQuantity}</TableCell>
                  <TableCell className="text-right text-foreground">{r.issuedQuantity}</TableCell>
                  <TableCell>
                    <div
                      className="flex flex-wrap items-center gap-1"
                      title={r.dueDate ? `Required by ${formatApiDate(r.dueDate)}` : "No required-by date recorded"}
                    >
                      <StatusBadge tone={badgeTone(PLAN_VS_ISSUED_STATUS_TONE[r.status])}>
                        {PLAN_VS_ISSUED_STATUS_LABEL[r.status]}
                      </StatusBadge>
                      {r.overdue && <StatusBadge tone="danger">Overdue</StatusBadge>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </StickyScrollTable>
        </div>
      )}
      {pagination}
    </div>
  )
}

/** The reservation(s) a row stands for, each opening it in the Utilization Ledger. */
function ReservationLinks({ reservations }: { reservations: string[] }) {
  if (reservations.length === 0) return <EmptyValue kind="noReservationYet" />
  const [first, ...rest] = reservations
  const number = first.split("/")[0]
  return (
    <>
      <Link
        href={`/oar-utilization/ledger?view=reservations&reservation=${encodeURIComponent(number)}`}
        className="text-primary underline-offset-4 hover:underline"
        title="Open this reservation in the Utilization Ledger"
      >
        {first}
      </Link>
      {rest.length > 0 && (
        <span className="text-muted-foreground" title={rest.join(", ")}>
          {" "}
          +{rest.length} more
        </span>
      )}
    </>
  )
}
