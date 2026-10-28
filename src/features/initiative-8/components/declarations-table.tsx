"use client"

import { useRouter } from "next/navigation"
import { useState, type KeyboardEvent, type MouseEvent } from "react"
import { Download, Loader2 } from "lucide-react"

import { StickyScrollTable } from "@/components/shared/sticky-scroll-table"
import { TablePagination } from "@/components/shared/table-pagination"
import { Button } from "@/components/ui/button"
import { TableBody, TableHeader, TableRow } from "@/components/ui/table"
import { I08Cell as Cell, I08Head as Head } from "@/features/initiative-8/components/kit/table"
import { DeclarationFormDialog } from "@/features/initiative-8/components/declaration-form-dialog"
import { FilterChips, MaterialCell, ResultsCard } from "@/features/initiative-8/components/kit/list"
import { StatusDot } from "@/features/initiative-8/components/kit/status"
import { repairHref } from "@/features/initiative-8/components/repair-register-table"
import { UrlSearchInput, UrlSelect, withSelected } from "@/features/initiative-8/components/url-filters"
import {
  declarationsHref,
  fetchAllDeclarations,
  type DeclarationFacets,
  type DeclarationFilters,
} from "@/features/initiative-8/data/live-declarations"
import type { DeclarationQueueRow, RepairStatus } from "@/features/initiative-8/types/repair"
import { plantShort, stageLabel } from "@/features/initiative-8/utils/format"
import { REPAIR_STATUS_TONE } from "@/features/initiative-8/utils/status"
import { downloadExcel } from "@/lib/utils"

/** The lifecycle in order, so the stage filter reads PR raised before At vendor. */
const REPAIR_STATUS_ORDER = Object.keys(REPAIR_STATUS_TONE) as RepairStatus[]

export type DeclarationsTableProps = {
  /** One page of the queue. */
  rows: DeclarationQueueRow[]
  /** Matching the filters, across every page. */
  total: number
  page: number
  pageSize: number
  facets: DeclarationFacets
  filters: DeclarationFilters
  /** The declaration form's fault categories. Empty when that fetch failed:
   *  the form then says so and cannot submit. */
  faultCategories?: string[]
  push: (patch: Record<string, string | undefined>) => void
  pending: boolean
}

/**
 * "To declare": the repair lines still owed a condition declaration, one
 * server page at a time (I08_Live_UI_Redesign_Plan.md, L4).
 *
 * Outstanding rows only, and not as a default somebody can switch off: the
 * backend's own test (Required or Flagged), so this list and the tab's count
 * are the same rows. They are filtered again here so a backend ignoring the
 * parameter can never put a Completed row, with a Declare button, on screen.
 *
 * A row opens its repair page; Declare opens the form right here, so working
 * the queue is not a round trip per row. Declaring from a row names that
 * repair line outright, rather than leaving it to a date window these years-old
 * lines are far too old to match.
 */
export function DeclarationsTable({
  rows,
  total,
  page,
  pageSize,
  facets,
  filters,
  faultCategories = [],
  push,
  pending,
}: DeclarationsTableProps) {
  const router = useRouter()
  const [declaring, setDeclaring] = useState<DeclarationQueueRow | null>(null)
  // A fresh form per opening, so a half-typed description cannot reappear
  // against a different part.
  const [formKey, setFormKey] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  /**
   * Every row the filters match, not the page on screen -- and wider than the
   * table: the screen is for working the queue, the file is for slicing it in
   * Excel, and the repair line and requisition are what join it to anything.
   */
  async function exportExcel() {
    setExporting(true)
    setExportError(null)
    try {
      const all = await fetchAllDeclarations(filters)
      const built = await downloadExcel(
        "i08-declaration-queue.xlsx",
        ["Material", "Description", "Plant", "Vendor", "Repair Status", "Repair Line", "Requisition", "Requester Code", "Declaration Status", "Raised"],
        all
          .filter((row) => row.status !== "Completed")
          .map((row) => [
            row.material.materialCode,
            row.material.description ?? "",
            row.plant?.name ?? row.plant?.plantId ?? "",
            row.vendor ?? "",
            row.repairStatus ?? "",
            row.relatedRepairId,
            row.purchaseRequisition ?? "",
            row.requester ?? "",
            row.status,
            row.createdAt ?? "",
          ]),
      )
      if (!built) setExportError("The Excel file could not be built.")
    } catch (error) {
      setExportError(error instanceof Error ? error.message : String(error))
    } finally {
      setExporting(false)
    }
  }

  const visible = rows.filter((row) => row.status !== "Completed")
  const repairStatuses = REPAIR_STATUS_ORDER.filter((status) => facets.repairStatuses.includes(status))
  const plantNames = new Map(facets.plants.map((p) => [p.plantId, p.name]))
  const vendorLabels = new Map(facets.vendors.map((v) => [v.value, v.label]))

  const chips = [
    filters.q && { key: "q", label: `Search: “${filters.q}”` },
    filters.plant && { key: "plant", label: `Plant: ${plantNames.get(filters.plant) ?? filters.plant}` },
    filters.vendor && { key: "vendor", label: `Vendor: ${vendorLabels.get(filters.vendor) ?? filters.vendor}` },
    filters.repairStatus && { key: "repairStatus", label: `Stage: ${stageLabel(filters.repairStatus)}` },
  ].filter((chip): chip is { key: string; label: string } => Boolean(chip))
  const clearAll = () => push({ q: undefined, plant: undefined, vendor: undefined, repairStatus: undefined })

  function open(event: MouseEvent<HTMLTableRowElement>, href: string) {
    if (event.button !== 0 && event.button !== 1) return
    if ((event.target as HTMLElement).closest("a, button")) return
    if (window.getSelection()?.toString()) return
    if (event.metaKey || event.ctrlKey || event.button === 1) {
      window.open(href, "_blank", "noopener")
      return
    }
    router.push(href)
  }

  function openFromKeyboard(event: KeyboardEvent<HTMLTableRowElement>, href: string) {
    if (event.target !== event.currentTarget || event.key !== "Enter") return
    event.preventDefault()
    router.push(href)
  }

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border-2 border-action/40 bg-card p-3 shadow-lg">
        <UrlSearchInput
          value={filters.q ?? ""}
          onCommit={(value) => push({ q: value })}
          placeholder="Search material, repair line or PR"
          ariaLabel="Search the declaration queue"
          className="w-full sm:w-72"
        />
        <UrlSelect
          value={filters.plant ?? ""}
          onChange={(value) => push({ plant: value })}
          allLabel="All plants"
          options={withSelected(facets.plants.map((p) => p.plantId), filters.plant).map((id) => ({
            value: id,
            label: plantNames.get(id) ?? id,
          }))}
          className="sm:w-44"
        />
        <UrlSelect
          value={filters.vendor ?? ""}
          onChange={(value) => push({ vendor: value })}
          allLabel="All vendors"
          options={withSelected(facets.vendors.map((v) => v.value), filters.vendor).map((code) => ({
            value: code,
            label: vendorLabels.get(code) ?? code,
          }))}
          className="sm:w-52"
        />
        <UrlSelect
          value={filters.repairStatus ?? ""}
          onChange={(value) => push({ repairStatus: value })}
          allLabel="All stages"
          options={withSelected(repairStatuses, filters.repairStatus).map((s) => ({ value: s, label: stageLabel(s) }))}
          className="sm:w-36"
        />
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

      <FilterChips chips={chips} onRemove={(key) => push({ [key]: undefined })} onClear={clearAll} />

      <ResultsCard pending={pending}>
        {visible.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
            <p className="text-[15px] font-semibold text-foreground">
              {chips.length ? "No repair lines match" : "Every repair line has a condition declaration"}
            </p>
            <p className="text-[13.5px] text-muted-foreground">
              {chips.length
                ? "Change or clear the filters to see more lines."
                : "Nothing is waiting. New repair lines appear here when SAP raises them."}
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
                {[26, 12, 21, 9, 10.5, 11.5, 10].map((width, index) => (
                  <col key={index} style={{ width: `${width}%` }} />
                ))}
              </colgroup>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <Head frozen>Material</Head>
                  <Head>Plant</Head>
                  <Head>Vendor</Head>
                  <Head>Stage</Head>
                  <Head>PO raised</Head>
                  <Head>Status</Head>
                  <Head>
                    <span className="sr-only">Action</span>
                  </Head>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((row) => {
                  const href = repairHref({ id: row.relatedRepairId })
                  return (
                    <TableRow
                      key={row.id}
                      data-i08-row
                      tabIndex={0}
                      aria-label={`Open repair ${row.relatedRepairId}`}
                      onClick={(event) => open(event, href)}
                      onAuxClick={(event) => open(event, href)}
                      onKeyDown={(event) => openFromKeyboard(event, href)}
                      className="cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                    >
                      <Cell frozen>
                        <MaterialCell code={row.material.materialCode} description={row.material.description} href={href} />
                      </Cell>
                      <Cell wrap>
                        <span title={row.plant?.name}>{plantShort(row.plant?.name ?? row.plant?.plantId)}</span>
                      </Cell>
                      <Cell>
                        <span className="block truncate" title={row.vendor}>
                          {row.vendor ?? <span className="text-muted-foreground">Not known</span>}
                        </span>
                      </Cell>
                      <Cell>{stageLabel(row.repairStatus)}</Cell>
                      <Cell>{row.createdAt ?? "—"}</Cell>
                      <Cell wrap>
                        {/* Flagged: declared NOT repairable and sent anyway -- still wants somebody. */}
                        {row.status === "Flagged" ? (
                          <StatusDot tone="crit" wrap>
                            Against assessment
                          </StatusDot>
                        ) : (
                          <StatusDot tone="warn">Required</StatusDot>
                        )}
                      </Cell>
                      <Cell right>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setFormKey((k) => k + 1)
                            setDeclaring(row)
                          }}
                        >
                          Declare
                        </Button>
                      </Cell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </StickyScrollTable>
            <div className="border-t border-border px-4 py-2.5">
              <TablePagination
                page={page}
                pageSize={pageSize}
                total={total}
                count={visible.length}
                noun="repair lines"
                hrefFor={(p) => declarationsHref(filters, p)}
              />
            </div>
          </>
        )}
      </ResultsCard>

      {declaring && (
        <DeclarationFormDialog
          key={formKey}
          open
          onClose={() => setDeclaring(null)}
          target={{
            materialId: declaring.material.materialId,
            plantId: declaring.plant?.plantId,
            label: `${declaring.material.materialCode} · ${declaring.material.description} · ${declaring.plant?.name ?? "an unknown plant"} · repair line ${declaring.relatedRepairId}`,
            defaultQuantity: "1",
            // FR-4's link to the repair PO: working a queue row declares THAT line.
            repairDocument: declaring.repairPO?.documentNumber,
            repairItem: declaring.repairPO?.line,
          }}
          faultCategories={faultCategories}
        />
      )}
    </>
  )
}
