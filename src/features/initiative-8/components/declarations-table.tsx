"use client"

import { useState } from "react"
import { Download, Loader2 } from "lucide-react"

import { ClearFiltersButton } from "@/components/shared/clear-filters-button"
import { FilterBar } from "@/components/shared/filter-bar"
import { MaterialIdentity } from "@/components/shared/material-identity"
import { StatusBadge } from "@/components/shared/status-badge"
import { StickyScrollTable } from "@/components/shared/sticky-scroll-table"
import { TablePagination } from "@/components/shared/table-pagination"
import { Button } from "@/components/ui/button"
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  PendingSpinner,
  UrlSearchInput,
  UrlSelect,
  useUrlFilters,
  withSelected,
} from "@/features/initiative-8/components/url-filters"
import {
  DECLARATIONS_PATH,
  declarationsHref,
  fetchAllDeclarations,
  type DeclarationFacets,
  type DeclarationFilters,
} from "@/features/initiative-8/data/live-declarations"
import type {
  DeclarationQueueRow,
  DeclarationQueueSummary,
  RepairStatus,
} from "@/features/initiative-8/types/repair"
import { REPAIR_STATUS_TONE } from "@/features/initiative-8/utils/status"
import { DeclarationFormDialog } from "@/features/initiative-8/components/declaration-form-dialog"
import { cn, downloadExcel, formatCount } from "@/lib/utils"
import { useMaterial360 } from "@/lib/material-360-context"

/**
 * The repair lifecycle, in order, so the status filter offers PR Raised before
 * Closed rather than in whatever order the rows happened to arrive. Taken from
 * the tone map so there is one list of repair statuses in this module, not two.
 */
const REPAIR_STATUS_ORDER = Object.keys(REPAIR_STATUS_TONE) as RepairStatus[]

export type DeclarationsTableProps = {
  /** One page of the queue. */
  rows: DeclarationQueueRow[]
  /** Matching the filters, across every page. */
  total: number
  page: number
  pageSize: number
  /** The whole queue's counts, whatever the filters. */
  summary: DeclarationQueueSummary
  facets: DeclarationFacets
  filters: DeclarationFilters
  /**
   * The attestation form's fault categories, so a line can be declared from
   * this row rather than by navigating to the repair and back.
   *
   * Empty when that fetch failed: the form then says so and cannot submit,
   * which is better than offering a list it invented.
   */
  faultCategories?: string[]
}

/**
 * The declaration queue, one server page at a time.
 *
 * The filters live in the URL and the server pages, searches and counts (see
 * `loadDeclarationsPage`). The screen used to load all 5,153 rows and filter
 * them here, which made it a 17 MB page.
 */
export function DeclarationsTable({
  rows,
  total,
  page,
  pageSize,
  summary,
  facets,
  filters,
  faultCategories = [],
}: DeclarationsTableProps) {
  const { openMaterial360 } = useMaterial360()
  const { push, isPending } = useUrlFilters(DECLARATIONS_PATH)
  const [declaring, setDeclaring] = useState<DeclarationQueueRow | null>(null)
  // A fresh form per opening, so a half-typed description cannot reappear
  // against a different part.
  const [formKey, setFormKey] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  // Outstanding only, and not as a default somebody can switch off.
  //
  // The heading above this table says "still owed a declaration", and since
  // 13-Oct the columns carry no declaration status at all. A Completed row
  // would be indistinguishable from an undeclared one and would still offer a
  // "Declare condition" button, which is why this is a scope rather than a
  // filter.
  //
  // "Outstanding" is the backend's own test -- Required or Flagged, anything
  // not Completed -- so this table and the "Repair lines undeclared" tile
  // above it count the same rows. A Flagged line was declared NOT repairable
  // and sent for repair anyway; it still wants somebody's attention, and the
  // tile already counts it.
  //
  // The request asks for outstanding rows only. They are filtered again here
  // so that a backend ignoring the parameter can never put a Completed row,
  // with a Declare button, on screen; on the current one this removes nothing.
  const visible = rows.filter((row) => row.status !== "Completed")

  // Only the statuses the queue actually holds, in lifecycle order: a filter
  // offering a value that matches nothing reads as a broken filter.
  const repairStatuses = REPAIR_STATUS_ORDER.filter((status) =>
    facets.repairStatuses.includes(status)
  )

  // FR-10 asks for a plant filter on every screen. The plants, vendors and
  // statuses come from the server, taken over the whole queue: one page of
  // rows would offer only what is on it. A vendor is chosen by its code and
  // shown by its LFA1 name where one was delivered. Rows with no vendor (no
  // PO header on the repair line) match no vendor and drop out once one is
  // picked, which is the honest answer: the vendor is not known from this data.
  const plantNames = new Map(facets.plants.map((p) => [p.plantId, p.name]))
  const vendorLabels = new Map(facets.vendors.map((v) => [v.value, v.label]))

  const activeFilters = [filters.q, filters.plant, filters.vendor, filters.repairStatus].filter(
    Boolean
  ).length

  /** Every match, not the page on screen -- see `fetchAllDeclarations`. */
  async function exportExcel() {
    setExporting(true)
    setExportError(null)
    try {
      const all = await fetchAllDeclarations(filters)
      const built = await downloadExcel(
        "i08-declaration-queue.xlsx",
        // Wider than the table on purpose, the same way the register's export
        // is: the screen is for working the queue, the file is for somebody
        // slicing it in Excel, and the repair line and requisition are what
        // they need to join it to anything else.
        [
          "Material",
          "Description",
          "Plant",
          "Vendor",
          "Repair Status",
          "Repair Line",
          "Requisition",
          "Requester Code",
          "Declaration Status",
          "Raised",
        ],
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
          ])
      )
      if (!built) setExportError("The Excel file could not be built.")
    } catch (error) {
      setExportError(error instanceof Error ? error.message : String(error))
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* The counts are over the whole queue, never over the filtered view:
          "how much of the register is undeclared" must not change because
          somebody looked at one plant. */}
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground">
          <strong className="text-foreground">{summary.outstanding}</strong> of{" "}
          {summary.total} repair lines are waiting on a condition declaration.{" "}
          {summary.byStatus.Flagged ? (
            <>
              <strong className="text-foreground">{summary.byStatus.Flagged}</strong>{" "}
              flagged.{" "}
            </>
          ) : null}
          <span className="text-xs">
            Matched within ±{summary.attestationWindowDays} days of the repair line.
          </span>
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

      <div className="flex items-center gap-2">
        <FilterBar className="flex-1">
          <UrlSelect
            value={filters.plant ?? ""}
            onChange={(value) => push({ plant: value })}
            allLabel="All plants"
            options={withSelected(
              facets.plants.map((p) => p.plantId),
              filters.plant
            ).map((id) => ({ value: id, label: plantNames.get(id) ?? id }))}
            className="sm:w-44"
          />
          <UrlSelect
            value={filters.repairStatus ?? ""}
            onChange={(value) => push({ repairStatus: value })}
            allLabel="All repair statuses"
            options={withSelected(repairStatuses, filters.repairStatus).map((s) => ({
              value: s,
              label: s,
            }))}
            className="sm:w-44"
          />
          <UrlSelect
            value={filters.vendor ?? ""}
            onChange={(value) => push({ vendor: value })}
            allLabel="All vendors"
            options={withSelected(
              facets.vendors.map((v) => v.value),
              filters.vendor
            ).map((code) => ({ value: code, label: vendorLabels.get(code) ?? code }))}
            className="sm:w-52"
          />

          <UrlSearchInput
            value={filters.q ?? ""}
            onCommit={(value) => push({ q: value })}
            placeholder="Search material, repair line, PR…"
            ariaLabel="Search the declaration queue"
            className="sm:w-64"
          />

          <ClearFiltersButton
            activeCount={activeFilters}
            onClear={() =>
              push({ plant: undefined, repairStatus: undefined, vendor: undefined, q: undefined })
            }
          />

          {/* How much of the queue is in front of you. The counts in the band
              above are over the whole queue on purpose, so without this a
              filtered view gives no number at all. */}
          <span className="text-xs text-muted-foreground sm:ml-auto">
            {formatCount(total)} of {formatCount(summary.total)} rows
          </span>
        </FilterBar>
        <PendingSpinner pending={isPending} />
      </div>

      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No declarations match these filters.
        </div>
      ) : (
        <StickyScrollTable className={cn(isPending && "opacity-60")}>
          <TableHeader>
            <TableRow>
              <TableHead data-frozen-column>Material</TableHead>
              <TableHead>Plant</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Repair Status</TableHead>
              <TableHead>Raised</TableHead>
              <TableHead className="text-right">
                <span className="sr-only">Action</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((row) => (
              <TableRow key={row.id}>
                <TableCell data-frozen-column>
                  <MaterialIdentity
                    material={row.material}
                    onOpen={openMaterial360}
                  />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {row.plant?.name ?? row.plant?.plantId ?? "—"}
                </TableCell>
                {/* Name when LFA1 gave one, else the code, else neither.
                    455 repair lines carry no PO header, so "not known from
                    this data" is a real answer and gets said. */}
                <TableCell className="max-w-[180px] truncate text-muted-foreground">
                  {row.vendor ?? "—"}
                </TableCell>
                {/* The REPAIR's status, not the declaration's. Whether the
                    part is still out changes how urgent an undeclared line
                    is, and every row here is undeclared by definition. */}
                <TableCell>
                  {row.repairStatus ? (
                    <StatusBadge tone={REPAIR_STATUS_TONE[row.repairStatus]}>
                      {row.repairStatus}
                    </StatusBadge>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {row.createdAt ?? "—"}
                </TableCell>
                {/* Declare it from here. The form used to live only on the
                    repair detail page, which meant working this queue was a
                    round trip per row: open the repair, declare, come back,
                    find your place again. */}
                <TableCell className="text-right">
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => {
                      setFormKey((k) => k + 1)
                      setDeclaring(row)
                    }}
                  >
                    Declare condition
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </StickyScrollTable>
      )}

      <TablePagination
        page={page}
        pageSize={pageSize}
        total={total}
        count={visible.length}
        noun="repair lines"
        hrefFor={(p) => declarationsHref(filters, p)}
      />

      {declaring && (
        <DeclarationFormDialog
          key={formKey}
          open
          onClose={() => setDeclaring(null)}
          target={{
            materialId: declaring.material.materialId,
            plantId: declaring.plant?.plantId,
            label: `${declaring.material.materialCode} - ${declaring.material.description} at ${declaring.plant?.name ?? "an unknown plant"} (repair ${declaring.relatedRepairId})`,
            defaultQuantity: "1",
            // FR-4's link to the repair PO. Working a queue row declares THAT
            // line, so it is named outright rather than left to a date window
            // that these lines are far too old to satisfy.
            repairDocument: declaring.repairPO?.documentNumber,
            repairItem: declaring.repairPO?.line,
          }}
          faultCategories={faultCategories}
        />
      )}
    </div>
  )
}
