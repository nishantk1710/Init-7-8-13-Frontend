"use client"

import Link from "next/link"
import { useState } from "react"
import { Download, Loader2, X } from "lucide-react"

import { ClearFiltersButton } from "@/components/shared/clear-filters-button"
import { FilterBar } from "@/components/shared/filter-bar"
import { MaterialIdentity } from "@/components/shared/material-identity"
import { StatusBadge } from "@/components/shared/status-badge"
import { TablePagination } from "@/components/shared/table-pagination"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ExceptionDetailDrawer } from "@/features/initiative-8/components/exception-detail-drawer"
import {
  PendingSpinner,
  UrlSearchInput,
  UrlSelect,
  useUrlFilters,
  withSelected,
} from "@/features/initiative-8/components/url-filters"
import {
  ALL_STATUSES,
  DEFAULT_EXCEPTION_STATUS,
  EXCEPTIONS_PATH,
  activeExceptionFilters,
  exceptionsHref,
  fetchAllExceptions,
  type ExceptionFacets,
  type ExceptionFilters,
} from "@/features/initiative-8/data/live-exceptions"
import type {
  ExceptionQueueRow,
  ExceptionQueueSummary,
  ExceptionStatus,
} from "@/features/initiative-8/types/repair"
import {
  EXCEPTION_STATUSES,
  EXCEPTION_STATUS_LABEL,
  EXCEPTION_STATUS_TONE,
  exceptionTypeLabel as labelFor,
} from "@/features/initiative-8/utils/status"
import { cn, downloadExcel } from "@/lib/utils"
import { useMaterial360 } from "@/lib/material-360-context"

/**
 * What each check actually looks for.
 *
 * Written out because a finding nobody can trace to a rule is a finding
 * nobody will act on -- and because not every check below is running, which a
 * reader has to be able to tell apart from "running and found nothing". The
 * screen only shows the rule for checks the backend says it raises; the rest
 * appear under "not running yet". Which those are is read from `typesRaised`
 * rather than written down here, so this does not go stale as checks land.
 */
const HOW_IT_WORKS: Record<string, string> = {
  MISSING_ATTESTATION:
    "A repair PO line with no condition declaration linked to it, matched on the same material and plant within the window below.",
  MISSING_SESSION_ID:
    "An 80-series reservation whose item text (SGTXT) carries no valid Spares Assistant session for that part -- blank, an ID nobody issued, or another part's session.",
  OVERDUE_REPAIR:
    "A repair PO line past its EKET delivery date plus the grace period, with units still at the vendor.",
}

/**
 * The FR-8 checks this queue carries, in the order they read.
 *
 * `UNJUSTIFIED_ACQUISITION` is deliberately not among them since
 * 14-Oct-2026: the reason for a new purchase is asked for at the reservation,
 * by the Spares Assistant (FR-5b), so it is a control rather than a queue
 * item. The rows and the type are dropped in `live-exceptions.ts`, which
 * carries the reasoning; this list is kept in step so the screen does not
 * explain a check it no longer shows.
 */
const ALL_CHECKS = [
  "MISSING_ATTESTATION",
  "OVERDUE_REPAIR",
  "MISSING_SESSION_ID",
] as const

export type ExceptionsTableProps = {
  /** One page of the queue. */
  rows: ExceptionQueueRow[]
  /** Matching the filters, across every page. */
  total: number
  page: number
  pageSize: number
  summary: ExceptionQueueSummary
  facets: ExceptionFacets
  filters: ExceptionFilters
  /** `?id=`: the linked item, fetched by id. Its drawer opens on arrival. */
  initialItem?: ExceptionQueueRow
}

/**
 * The exception queue, one server page at a time.
 *
 * The filters live in the URL and the server pages, searches and counts (see
 * `loadExceptionsPage`). The screen used to load all 5,978 items and filter
 * them here, which made it a 17 MB page.
 *
 * ## Why the drawer keeps its own copy of the item
 *
 * It used to look the item up among the rows on every render, which worked
 * while the rows were the whole queue. They are one page now: moving an item
 * from Open to In progress takes it off an Open-filtered page, and a lookup
 * there would empty the drawer the moment the write landed. So the drawer
 * holds the item it opened with, and the one each write sends back, and only
 * prefers the page's copy while the page still has it.
 */
export function ExceptionsTable({
  rows,
  total,
  page,
  pageSize,
  summary,
  facets,
  filters,
  initialItem,
}: ExceptionsTableProps) {
  const { openMaterial360 } = useMaterial360()
  const { push, isPending } = useUrlFilters(EXCEPTIONS_PATH)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  const [selected, setSelected] = useState<ExceptionQueueRow | undefined>(initialItem)
  const [drawerOpen, setDrawerOpen] = useState(initialItem !== undefined)
  // The page's copy when it has one: that is as fresh as the last refresh.
  const current = selected ? (rows.find((r) => r.id === selected.id) ?? selected) : undefined

  /** A filter change also ends a `?id=` link, which would otherwise re-open
   *  the linked item on every change. */
  function update(patch: Record<string, string | undefined>) {
    push({ ...patch, id: undefined })
  }

  function openItem(row: ExceptionQueueRow) {
    setSelected(row)
    setDrawerOpen(true)
  }

  /** Every match, not the page on screen -- see `fetchAllExceptions`. */
  async function exportExcel() {
    setExporting(true)
    setExportError(null)
    try {
      const all = await fetchAllExceptions(filters)
      const built = await downloadExcel(
        "i08-exception-queue.xlsx",
        [
          "Type",
          "Severity",
          "Material",
          "Description",
          "Plant",
          "Repair Line",
          "Raised At",
          "Open Repair",
          "Pre-automation",
          "Status",
          "Owner",
          "Detail",
        ],
        all.map((row) => [
          row.type,
          row.severity,
          row.material.materialCode,
          row.material.description ?? "",
          row.plant?.name ?? row.plant?.plantId ?? "",
          row.repairLine,
          row.raisedAt ?? "",
          row.isOpenRepair ? "Yes" : "No",
          row.preAutomation ? "Yes" : "No",
          EXCEPTION_STATUS_LABEL[row.status],
          row.owner ?? "",
          row.detail,
        ])
      )
      if (!built) setExportError("The Excel file could not be built.")
    } catch (error) {
      setExportError(error instanceof Error ? error.message : String(error))
    } finally {
      setExporting(false)
    }
  }

  const plantNames = new Map(facets.plants.map((p) => [p.plantId, p.name]))

  const coverage =
    summary.linesChecked > 0
      ? Math.round((summary.linesCovered / summary.linesChecked) * 100)
      : null

  return (
    <div className="flex flex-col gap-4">
      {/* BOTH numbers, always. `total` is the business case -- every historical
          repair line raises this because the control did not exist before the
          platform -- and `actionable` is the work. Either one alone misleads,
          and these numbers end up in status reports. */}
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground">
          <strong className="text-foreground">{summary.actionable}</strong>{" "}
          actionable of {summary.total} raised
          {summary.preAutomation > 0 && (
            <> ({summary.preAutomation} predate the control)</>
          )}
          .{" "}
          {coverage !== null && (
            <span className="text-xs">
              {summary.linesCovered} of {summary.linesChecked} repair lines
              covered ({coverage}%).
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {exportError && (
            <span role="alert" className="text-[11px] text-destructive">
              Export failed: {exportError}
            </span>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => void exportExcel()}
            disabled={exporting || total === 0}
          >
            {exporting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Download className="size-3.5" />
            )}
            Export Excel
          </Button>
        </div>
      </div>

      {/* How each check works.
          An empty count must read as "none found", never as "not built" --
          so the checks that ARE running are separated from the ones that are
          not, by name, rather than both rendering as a zero. */}
      <div className="rounded-xl border border-border p-4">
        <h2 className="text-xs font-medium text-foreground">How each check works</h2>
        <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-2">
          {ALL_CHECKS.filter((t) => summary.typesRaised.includes(t)).map((type) => (
            <div key={type}>
              <dt className="text-xs font-medium text-foreground">
                {labelFor(type)}
              </dt>
              <dd className="mt-0.5 text-xs text-muted-foreground">
                {HOW_IT_WORKS[type]}
              </dd>
            </div>
          ))}
        </dl>

      </div>

      <div className="flex items-center gap-2">
        <FilterBar className="flex-1">
          <UrlSelect
            value={filters.type ?? ""}
            onChange={(value) => update({ type: value })}
            allLabel="All exception types"
            options={withSelected(facets.types, filters.type).map((t) => ({
              value: t,
              label: labelFor(t),
            }))}
            className="sm:w-[260px]"
          />

          <UrlSelect
            value={filters.plant ?? ""}
            onChange={(value) => update({ plant: value })}
            allLabel="All plants"
            options={withSelected(
              facets.plants.map((p) => p.plantId),
              filters.plant
            ).map((id) => ({ value: id, label: plantNames.get(id) ?? id }))}
            className="sm:w-[200px]"
          />

          <UrlSelect
            value={filters.open ? "1" : ""}
            onChange={(value) => update({ open: value || undefined })}
            allLabel="All repairs"
            options={[{ value: "1", label: "Open repairs only" }]}
            className="sm:w-[220px]"
          />

          {/* FR-11: the queue is worked, so it filters by where the work is.
              Starts on OPEN, the first of the four real statuses; the URL
              says `status=all` for every status, and nothing for the default. */}
          <Select
            value={filters.status ?? ALL_STATUSES}
            onValueChange={(v) => {
              const next = v ?? DEFAULT_EXCEPTION_STATUS
              update({ status: next === DEFAULT_EXCEPTION_STATUS ? undefined : next })
            }}
          >
            <SelectTrigger className="h-9 w-full sm:w-[200px]">
              <SelectValue placeholder={EXCEPTION_STATUS_LABEL[DEFAULT_EXCEPTION_STATUS]}>
                {(value: string) =>
                  value === ALL_STATUSES
                    ? "All statuses"
                    : EXCEPTION_STATUS_LABEL[value as ExceptionStatus] ?? value
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {EXCEPTION_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {EXCEPTION_STATUS_LABEL[s]}
                </SelectItem>
              ))}
              <SelectItem value={ALL_STATUSES}>All statuses</SelectItem>
            </SelectContent>
          </Select>

          <UrlSearchInput
            value={filters.q ?? ""}
            onCommit={(value) => update({ q: value })}
            placeholder="Search id, material, document…"
            ariaLabel="Search exceptions"
            className="sm:w-64"
          />

          {/* The register's Exceptions column and the repair detail page link
              here narrowed to one line. Shown, so the narrowing is visible
              and can be taken off without editing the address bar. */}
          {filters.repair && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 gap-1.5"
              onClick={() => update({ repair: undefined })}
              aria-label={`Stop narrowing to repair line ${filters.repair}`}
            >
              Repair line {filters.repair}
              <X className="size-3.5" />
            </Button>
          )}

          <ClearFiltersButton
            activeCount={activeExceptionFilters(filters)}
            onClear={() =>
              update({
                type: undefined,
                plant: undefined,
                open: undefined,
                status: undefined,
                q: undefined,
                repair: undefined,
              })
            }
          />
        </FilterBar>
        <PendingSpinner pending={isPending} />
      </div>

      {total === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No exceptions match these filters.
        </div>
      ) : (
        <div className={cn("overflow-x-auto", isPending && "opacity-60")}>
          <Table>
            <TableHeader>
              {/* Column order follows the Snapshot exception queue, so the two
                  read the same way side by side. Live has no "New purchase"
                  column since 18-Oct-2026: only UNJUSTIFIED_ACQUISITION fills
                  it, and that type is dropped from this queue (see ALL_CHECKS),
                  so it read "—" on every row. The drawer still shows the line
                  whenever a row carries one. */}
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Exception</TableHead>
                <TableHead>Material</TableHead>
                <TableHead>Plant</TableHead>
                <TableHead>Repair Line</TableHead>
                <TableHead>Raised</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer align-top"
                  tabIndex={0}
                  aria-label={`Open ${row.id}`}
                  onClick={() => openItem(row)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      openItem(row)
                    }
                  }}
                >
                  <TableCell className="text-xs font-medium whitespace-nowrap text-foreground">
                    {labelFor(row.type)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={EXCEPTION_STATUS_TONE[row.status]}>
                      {EXCEPTION_STATUS_LABEL[row.status]}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="max-w-[420px] whitespace-normal">
                    <p className="text-xs font-medium text-foreground">{row.title}</p>
                    {/* Says what is missing AND what was searched for -- the
                        part that lets somebody check the finding rather than
                        take it on trust. */}
                    <p className="mt-0.5 text-xs text-muted-foreground">{row.detail}</p>
                    {/* A reason, not a violation: the line predates the
                        control, so nobody could have recorded anything. */}
                    {row.preAutomation && (
                      <StatusBadge className="mt-1.5">
                        Raised before Spares Automation
                      </StatusBadge>
                    )}
                  </TableCell>
                  <TableCell>
                    <MaterialIdentity
                      material={row.material}
                      onOpen={openMaterial360}
                    />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.plant?.name ?? row.plant?.plantId ?? "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col items-start gap-1">
                      {row.repairId ? (
                        <Link
                          href={`/repairable-spares/repair-register/${row.repairId}`}
                          className="text-foreground hover:underline"
                          title="Open this repair line in the register"
                        >
                          {row.repairLine}
                        </Link>
                      ) : (
                        <span className="text-foreground">{row.repairLine}</span>
                      )}
                      <span className="text-[11px] text-muted-foreground">
                        {row.isOpenRepair ? "Repair still open" : "Repair received"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {row.raisedAt ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <TablePagination
        page={page}
        pageSize={pageSize}
        total={total}
        count={rows.length}
        noun="exceptions"
        hrefFor={(p) => exceptionsHref(filters, p)}
      />

      <ExceptionDetailDrawer
        exception={current}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onChanged={setSelected}
      />
    </div>
  )
}
