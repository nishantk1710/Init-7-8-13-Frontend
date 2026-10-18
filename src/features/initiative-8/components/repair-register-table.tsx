"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, type KeyboardEvent, type MouseEvent } from "react"
import { Download, Loader2 } from "lucide-react"

import { ClearFiltersButton } from "@/components/shared/clear-filters-button"
import { FilterBar } from "@/components/shared/filter-bar"
import { MaterialIdentity } from "@/components/shared/material-identity"
import { SAPDocumentChip } from "@/components/shared/sap-document-chip"
import { StatusBadge } from "@/components/shared/status-badge"
import { TablePagination } from "@/components/shared/table-pagination"
import { Button } from "@/components/ui/button"
import {
  Table,
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
  REGISTER_PATH,
  activeRegisterFilters,
  fetchAllRegisterLines,
  registerHref,
  type RegisterFacets,
  type RegisterFilters,
} from "@/features/initiative-8/data/live-register"
import type { RepairChain } from "@/features/initiative-8/types/repair"
import {
  REGISTER_CSV_HEADERS,
  registerRowsToCsv,
} from "@/features/initiative-8/utils/register-view"
import {
  CRITICALITY_TONE,
  DECLARATION_STATUSES,
  DECLARATION_STATUS_TONE,
  EXCEPTION_SEVERITY_TONE,
  OVERDUE_STATUSES,
  OVERDUE_STATUS_LABEL,
  OVERDUE_STATUS_TONE,
  REPAIR_STATUS_TONE,
  UNKNOWN,
  exceptionTypeLabel,
  isPartiallyReceived,
  overdueStatusOf,
  vendorLabel,
} from "@/features/initiative-8/utils/status"
import { cn, downloadExcel, formatCount } from "@/lib/utils"

export type RepairRegisterTableProps = {
  /** One page of the register — always from the backend. There is no fixture
   *  fallback: a failure is reported by the page, never as an empty table. */
  chains: RepairChain[]
  /** Matching the filters, across every page. */
  total: number
  /** Every line the register lists, whatever the filters. */
  overall: number
  page: number
  pageSize: number
  /** The dropdowns' choices, from the server: one page of rows would offer
   *  only what is on it. */
  facets: RegisterFacets
  /** The active aging bands, from the snapshot's rules. */
  agingBands: string[]
  filters: RegisterFilters
}

/** The repair detail page for one register line. */
export function repairHref(chain: Pick<RepairChain, "id">): string {
  return `/repairable-spares/repair-register/${chain.id}`
}

/**
 * The register: one row per repair PO line, and the one place to work on it.
 *
 * Since 08-Oct-2026 it also carries what the Declaration Queue and the
 * Justifications screen showed (who declared and when, and whether a new
 * purchase while the repair was out has a reason), and **the whole row opens
 * the repair** — there is no View button. The material name opens it too,
 * rather than the Material 360 drawer: two click targets in one row that go to
 * different places is how people land somewhere they did not mean to. Material
 * 360 is one click away on the detail page.
 *
 * Columns run from what a repair is doing now, through its declaration and
 * justification, to the reference columns (criticality, stock, SAP documents)
 * people read least.
 *
 * One server page at a time: the filters live in the URL, and the server
 * searches, filters, counts and pages (see `loadRegisterPage`). Back from a
 * repair's detail page returns to the same page and filters.
 */
export function RepairRegisterTable({
  chains,
  total,
  overall,
  page,
  pageSize,
  facets,
  agingBands,
  filters,
}: RepairRegisterTableProps) {
  const router = useRouter()
  const { push, isPending } = useUrlFilters(REGISTER_PATH)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  /**
   * Every line the filters match, not the page on screen -- and nothing the
   * filters exclude. The file is the view it came from.
   */
  async function exportExcel() {
    setExporting(true)
    setExportError(null)
    try {
      const all = await fetchAllRegisterLines(filters)
      const built = await downloadExcel(
        "i08-repair-register.xlsx",
        REGISTER_CSV_HEADERS,
        registerRowsToCsv(all)
      )
      if (!built) setExportError("The Excel file could not be built.")
    } catch (error) {
      setExportError(error instanceof Error ? error.message : String(error))
    } finally {
      setExporting(false)
    }
  }

  /** A dropdown's choices, plus the one in the URL if the server no longer
   *  lists it -- so a link to it still shows what it is filtering by. */
  function choices(options: { value: string; label: string }[], selected?: string) {
    const labels = new Map(options.map((o) => [o.value, o.label]))
    return withSelected(
      options.map((o) => o.value),
      selected
    ).map((value) => ({ value, label: labels.get(value) ?? value }))
  }

  /**
   * A click anywhere on the row opens the repair.
   *
   * Clicks on the material link are left to the link, which already handles
   * them -- including ctrl/cmd-click and middle-click into a new tab, which a
   * row handler alone would lose. A click that ends a text selection is not a
   * request to navigate.
   */
  function openFromRow(event: MouseEvent<HTMLTableRowElement>, href: string) {
    // Only the primary and middle buttons; a right-click opens the menu.
    if (event.button !== 0 && event.button !== 1) return
    if ((event.target as HTMLElement).closest("a")) return
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
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <FilterBar className="flex-1">
          {/* The browser's own find sees one page; this looks through every
              line -- material, repair line, PO and PR. */}
          <UrlSearchInput
            value={filters.q ?? ""}
            onCommit={(value) => push({ q: value })}
            placeholder="Search material, repair line, PO, PR…"
            ariaLabel="Search the repair register"
            className="sm:w-64"
          />
          <UrlSelect
            value={filters.plant ?? ""}
            onChange={(value) => push({ plant: value })}
            allLabel="All plants"
            options={choices(
              facets.plants.map((p) => ({ value: p.plantId, label: p.name })),
              filters.plant
            )}
            className="sm:w-44"
          />
          <UrlSelect
            value={filters.vendor ?? ""}
            onChange={(value) => push({ vendor: value })}
            allLabel="All vendors"
            options={choices(facets.vendors, filters.vendor)}
            className="sm:w-52"
          />
          <UrlSelect
            value={filters.repairStatus ?? ""}
            onChange={(value) => push({ repairStatus: value })}
            allLabel="All repair statuses"
            options={choices(
              facets.repairStatuses.map((s) => ({ value: s, label: s })),
              filters.repairStatus
            )}
            className="sm:w-44"
          />
          <UrlSelect
            value={filters.overdue ?? ""}
            onChange={(value) => push({ overdue: value })}
            allLabel="Any due-date status"
            options={OVERDUE_STATUSES.map((s) => ({ value: s, label: OVERDUE_STATUS_LABEL[s] }))}
            className="sm:w-44"
          />
          {/* The criticality column sits at the far end now, but FR-10 asks for
              the register to be filterable by criticality, so the filter stays. */}
          <UrlSelect
            value={filters.criticality ?? ""}
            onChange={(value) => push({ criticality: value })}
            allLabel="All criticalities"
            options={choices(facets.criticalities, filters.criticality)}
            className="sm:w-44"
          />
          <UrlSelect
            value={filters.declarationStatus ?? ""}
            onChange={(value) => push({ declarationStatus: value })}
            allLabel="All declaration statuses"
            options={DECLARATION_STATUSES.map((s) => ({ value: s, label: s }))}
            className="sm:w-48"
          />
          <UrlSelect
            value={filters.aging ?? ""}
            onChange={(value) => push({ aging: value })}
            allLabel="All aging"
            options={choices(
              agingBands.map((b) => ({ value: b, label: `${b} days` })),
              filters.aging
            )}
            className="sm:w-40"
          />
          {/* FR-8's findings, as a way into the register rather than out of it:
              "show me the lines something was raised against". */}
          <UrlSelect
            value={filters.exceptions ? "1" : ""}
            onChange={(value) => push({ exceptions: value || undefined })}
            allLabel="Any exceptions"
            options={[{ value: "1", label: "With exceptions only" }]}
            className="sm:w-48"
          />
          <ClearFiltersButton
            activeCount={activeRegisterFilters(filters)}
            onClear={() =>
              push({
                q: undefined,
                plant: undefined,
                vendor: undefined,
                repairStatus: undefined,
                overdue: undefined,
                criticality: undefined,
                declarationStatus: undefined,
                aging: undefined,
                exceptions: undefined,
              })
            }
          />

          <div className="flex items-center gap-3 sm:ml-auto">
            {exportError && (
              <span role="alert" className="text-[11px] text-destructive">
                Export failed: {exportError}
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              {formatCount(total)} of {formatCount(overall)} lines
            </span>
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
        </FilterBar>
        <PendingSpinner pending={isPending} />
      </div>

      {total === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No repair chains match these filters.
        </div>
      ) : (
        <div className={cn("overflow-x-auto", isPending && "opacity-60")}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Plant</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead className="text-right">Qty Under Repair</TableHead>
                <TableHead>Repair Status</TableHead>
                <TableHead>Expected Return</TableHead>
                <TableHead>Due Date Status</TableHead>
                <TableHead className="text-right">Days Open</TableHead>
                <TableHead className="text-right">Turnaround</TableHead>
                <TableHead>Declaration Status</TableHead>
                <TableHead>Exceptions</TableHead>
                <TableHead>Criticality</TableHead>
                <TableHead>Repair PR</TableHead>
                <TableHead>Repair PO</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {chains.map((c) => {
                const href = repairHref(c)
                const overdue = overdueStatusOf(c)
                return (
                  <TableRow
                    key={c.id}
                    tabIndex={0}
                    aria-label={`Open repair ${c.id}`}
                    onClick={(event) => openFromRow(event, href)}
                    onAuxClick={(event) => openFromRow(event, href)}
                    onKeyDown={(event) => openFromKeyboard(event, href)}
                    className="cursor-pointer focus-visible:bg-muted/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                  >
                    <TableCell>
                      {/* A real link, so ctrl-click, middle-click and "copy
                          link" all work; the row forwards its clicks here. */}
                      <Link href={href} className="block hover:underline" tabIndex={-1}>
                        <MaterialIdentity material={c.material} />
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate text-muted-foreground">
                      {c.material.description}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{c.plant.name}</TableCell>
                    <TableCell className="max-w-[160px] truncate text-muted-foreground">
                      {vendorLabel(c)}
                    </TableCell>
                    <TableCell className="text-right text-foreground">{c.qtyUnderRepair}</TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1">
                        <StatusBadge tone={REPAIR_STATUS_TONE[c.repairStatus]}>
                          {c.repairStatus}
                        </StatusBadge>
                        {/* The one thing the old receipt-status column said that
                            this one does not. */}
                        {isPartiallyReceived(c) && (
                          <span className="text-[10px] italic text-warning">
                            partially received
                          </span>
                        )}
                        {/* Moved here from under the Repair PO, which is now the
                            last column: a blocked line must stay on screen.
                            Blocked, not deleted -- still a live line and still
                            counted, so it is flagged rather than hidden. */}
                        {c.poBlocked && (
                          <StatusBadge tone="danger" className="h-4 px-1.5 text-[10px]">
                            Blocked in SAP
                          </StatusBadge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.expectedReturn ?? UNKNOWN}
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={OVERDUE_STATUS_TONE[overdue]}>
                        {OVERDUE_STATUS_LABEL[overdue]}
                      </StatusBadge>
                    </TableCell>
                    {/* Plain number, no verdict -- the lead-time mark has its
                        own column. Days open runs from the PO line date to the
                        receipt, or to the reference date while the unit is
                        still out, so a closed line reads its turnaround and
                        never a "200" beside a "within the 21-day planned time"
                        verdict. */}
                    <TableCell className="text-right text-foreground">{c.daysOpen}</TableCell>
                    {/* Turnaround is dispatch to goods receipt, so a line still
                        at the vendor has no turnaround YET rather than one of
                        zero -- the dash says that, a 0 would not. */}
                    <TableCell
                      className="text-right text-muted-foreground tabular-nums"
                      title="Measured from dispatch to the vendor (541) to goods receipt, so only for lines that came back"
                    >
                      {c.daysAtVendor ?? UNKNOWN}
                    </TableCell>
                    {/* Who declared and when, under the status -- what the
                        Declaration Queue showed in two columns of its own. The
                        condition, the next action and the form are on the
                        detail page. */}
                    <TableCell>
                      <div className="flex flex-col items-start gap-0.5">
                        <StatusBadge tone={DECLARATION_STATUS_TONE[c.declarationStatus]}>
                          {c.declarationStatus}
                        </StatusBadge>
                        {c.declaredBy && (
                          <span className="whitespace-nowrap text-[10px] text-muted-foreground">
                            {c.declaredBy}
                            {c.declaredAt && ` · ${c.declaredAt}`}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    {/* What the FR-8 checks found against this line, served
                        with it. A line they were not computed for -- a backend
                        older than that -- reads "not checked" rather than
                        showing a clean dash it has not earned. */}
                    <TableCell onClick={(event) => event.stopPropagation()}>
                      {c.exceptions === undefined ? (
                        <span
                          className="text-xs text-muted-foreground"
                          title="The checks were not read for this line, so its findings are unknown."
                        >
                          Not checked
                        </span>
                      ) : c.exceptions.length === 0 ? (
                        <span className="text-xs text-muted-foreground">{UNKNOWN}</span>
                      ) : (
                        <Link
                          href={`/repairable-spares/exceptions?repair=${encodeURIComponent(c.id)}`}
                          className="flex flex-wrap items-center gap-1"
                          title={`Open Repair Exceptions filtered to ${c.id}`}
                        >
                          {c.exceptions.map((exception) => (
                            <StatusBadge
                              key={exception.id}
                              tone={EXCEPTION_SEVERITY_TONE[exception.severity] ?? "default"}
                            >
                              {exceptionTypeLabel(exception.type)}
                            </StatusBadge>
                          ))}
                        </Link>
                      )}
                    </TableCell>
                    {/* Unrated is "not recorded", never NORMAL -- a dash, with
                        the reason on hover. */}
                    <TableCell>
                      {c.criticality ? (
                        <StatusBadge tone={CRITICALITY_TONE[c.criticality] ?? "default"}>
                          {c.criticality}
                        </StatusBadge>
                      ) : (
                        <span
                          className="text-xs text-muted-foreground"
                          title="No criticality rating is recorded for this material in ZMM065"
                        >
                          {UNKNOWN}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <SAPDocumentChip doc={c.repairPR} />
                    </TableCell>
                    <TableCell>
                      {c.repairPO ? (
                        <SAPDocumentChip doc={c.repairPO} />
                      ) : (
                        <span className="text-xs text-muted-foreground">Not yet raised</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <TablePagination
        page={page}
        pageSize={pageSize}
        total={total}
        count={chains.length}
        noun="repair lines"
        hrefFor={(p) => registerHref(filters, p)}
      />
    </div>
  )
}
