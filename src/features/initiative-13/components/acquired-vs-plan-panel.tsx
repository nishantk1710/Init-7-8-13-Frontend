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
import type { PlanVsIssuedRow } from "@/lib/api/i13"
import { formatApiDate } from "@/lib/api/format"
import { planVsIssuedRowsToCsv } from "@/features/initiative-13/utils/dashboard-transforms"
import {
  badgeTone,
  PLAN_VS_ISSUED_STATUS_LABEL,
  PLAN_VS_ISSUED_STATUS_ORDER,
  PLAN_VS_ISSUED_STATUS_TONE,
} from "@/features/initiative-13/utils/status-labels"
import { SegmentedTabs } from "@/features/initiative-13/components/ui/segmented-tabs"
import { ToolbarRow } from "@/features/initiative-13/components/ui/oar-scope"
import { downloadExcel, formatCount, formatQuantity } from "@/lib/utils"
import { MaterialName } from "@/components/shared/material-name"
import { sapPlantLabel } from "@/lib/shared-data/sap-plants"

/** Acquired vs required (FR-6/FR-10 "acquired versus plan"), one view at a
 * time behind a switch, like the Ledger's Reservations | Procurement lines:
 * **Direct from SAP** (OAR reservations raised directly in SAP, the default)
 * or **Via assistant** (plans captured in the assistant). Each row is required
 * (asked for: the reservation's reserved quantity, or the plan's) against
 * issued (used). A reservation a plan owns is on that plan's row only. Issued is
 * the goods issue, never a receipt -- OAR is issued from stock. Statuses and the
 * Overdue marker are the backend's, rendered as-is.
 *
 * Each view has its own filters: Overdue (Planned Consumption Overdue) only on
 * Via assistant, and no "Awaiting reservation" status on Direct from SAP, which
 * has no plan to await one. Switching views clears every filter of the view,
 * Material included (the server page builds those links). The switch shows both
 * views' totals under the page's own filters. One server page of 25, latest
 * required-by date first. */
export function AcquiredVsPlanPanel({
  view,
  table,
  filters,
  viewHrefs,
  viewTotals,
}: {
  view: "SAP" | "ASSISTANT"
  table: PlanVsIssuedTable
  filters: PlanVsIssuedFilters
  viewHrefs: { SAP: string; ASSISTANT: string }
  viewTotals: { SAP: number; ASSISTANT: number } | null
}) {
  const assistant = view === "ASSISTANT"
  const label = (name: string, total: number | undefined) =>
    total === undefined ? name : `${name} (${formatCount(total)})`
  return (
    <div className="flex flex-col gap-3">
      <ToolbarRow>
        <SegmentedTabs
          label="Acquired vs required view"
          tabs={[
            { href: viewHrefs.SAP, label: label("Direct from SAP", viewTotals?.SAP), active: !assistant },
            { href: viewHrefs.ASSISTANT, label: label("Via assistant", viewTotals?.ASSISTANT), active: assistant },
          ]}
        />
        <I13UrlFilters
          fields={assistant ? ["planMaterial", "planStatus", "overdue", "reservation"] : ["planMaterial", "planStatus", "reservation"]}
          planStatuses={assistant ? PLAN_VS_ISSUED_STATUS_ORDER : SAP_STATUSES}
          pin={assistant ? { tab: "plan", planView: "assistant" } : { tab: "plan" }}
        />
      </ToolbarRow>
      {assistant ? (
        <PlanVsIssuedSection
          subtitle="Plans captured in the assistant"
          table={table}
          filters={{ ...filters, source: "ASSISTANT" }}
          withOverdue
          empty="No plans from the assistant for the selected filters."
        />
      ) : (
        <PlanVsIssuedSection
          subtitle="OAR reservations raised in SAP without the assistant: no consumption plan, so never overdue"
          table={table}
          filters={{ ...filters, source: "SAP", overdue: undefined }}
          withOverdue={false}
          empty="No SAP reservations for the selected filters."
        />
      )}
    </div>
  )
}

/** A SAP reservation has no plan, so it is never awaiting one. */
const SAP_STATUSES = PLAN_VS_ISSUED_STATUS_ORDER.filter((s) => s !== "NO_RESERVATION")

/** One table's page, its total under the filters and its pager. */
export type PlanVsIssuedTable = {
  rows: PlanVsIssuedRow[]
  total: number | null
  /** Overdue count, for the Via assistant caption. */
  overdue?: number | null
  /**
   * The pager, rendered by the server page and handed in as a node. Not built
   * here from an hrefFor function: a function cannot cross from a server
   * component to a client one, and passing one made the dashboard fail to
   * render at all.
   */
  pagination: ReactNode
  /** Why this table could not load, when it could not. */
  error?: string | null
}

function PlanVsIssuedSection({
  subtitle,
  table,
  filters,
  withOverdue,
  empty,
}: {
  subtitle: string
  table: PlanVsIssuedTable
  filters: PlanVsIssuedFilters
  withOverdue: boolean
  empty: string
}) {
  async function exportExcel() {
    downloadExcel(
      `i13-acquired-vs-required-${withOverdue ? "assistant" : "sap"}.xlsx`,
      [
        "Source",
        "Material",
        "Plant",
        "Reservation",
        "Required qty",
        "Issued qty",
        "Status",
        "Required by",
        ...(withOverdue ? ["Overdue"] : []),
      ],
      planVsIssuedRowsToCsv(await exportPlanVsIssuedRows(filters)).map((row) => (withOverdue ? row : row.slice(0, -1)))
    )
  }

  const shown = table.total ?? table.rows.length
  const overdue = withOverdue ? (table.overdue ?? null) : null

  return (
    <section className="flex flex-col gap-2" aria-label={subtitle}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <p className="text-[11px] text-muted-foreground">
            {subtitle} · {formatCount(shown)} row{shown === 1 ? "" : "s"}
            {overdue !== null && overdue > 0 && <> · {formatCount(overdue)} overdue</>}, latest required-by date first
          </p>
        </div>
        <ExportButton label="Export Excel" onExport={exportExcel} />
      </div>
      {table.error ? (
        <EmptyState title={`Unable to load these rows: ${table.error}`} />
      ) : table.rows.length === 0 && !table.total ? (
        <EmptyState title={empty} />
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
                  note={
                    withOverdue
                      ? "What was required: the quantity in the consumption plan"
                      : "What was required: the SAP reservation's reserved quantity"
                  }
                >
                  Required
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
              {table.rows.map((r) => (
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
                  {/* The backend's quantity strings, without the trailing ".000"; real fractions kept. */}
                  <TableCell className="text-right text-foreground"><span className="whitespace-nowrap tabular-nums">{formatQuantity(r.plannedQuantity)}</span></TableCell>
                  <TableCell className="text-right text-foreground"><span className="whitespace-nowrap tabular-nums">{formatQuantity(r.issuedQuantity)}</span></TableCell>
                  <TableCell>
                    <div
                      className="flex flex-wrap items-center gap-1"
                      title={r.dueDate ? `Required by ${formatApiDate(r.dueDate)}` : "No required-by date recorded"}
                    >
                      <StatusBadge tone={badgeTone(PLAN_VS_ISSUED_STATUS_TONE[r.status])}>
                        {PLAN_VS_ISSUED_STATUS_LABEL[r.status]}
                      </StatusBadge>
                      {withOverdue && r.overdue && (
                        <span title="Planned Consumption Overdue: the usage window has ended with nothing issued, so an exception is raised for the requester.">
                          <StatusBadge tone="danger">Overdue</StatusBadge>
                        </span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </StickyScrollTable>
        </div>
      )}
      {table.pagination}
    </section>
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
