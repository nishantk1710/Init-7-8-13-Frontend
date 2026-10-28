"use client"

import Link from "next/link"
import { useState, type ReactNode } from "react"
import { Download, Loader2 } from "lucide-react"

import { StickyScrollTable } from "@/components/shared/sticky-scroll-table"
import { TablePagination } from "@/components/shared/table-pagination"
import { Button } from "@/components/ui/button"
import { TableBody, TableHeader, TableRow } from "@/components/ui/table"
import { ExceptionDetailDrawer } from "@/features/initiative-8/components/exception-detail-drawer"
import { FilterChips, MaterialCell, ResultsCard } from "@/features/initiative-8/components/kit/list"
import { StatusDot } from "@/features/initiative-8/components/kit/status"
import { I08Cell as Cell, I08Head as Head } from "@/features/initiative-8/components/kit/table"
import { repairHref } from "@/features/initiative-8/components/repair-register-table"
import { UrlSearchInput, UrlSelect, withSelected } from "@/features/initiative-8/components/url-filters"
import {
  DEFAULT_EXCEPTION_STATUS,
  exceptionsHref,
  fetchAllExceptions,
  type ExceptionFacets,
  type ExceptionFilters,
} from "@/features/initiative-8/data/live-exceptions"
import type { ExceptionQueueRow } from "@/features/initiative-8/types/repair"
import { plantShort } from "@/features/initiative-8/utils/format"
import { EXCEPTION_STATUS_LABEL, exceptionTypeLabel } from "@/features/initiative-8/utils/status"
import { downloadExcel } from "@/lib/utils"

/** Red for the repair that is late, amber for the declaration nobody made. */
export function exceptionTone(type: string): "crit" | "warn" | "neutral" {
  if (type === "OVERDUE_REPAIR") return "crit"
  if (type === "MISSING_ATTESTATION") return "warn"
  return "neutral"
}

export type ExceptionsTableProps = {
  /** One page of the queue. */
  rows: ExceptionQueueRow[]
  /** Matching the filters, across every page. */
  total: number
  page: number
  pageSize: number
  facets: ExceptionFacets
  filters: ExceptionFilters
  /** `?id=`: the linked item, fetched by id. Its drawer opens on arrival. */
  initialItem?: ExceptionQueueRow
  faultCategories?: string[]
  /** The screen's `push`, with `?id=` dropped on every change. */
  update: (patch: Record<string, string | undefined>) => void
  pending: boolean
  /** Open / Closed / All / Raised before go-live, in the filter bar. */
  stateSwitch?: ReactNode
}

/**
 * The exception queue's rows, one server page at a time
 * (I08_Live_UI_Redesign_Plan.md, L5).
 *
 * One line per item: Material, Plant, Exception, Repair line, Raised, Owner.
 * Each row used to be three lines -- the title, the item's own sentence and a
 * red OPEN -- and in the Open view every row is open. The sentence is in the
 * drawer now, the rule behind it is the ⓘ by the title, and the status shows
 * only in the All view, where it tells rows apart.
 *
 * A row opens its drawer; the material opens its repair page. It used to open
 * Material 360, which has nothing for these parts (Q7).
 *
 * ## Why the drawer keeps its own copy of the item
 *
 * The rows are one page: closing an item takes it off an Open page, and a
 * lookup there would empty the drawer the moment the write landed. So the
 * drawer holds the item it opened with, and the one each write sends back,
 * and only prefers the page's copy while the page still has it.
 */
export function ExceptionsTable({
  rows,
  total,
  page,
  pageSize,
  facets,
  filters,
  initialItem,
  faultCategories = [],
  update,
  pending,
  stateSwitch,
}: ExceptionsTableProps) {
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [selected, setSelected] = useState<ExceptionQueueRow | undefined>(initialItem)
  const [drawerOpen, setDrawerOpen] = useState(initialItem !== undefined)
  // The page's copy when it has one: that is as fresh as the last refresh.
  const current = selected ? (rows.find((r) => r.id === selected.id) ?? selected) : undefined
  // Every status at once: the one view where a row's status tells it apart.
  // Not the before-go-live view, where no item is anybody's work.
  const before = filters.preAutomation === true
  const showStatus = filters.status === undefined && !before

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
        before ? "i08-exceptions-before-go-live.xlsx" : "i08-exception-queue.xlsx",
        ["Exception", "Material", "Description", "Plant", "Repair Line", "Raised", "Status", "Owner", "Detail", "Exception ID"],
        all.map((row) => [
          exceptionTypeLabel(row.type),
          row.material.materialCode,
          row.material.description ?? "",
          row.plant?.name ?? row.plant?.plantId ?? "",
          row.repairLine,
          row.raisedAt ?? "",
          EXCEPTION_STATUS_LABEL[row.status],
          row.owner ?? "",
          row.detail,
          row.id,
        ]),
      )
      if (!built) setExportError("The Excel file could not be built.")
    } catch (error) {
      setExportError(error instanceof Error ? error.message : String(error))
    } finally {
      setExporting(false)
    }
  }

  const plantNames = new Map(facets.plants.map((p) => [p.plantId, p.name]))
  const chips = [
    filters.q && { key: "q", label: `Search: “${filters.q}”` },
    filters.plant && { key: "plant", label: `Plant: ${plantNames.get(filters.plant) ?? filters.plant}` },
    // The register's Exceptions column and the repair page link here narrowed
    // to one line: shown, so it can be taken off without editing the address.
    filters.repair && { key: "repair", label: `Repair line ${filters.repair}` },
  ].filter((chip): chip is { key: string; label: string } => Boolean(chip))
  const clearAll = () => update({ q: undefined, plant: undefined, repair: undefined })
  const widths = showStatus ? [26, 11, 19, 13, 10, 11, 10] : [28, 12, 21, 14, 11, 14]

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border-2 border-action/40 bg-card p-3 shadow-lg">
        <UrlSearchInput
          value={filters.q ?? ""}
          onCommit={(value) => update({ q: value })}
          placeholder="Search material, repair line or exception id"
          ariaLabel="Search exceptions"
          className="w-full sm:w-80"
        />
        <UrlSelect
          value={filters.plant ?? ""}
          onChange={(value) => update({ plant: value })}
          allLabel="All plants"
          options={withSelected(
            facets.plants.map((p) => p.plantId),
            filters.plant,
          ).map((id) => ({ value: id, label: plantNames.get(id) ?? id }))}
          className="sm:w-48"
        />
        {stateSwitch}
        <div className="flex items-center gap-2 sm:ml-auto">
          {exportError && (
            <span role="alert" className="text-[12.5px] text-i08-crit-ink">
              Export failed: {exportError}
            </span>
          )}
          <Button size="lg" variant="outline" className="px-3.5 border-action bg-action/10 font-semibold text-action shadow-sm hover:bg-action/20 hover:text-action" onClick={() => void exportExcel()} disabled={exporting || total === 0}>
            {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            Export Excel
          </Button>
        </div>
      </div>

      <FilterChips chips={chips} onRemove={(key) => update({ [key]: undefined })} onClear={clearAll} />

      <ResultsCard pending={pending}>
        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
            <p className="text-[15px] font-semibold text-foreground">
              {chips.length
                ? "No exceptions match"
                : before
                  ? "Nothing raised before go-live"
                  : filters.status === "CLOSED"
                    ? "No closed exceptions"
                    : filters.status === DEFAULT_EXCEPTION_STATUS
                      ? "No open exceptions"
                      : "No exceptions"}
            </p>
            <p className="max-w-md text-[13.5px] text-muted-foreground">
              {chips.length
                ? "Change or clear the filters to see more."
                : before
                  ? "Every item the checks found was raised after go-live."
                  : filters.status === "CLOSED"
                    ? "An exception closes when the check stops finding it, or when someone closes it with a note."
                    : "The checks found nothing to work on here."}
            </p>
            {chips.length > 0 && (
              <Button variant="outline" size="lg" className="mt-1" onClick={clearAll}>
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <>
            <StickyScrollTable tableClassName="table-fixed min-w-[900px]">
              <colgroup>
                {widths.map((width, index) => (
                  <col key={index} style={{ width: `${width}%` }} />
                ))}
              </colgroup>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <Head frozen>Material</Head>
                  <Head>Plant</Head>
                  <Head>Exception</Head>
                  <Head>Repair line</Head>
                  <Head>Raised</Head>
                  <Head>Owner</Head>
                  {showStatus && <Head>Status</Head>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-i08-row
                    tabIndex={0}
                    aria-label={`Open ${exceptionTypeLabel(row.type)} for ${row.material.materialCode}`}
                    onClick={(event) => {
                      // The material and the repair line are links of their own.
                      if ((event.target as HTMLElement).closest("a, button")) return
                      if (window.getSelection()?.toString()) return
                      openItem(row)
                    }}
                    onKeyDown={(event) => {
                      if (event.target !== event.currentTarget) return
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        openItem(row)
                      }
                    }}
                    className="cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                  >
                    <Cell frozen>
                      <MaterialCell
                        code={row.material.materialCode}
                        description={row.material.description}
                        href={row.repairId ? repairHref({ id: row.repairId }) : undefined}
                      />
                    </Cell>
                    <Cell wrap>
                      <span title={row.plant?.name}>{plantShort(row.plant?.name ?? row.plant?.plantId)}</span>
                    </Cell>
                    <Cell wrap>
                      <StatusDot tone={exceptionTone(row.type)} wrap>
                        {exceptionTypeLabel(row.type)}
                      </StatusDot>
                    </Cell>
                    <Cell>
                      {row.repairId ? (
                        <Link
                          href={repairHref({ id: row.repairId })}
                          className="font-mono text-[13.5px] text-i08-link hover:underline"
                          title="Open this repair line"
                        >
                          {row.repairLine}
                        </Link>
                      ) : (
                        <span className="font-mono text-[13.5px]">{row.repairLine}</span>
                      )}
                    </Cell>
                    <Cell>{row.raisedAt ?? "—"}</Cell>
                    <Cell>
                      {row.preAutomation ? (
                        // Nobody's work: raised before the checks began.
                        <span className="text-muted-foreground">No action needed</span>
                      ) : row.owner ? (
                        <span className="block truncate" title={row.owner}>
                          {row.owner}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Unassigned</span>
                      )}
                    </Cell>
                    {showStatus && (
                      <Cell>
                        <StatusDot tone={row.status === "OPEN" ? "warn" : "muted"}>{EXCEPTION_STATUS_LABEL[row.status]}</StatusDot>
                      </Cell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </StickyScrollTable>
            <div className="border-t border-border px-4 py-2.5">
              <TablePagination
                page={page}
                pageSize={pageSize}
                total={total}
                count={rows.length}
                noun="exceptions"
                hrefFor={(p) => exceptionsHref(filters, p)}
              />
            </div>
          </>
        )}
      </ResultsCard>

      <ExceptionDetailDrawer
        exception={current}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onChanged={setSelected}
        faultCategories={faultCategories}
      />
    </>
  )
}
