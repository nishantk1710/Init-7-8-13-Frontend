"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { MessagesSquare } from "lucide-react"
import { EmptyState } from "@/components/shared/empty-state"
import { SAPDocumentChip } from "@/components/shared/sap-document-chip"
import { StatusBadge } from "@/components/shared/status-badge"
import { EmptyValue } from "@/features/initiative-13/components/empty-value"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ExportButton } from "@/features/initiative-13/components/export-button"
import { I13UrlFilters } from "@/features/initiative-13/components/url-filters"
import type { PlanVsIssuedFilters } from "@/features/initiative-13/data/live-loaders"
import { exportPlanVsIssuedRows } from "@/features/initiative-13/export-actions"
import type { PlanVsIssuedCounts, PlanVsIssuedRow } from "@/lib/api/i13"
import { formatApiDate } from "@/lib/api/format"
import { planVsIssuedRowsToCsv } from "@/features/initiative-13/utils/dashboard-transforms"
import {
  badgeTone,
  PLAN_VS_ISSUED_SOURCE_LABEL,
  PLAN_VS_ISSUED_STATUS_LABEL,
  PLAN_VS_ISSUED_STATUS_TONE,
} from "@/features/initiative-13/utils/status-labels"
import { downloadExcel, formatCount } from "@/lib/utils"
import { MaterialName } from "@/components/shared/material-name"
import { sapPlantLabel } from "@/lib/shared-data/sap-plants"

/** Acquired vs plan (§9), reservation by reservation: every captured plan
 * ("via assistant": planned against what was issued on its reservations) and
 * every OAR reservation raised directly in SAP (reserved against what was
 * issued on it). A reservation a plan owns is on that plan's row only. Issued
 * is the goods issue, never a receipt -- OAR is issued from stock. Statuses
 * are the backend's, rendered as-is. One server page of 25, latest due date
 * first; the export fetches every row the filters match. */
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
        "Session",
        "Planned / reserved qty",
        "Issued qty",
        "Variance qty",
        "Variance %",
        "Status",
        "Required by",
      ],
      planVsIssuedRowsToCsv(await exportPlanVsIssuedRows(filters))
    )
  }

  const shown = total ?? rows.length
  const assistant = counts?.bySource.ASSISTANT ?? null
  const sap = counts?.bySource.SAP ?? null

  return (
    <div className="flex flex-col gap-3">
      <I13UrlFilters fields={["source", "planStatus", "reservation"]} pin={{ tab: "plan" }} />
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] text-muted-foreground">
          {formatCount(shown)} row{shown === 1 ? "" : "s"}
          {assistant !== null && sap !== null && (
            <>
              {" "}
              ({formatCount(assistant)} via assistant, {formatCount(sap)} direct from SAP)
            </>
          )}
          , latest required-by date first
        </p>
        <ExportButton label="Export Excel" onExport={exportExcel} />
      </div>
      {rows.length === 0 && !total ? (
        <EmptyState title="No plans or reservations for the selected filters." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source</TableHead>
                <TableHead>Material</TableHead>
                <TableHead>Plant</TableHead>
                <TableHead>Reservation</TableHead>
                <TableHead>Session</TableHead>
                <TableHead className="text-right" title="A plan's planned quantity, or a SAP reservation's reserved quantity">
                  Planned / Reserved
                </TableHead>
                <TableHead
                  className="text-right"
                  title="Goods issued on the reservation(s), reversals netted. A goods issue, not a receipt: OAR is issued from stock."
                >
                  Issued
                </TableHead>
                <TableHead className="text-right">Variance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Required by</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.rowId}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {PLAN_VS_ISSUED_SOURCE_LABEL[r.source]}
                  </TableCell>
                  <TableCell>
                    <MaterialName material={r.material} description={r.materialDescription} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{sapPlantLabel(r.plant)}</TableCell>
                  <TableCell>
                    <Reservations reservations={r.reservations} />
                  </TableCell>
                  <TableCell>
                    {r.sessionId ? (
                      <Link
                        href={`/assistant/sessions/${encodeURIComponent(r.sessionId)}`}
                        className="inline-flex items-center gap-1 text-[11px] text-primary underline-offset-4 hover:underline"
                      >
                        <MessagesSquare className="size-3" aria-hidden />
                        {r.sessionId}
                      </Link>
                    ) : (
                      <EmptyValue kind="noSession" />
                    )}
                  </TableCell>
                  {/* Rendered as the strings the backend sent, as on the plans table. */}
                  <TableCell className="text-right text-foreground">{r.plannedQuantity}</TableCell>
                  <TableCell className="text-right text-foreground">
                    {r.status === "NO_RESERVATION" ? <EmptyValue kind="noReservationYet" /> : r.issuedQuantity}
                  </TableCell>
                  <TableCell className="text-right text-foreground">
                    <Variance row={r} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={badgeTone(PLAN_VS_ISSUED_STATUS_TONE[r.status])}>
                      {PLAN_VS_ISSUED_STATUS_LABEL[r.status]}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {r.dueDate ? formatApiDate(r.dueDate) : <EmptyValue kind="notRecorded" />}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {pagination}
    </div>
  )
}

/** One reservation as a chip; several as a count, listed on hover. */
function Reservations({ reservations }: { reservations: string[] }) {
  if (reservations.length === 0) return <EmptyValue kind="noReservationYet" />
  if (reservations.length > 1) {
    return (
      <span className="text-[11px] text-muted-foreground" title={reservations.join(", ")}>
        {reservations.length} reservations
      </span>
    )
  }
  const [number, item] = reservations[0].split("/")
  return <SAPDocumentChip doc={{ type: "RESERVATION", documentNumber: number, line: item }} />
}

/** A label, not a number, when there is nothing to vary against yet. */
function Variance({ row }: { row: PlanVsIssuedRow }) {
  if (row.status === "NO_RESERVATION") return <EmptyValue kind="noReservationYet" />
  if (row.status === "NOT_DUE" || row.varianceQuantity === null) return <EmptyValue kind="notDueYet" />
  const n = Number(row.varianceQuantity)
  return (
    <>
      {n > 0 ? "+" : ""}
      {row.varianceQuantity}
      {row.variancePercentage !== null && (
        <span className="text-muted-foreground"> ({Math.round(row.variancePercentage)}%)</span>
      )}
    </>
  )
}
