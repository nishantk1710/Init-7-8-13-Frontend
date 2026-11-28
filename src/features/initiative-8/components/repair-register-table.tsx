"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState, type KeyboardEvent, type MouseEvent } from "react"
import { Download, Loader2, Plus } from "lucide-react"

import { StickyScrollTable } from "@/components/shared/sticky-scroll-table"
import { TablePagination } from "@/components/shared/table-pagination"
import { Button } from "@/components/ui/button"
import { TableBody, TableHeader, TableRow } from "@/components/ui/table"
import { I08Cell as Cell, I08Head as Head } from "@/features/initiative-8/components/kit/table"
import { InfoPopover, PopoverButton } from "@/features/initiative-8/components/kit/info-popover"
import { FilterChips, MaterialCell, QuickViews, ResultsCard } from "@/features/initiative-8/components/kit/list"
import { Dot, I08Page } from "@/features/initiative-8/components/kit/page"
import { StatusDot } from "@/features/initiative-8/components/kit/status"
import { UrlSearchInput, UrlSelect, useUrlFilters, withSelected } from "@/features/initiative-8/components/url-filters"
import {
  REGISTER_PATH,
  fetchAllRegisterLines,
  registerHref,
  registerViewChoices,
  type RegisterFacets,
  type RegisterFilters,
} from "@/features/initiative-8/data/live-register"
import type { RepairChain } from "@/features/initiative-8/types/repair"
import { plantShort, plural, stageLabel } from "@/features/initiative-8/utils/format"
import { REGISTER_CSV_HEADERS, registerRowsToCsv } from "@/features/initiative-8/utils/register-view"
import { DECLARATION_DISPLAY } from "@/features/initiative-8/utils/declaration"
import {
  NO_PO_YET,
  REPAIR_REQUESTED_SHORT,
  repairRequestsNote,
  requestedAgo,
  requestedAgoShort,
  requesterText,
} from "@/features/initiative-8/utils/repair-request"
import { repairPrLabel } from "@/features/initiative-8/utils/repair-line"
import {
  OVERDUE_STATUS_LABEL,
  isPrOnly,
  overdueStatusOf,
  vendorLabel,
} from "@/features/initiative-8/utils/status"
import type { ApiRegisterMeta, ApiRegisterViewCounts } from "@/lib/api/i8"
import { cn, downloadExcel, formatCount } from "@/lib/utils"

export type RepairRegisterTableProps = {
  /** One page of the register — always from the backend. There is no fixture
   *  fallback: a failure is reported by the page, never as an empty table. */
  chains: RepairChain[]
  /** Matching the filters, across every page. */
  total: number
  meta: ApiRegisterMeta
  page: number
  pageSize: number
  /** The dropdowns' choices, from the server: one page of rows would offer
   *  only what is on it. */
  facets: RegisterFacets
  filters: RegisterFilters
  viewCounts: ApiRegisterViewCounts | null
  /** The backend serves PRs raised for repair with no PO yet as rows. False
   *  on an older backend, or when its settings could not be read. */
  repairRequestsEnabled?: boolean
}

/** The repair detail page for one register line. */
export function repairHref(chain: Pick<RepairChain, "id">): string {
  return `/repairable-spares/repair-register/${chain.id}`
}

/** Where the repair page's breadcrumb goes back to: the register as it was left. */
export const REGISTER_RETURN_KEY = "i08.register.lastHref"

/** The columns that are off by default, behind the "+" at the end of the header. */
const OPTIONAL_COLUMNS = [
  { value: "qty", label: "Qty under repair" },
  { value: "crit", label: "Criticality" },
  { value: "po", label: "Repair PO" },
] as const
type OptionalColumn = (typeof OPTIONAL_COLUMNS)[number]["value"]

/**
 * Widths, in %, of the nine default columns and the "+" that ends the header,
 * in header order: Material, Repair PR, Plant, Vendor, Department, Stage,
 * Expected back, Days open, Declaration, "+". The Exceptions column went on
 * 3-Nov-2026; the Repair PR column took the repair line's place on
 * 27-Nov-2026 and needs less room, having dropped the `PR ` prefix.
 */
const DEFAULT_WIDTHS = [14.5, 12, 9.5, 10.5, 12, 8.5, 11.5, 6, 10, 3]
const OPTIONAL_WIDTHS: Record<OptionalColumn, number> = { qty: 6, crit: 8, po: 10 }

/**
 * The floor the table will not shrink below, by how many optional columns are
 * on. Below it the table scrolls sideways under its frozen Material column
 * rather than cut a document number short.
 *
 * It has to grow per column. One flat width for "any optional column at all"
 * was the bug this replaces: turning all of them on squeezed the nine default
 * columns into the same 1440px instead of widening the table, and the frozen
 * Material column had nothing to scroll against.
 *
 * One entry per number of optional columns on, 0 to all of them, each 130px
 * wider than the last. Written out rather than computed because Tailwind only
 * compiles the classes it can read in the source; `min-w-[${n}px]` reaches
 * the browser as nothing. A column added to OPTIONAL_COLUMNS needs an entry
 * here too, or the last one stands in and the table squeezes again.
 */
const MIN_WIDTHS = ["min-w-[1080px]", "min-w-[1210px]", "min-w-[1340px]", "min-w-[1470px]"] as const

/** Shared with the queue and the repair page; Historical reads muted. */
const DECLARATION: Record<string, { tone: "warn" | "good" | "crit" | "muted"; label: string; hint?: string }> =
  DECLARATION_DISPLAY

/**
 * The Repair Register (FR-10) -- I08_Live_UI_Redesign_Plan.md, L2.
 *
 * One row per repair PO line SAP still has open. Nine columns by default: it
 * was fourteen across 2,125px, and the sideways scrollbar sat under the 25th
 * row. The material number comes first and the description once (it was shown
 * twice per row). The repair PR (`2000028756/10`) and the department that
 * asked tell rows of the same part apart (28-Oct-2026: seven lines for one
 * material looked identical); it replaced the repair line on 27-Nov-2026,
 * which held a PO on one row and a PR on the next under one heading.
 * Lateness is said once, as "113 days late" under the expected date. Colour
 * only where it asks for something: "PO issued" is plain text.
 *
 * No Exceptions column since 3-Nov-2026: the exception queue was removed, and
 * overdue repairs say so under their expected date.
 *
 * Quick views (Overdue, Not declared, At vendor, No PO yet) sit above the
 * search and four filters -- plant, vendor, stage and criticality. "More
 * filters" (declaration, due date, days open) went on 4-Nov-2026: the quick
 * views cover the first two. Every filter that is set shows as a removable
 * chip -- including the ones the Overview's links and older links set
 * (department, days past the expected return, days open). The "+" at the end of the
 * header (3-Nov-2026; it was a "Columns" button above the table) brings back
 * quantity, criticality and the PO, and only then does the table scroll
 * sideways -- with the pinned scrollbar and the frozen Material column
 * (`StickyScrollTable`). The "+" stays pinned to the right edge. The Excel
 * export stays wide whatever is on screen.
 *
 * A PR raised for repair with no PO yet (a PR row, served since 27-Oct-2026)
 * is listed after the PO lines. It reads "PR raised", with "No PO yet" where
 * the expected date would be, and no vendor.
 *
 * The filters, the view and the columns live in the URL, so a filtered
 * register is a link somebody can send, and back and forward work. The server
 * searches, filters, counts and pages (`loadRegisterPage`).
 */
export function RepairRegisterTable({
  chains,
  total,
  meta,
  page,
  pageSize,
  facets,
  filters,
  viewCounts,
  repairRequestsEnabled = false,
}: RepairRegisterTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { push, isPending } = useUrlFilters(REGISTER_PATH)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  const columns = (searchParams.get("cols") ?? "")
    .split(",")
    .filter((value): value is OptionalColumn => OPTIONAL_COLUMNS.some((c) => c.value === value))
  // The "+" column is last in DEFAULT_WIDTHS, so an optional column has to go
  // in before it rather than onto the end: appended, every <col> from the
  // first optional column rightwards lined up against the wrong cell, and the
  // "+" took a data column's width.
  const widths = [
    ...DEFAULT_WIDTHS.slice(0, -1),
    ...columns.map((c) => OPTIONAL_WIDTHS[c]),
    DEFAULT_WIDTHS[DEFAULT_WIDTHS.length - 1],
  ]
  const widthTotal = widths.reduce((sum, w) => sum + w, 0)

  // The repair page's breadcrumb returns here, to the same filters and page.
  useEffect(() => {
    try {
      window.sessionStorage.setItem(REGISTER_RETURN_KEY, `${REGISTER_PATH}?${searchParams.toString()}`)
    } catch {
      // Storage can be blocked; the breadcrumb then opens the plain register.
    }
  }, [searchParams])

  /** Every line the filters match, not the page on screen. */
  async function exportExcel() {
    setExporting(true)
    setExportError(null)
    try {
      const all = await fetchAllRegisterLines(filters)
      const built = await downloadExcel("i08-repair-register.xlsx", REGISTER_CSV_HEADERS, registerRowsToCsv(all))
      if (!built) setExportError("The Excel file could not be built.")
    } catch (error) {
      setExportError(error instanceof Error ? error.message : String(error))
    } finally {
      setExporting(false)
    }
  }

  function toggleColumn(column: OptionalColumn, on: boolean) {
    const next = OPTIONAL_COLUMNS.map((c) => c.value).filter((c) =>
      c === column ? on : columns.includes(c),
    )
    push({ cols: next.join(",") || undefined })
  }

  function choices(options: { value: string; label: string }[], selected?: string) {
    const labels = new Map(options.map((o) => [o.value, o.label]))
    return withSelected(options.map((o) => o.value), selected).map((value) => ({
      value,
      label: labels.get(value) ?? value,
    }))
  }

  // The backend sends `viewCounts` exactly when it understands `view` and
  // `stageAgingBucket` -- they arrived together. An older one ignores both
  // without a word, and a selected pill over an unfiltered list would be a
  // wrong answer that looks right: so no pills then, and a chip from an
  // Overview link says it is not applied.
  const viewsWork = viewCounts !== null
  const plantName = (id?: string) => facets.plants.find((p) => p.plantId === id)?.name ?? id
  const vendorName = (code?: string) => facets.vendors.find((v) => v.value === code)?.label ?? code
  const chips = [
    filters.q && { key: "q", label: `Search: “${filters.q}”` },
    filters.plant && { key: "plant", label: `Plant: ${plantName(filters.plant)}` },
    filters.vendor && { key: "vendor", label: `Vendor: ${vendorName(filters.vendor)}` },
    filters.repairStatus && { key: "repairStatus", label: `Stage: ${stageLabel(filters.repairStatus)}` },
    filters.stageAging && {
      key: "stageAging",
      label: `${filters.stageAging.replace("-", "–")} days in stage${viewsWork ? "" : " (not applied)"}`,
    },
    !viewsWork && filters.view && { key: "view", label: `${filters.view} (not applied)` },
    filters.criticality && {
      key: "criticality",
      label: `Criticality: ${filters.criticality === "none" ? "Not rated" : filters.criticality}`,
    },
    filters.declarationStatus && {
      key: "declarationStatus",
      label: `Declaration: ${DECLARATION[filters.declarationStatus]?.label ?? filters.declarationStatus}`,
    },
    filters.overdue && {
      key: "overdue",
      label: `Due date: ${OVERDUE_STATUS_LABEL[filters.overdue as keyof typeof OVERDUE_STATUS_LABEL] ?? filters.overdue}`,
    },
    filters.aging && { key: "aging", label: `${filters.aging.replace("-", "–")} days open` },
    filters.lateAging && {
      key: "lateAging",
      label: `${filters.lateAging.replace("-", "–")} days past expected return${viewsWork ? "" : " (not applied)"}`,
    },
    filters.department && {
      key: "department",
      label: `Department: ${facets.departments.find((d) => d.value === filters.department)?.label ?? filters.department}`,
    },
  ].filter((chip): chip is { key: string; label: string } => Boolean(chip))

  function clearAll() {
    push({
      q: undefined,
      plant: undefined,
      vendor: undefined,
      repairStatus: undefined,
      overdue: undefined,
      criticality: undefined,
      declarationStatus: undefined,
      aging: undefined,
      stageAging: undefined,
      lateAging: undefined,
      department: undefined,
      view: undefined,
    })
  }

  /**
   * A click anywhere on the row opens the repair. Clicks on a link are left to
   * the link -- ctrl/cmd-click and middle-click into a new tab included -- and
   * a click that ends a text selection is not a request to navigate.
   */
  function openFromRow(event: MouseEvent<HTMLTableRowElement>, href: string) {
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

  const notShown = [
    [meta.excludedDeliveryCompletedLines, "delivery completed"],
    [meta.excludedBlockedLines, "blocked"],
    [meta.excludedDeletedLines, "deleted"],
    [meta.excludedRfqLines, "on a request for quotation"],
  ].filter((entry): entry is [number, string] => Boolean(entry[0]))
  const requestsNote = repairRequestsNote(repairRequestsEnabled, meta.openRepairRequests)

  return (
    <I08Page
      crumbs={[{ label: "Repairable Spares", href: "/repairable-spares" }, { label: "Repair Register" }]}
      title="Repair Register"
      summary={
        <>
          <span>{plural(meta.openLines, "open repair line")}</span>
          {requestsNote && <span className="text-muted-foreground">{requestsNote}</span>}
          <Dot />
          <span>{plural(meta.distinctMaterials, "material")}</span>
          <InfoPopover title="What this list holds">
            <p>
              Every repair PO line SAP still has open, for 80-series materials. A line leaves the list when SAP
              marks it delivery completed.
            </p>
            {repairRequestsEnabled && (
              <p>
                After them, the PRs raised for repair that have no PO yet. They have no vendor or return date until
                the PO is raised, and are not counted in the open repair lines.
              </p>
            )}
            {notShown.length > 0 && (
              <p>Not shown: {notShown.map(([count, what]) => `${formatCount(count)} ${what}`).join(", ")}.</p>
            )}
          </InfoPopover>
        </>
      }
      actions={
        <>
          {exportError && (
            <span role="alert" className="text-[12.5px] text-i08-crit-ink">
              Export failed: {exportError}
            </span>
          )}
          <Button size="lg" variant="outline" className="px-3.5 border-action bg-action/10 font-semibold text-action shadow-sm hover:bg-action/20 hover:text-action" onClick={() => void exportExcel()} disabled={exporting || total === 0}>
            {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            Export Excel
          </Button>
        </>
      }
    >
      {viewsWork && (
        <QuickViews
          choices={registerViewChoices(viewCounts, { repairRequestsEnabled, selected: filters.view })}
          value={filters.view ?? ""}
          onSelect={(value) => push({ view: value || undefined })}
        />
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border-2 border-action/40 bg-card p-3 shadow-lg">
        {/* The browser's own find sees one page; this looks through every line. */}
        <UrlSearchInput
          value={filters.q ?? ""}
          onCommit={(value) => push({ q: value })}
          placeholder="Search material, PO, PR or repair line"
          ariaLabel="Search the repair register"
          className="w-full sm:w-80"
        />
        <UrlSelect
          value={filters.plant ?? ""}
          onChange={(value) => push({ plant: value })}
          allLabel="All plants"
          options={choices(facets.plants.map((p) => ({ value: p.plantId, label: p.name })), filters.plant)}
          className="sm:w-48"
        />
        <UrlSelect
          value={filters.vendor ?? ""}
          onChange={(value) => push({ vendor: value })}
          allLabel="All vendors"
          options={choices(facets.vendors, filters.vendor)}
          className="sm:w-56"
        />
        <UrlSelect
          value={filters.repairStatus ?? ""}
          onChange={(value) => push({ repairStatus: value })}
          allLabel="All stages"
          options={choices(
            facets.repairStatuses.map((s) => ({ value: s, label: stageLabel(s) })),
            filters.repairStatus,
          )}
          className="sm:w-40"
        />
        {/* FR-10 asks for the register to be filterable by criticality. */}
        <UrlSelect
          value={filters.criticality ?? ""}
          onChange={(value) => push({ criticality: value })}
          allLabel="All criticalities"
          options={choices(facets.criticalities, filters.criticality)}
          className="sm:w-44"
        />
      </div>

      <FilterChips chips={chips} onRemove={(key) => push({ [key]: undefined })} onClear={clearAll} />

      <ResultsCard pending={isPending}>
        {total === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
            <p className="text-[15px] font-semibold text-foreground">No repair lines match</p>
            <p className="text-[13.5px] text-muted-foreground">Change or clear the filters to see more lines.</p>
            <Button variant="outline" size="lg" className="mt-1" onClick={clearAll}>
              Clear filters
            </Button>
          </div>
        ) : (
          <>
            <StickyScrollTable tableClassName={cn("table-fixed", MIN_WIDTHS[columns.length] ?? MIN_WIDTHS[MIN_WIDTHS.length - 1])}>
              <colgroup>
                {widths.map((width, index) => (
                  <col key={index} style={{ width: `${((width / widthTotal) * 100).toFixed(2)}%` }} />
                ))}
              </colgroup>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <Head frozen source="material">Material</Head>
                  <Head source="repairPr">Repair PR</Head>
                  <Head source="plant">Plant</Head>
                  <Head source="vendor">Vendor</Head>
                  <Head source="department">Department</Head>
                  <Head source="stage">Stage</Head>
                  <Head source="expectedBack">Expected back</Head>
                  <Head right wrap source="daysOpen">
                    Days open
                  </Head>
                  <Head source="declaration">Declaration</Head>
                  {columns.includes("qty") && (
                    <Head right source="qtyUnderRepair">
                      Qty
                    </Head>
                  )}
                  {columns.includes("crit") && <Head source="criticality">Criticality</Head>}
                  {columns.includes("po") && <Head source="repairPo">Repair PO</Head>}
                  <th className="sticky right-0 z-[2] h-[42px] bg-(--i08-head) px-1 text-center align-middle">
                    <ColumnPicker columns={columns} onToggle={toggleColumn} />
                  </th>
                </TableRow>
              </TableHeader>
              <TableBody>
                {chains.map((c) => {
                  const href = repairHref(c)
                  const overdue = overdueStatusOf(c)
                  const late = c.daysRemainingInRepair !== undefined && c.daysRemainingInRepair < 0 ? -c.daysRemainingInRepair : 0
                  const declaration = DECLARATION[c.declarationStatus] ?? { tone: "warn" as const, label: c.declarationStatus }
                  // A repair requested with no PO yet: no vendor and no date.
                  const requested = isPrOnly(c)
                  const department = requesterText(c)
                  return (
                    <TableRow
                      key={c.id}
                      data-i08-row
                      tabIndex={0}
                      aria-label={`Open repair ${c.id}`}
                      onClick={(event) => openFromRow(event, href)}
                      onAuxClick={(event) => openFromRow(event, href)}
                      onKeyDown={(event) => openFromKeyboard(event, href)}
                      className="cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                    >
                      <Cell frozen>
                        <MaterialCell
                          code={c.material.materialCode}
                          description={c.material.description}
                          href={href}
                          extra={
                            c.qtyUnderRepair > 1 && !columns.includes("qty") ? (
                              <span className="rounded-full bg-accent px-1.5 font-sans text-xs font-semibold text-accent-foreground">
                                × {formatCount(c.qtyUnderRepair)}
                              </span>
                            ) : undefined
                          }
                        />
                      </Cell>
                      <Cell>
                        <span
                          className="font-mono text-[12.5px] whitespace-nowrap"
                          title={
                            requested
                              ? "The PR raised for this repair; no PO yet"
                              : "The PR this repair PO line was raised from"
                          }
                        >
                          {repairPrLabel(c)}
                        </span>
                      </Cell>
                      <Cell wrap>
                        <span title={c.plant.name}>{plantShort(c.plant.name)}</span>
                      </Cell>
                      <Cell>
                        {requested ? (
                          <span className="text-muted-foreground" title="No PO yet, so no vendor">
                            —
                          </span>
                        ) : (
                          <span className="block truncate" title={c.vendor ? `${vendorLabel(c)} (vendor ${c.vendor})` : vendorLabel(c)}>
                            {vendorLabel(c)}
                          </span>
                        )}
                      </Cell>
                      <Cell wrap>
                        {/* Who asked: the department code, with its name when the
                            department list knows it. */}
                        {department ? (
                          <span className="line-clamp-2 text-[13px] leading-snug" title={department}>
                            {department}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </Cell>
                      <Cell>
                        {requested ? (
                          <span title={stageLabel(c.repairStatus)}>{REPAIR_REQUESTED_SHORT}</span>
                        ) : (
                          stageLabel(c.repairStatus)
                        )}
                      </Cell>
                      <Cell>
                        {requested ? (
                          <div className="flex flex-col gap-0.5 leading-snug" title={`PR ${requestedAgo(c.daysOpen)}`}>
                            <span className="text-muted-foreground">{NO_PO_YET}</span>
                            <StatusDot tone="muted" small>
                              {requestedAgoShort(c.daysOpen)}
                            </StatusDot>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-0.5 leading-snug">
                            <span>{c.expectedReturn ?? <span className="text-muted-foreground">No date</span>}</span>
                            {overdue === "OVERDUE" ? (
                              <StatusDot tone="crit" strong small>
                                {late ? `${plural(late, "day")} late` : "Late"}
                              </StatusDot>
                            ) : overdue === "NO_DUE_DATE" ? (
                              <StatusDot tone="warn" small>
                                No date agreed
                              </StatusDot>
                            ) : c.daysRemainingInRepair !== undefined && c.daysRemainingInRepair >= 0 ? (
                              <StatusDot tone="muted" small>
                                due in {plural(c.daysRemainingInRepair, "day")}
                              </StatusDot>
                            ) : null}
                          </div>
                        )}
                      </Cell>
                      <Cell right>{formatCount(c.daysOpen)}</Cell>
                      <Cell wrap>
                        {/* A PR row shows its declaration status like a PO line. */}
                        <span
                          title={
                            c.declaredAt
                              ? `Declared ${c.declaredAt}${c.condition ? `: ${c.condition}` : ""}`
                              : declaration.hint
                          }
                        >
                          <StatusDot tone={declaration.tone} wrap>
                            {declaration.label}
                          </StatusDot>
                        </span>
                      </Cell>
                      {columns.includes("qty") && <Cell right>{formatCount(c.qtyUnderRepair)}</Cell>}
                      {columns.includes("crit") && (
                        <Cell>
                          {c.criticality === "CRITICAL" ? (
                            <StatusDot tone="crit">Critical</StatusDot>
                          ) : c.criticality ? (
                            c.criticality.charAt(0) + c.criticality.slice(1).toLowerCase()
                          ) : (
                            <span className="text-muted-foreground" title="No criticality rating is recorded for this material in ZMM065">
                              Not rated
                            </span>
                          )}
                        </Cell>
                      )}
                      {columns.includes("po") && (
                        <Cell>
                          {c.repairPO ? (
                            <span className="font-mono text-[13px]">
                              {c.repairPO.documentNumber}
                              {c.repairPO.line ? `/${c.repairPO.line}` : ""}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">Not yet raised</span>
                          )}
                        </Cell>
                      )}
                      {/* Under the "+": nothing per row. */}
                      <td aria-hidden="true" />
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
                count={chains.length}
                noun="repair lines"
                hrefFor={(p) => withColumns(registerHref(filters, p), columns)}
              />
            </div>
          </>
        )}
      </ResultsCard>
    </I08Page>
  )
}

/**
 * The "+" at the end of the header row: adds and removes the optional columns,
 * as the "Columns" button above the table did until 3-Nov-2026. Its badge
 * says how many are on.
 */
function ColumnPicker({
  columns,
  onToggle,
}: {
  columns: OptionalColumn[]
  onToggle: (column: OptionalColumn, on: boolean) => void
}) {
  return (
    <PopoverButton label="Add or remove columns" icon={<Plus />} badge={columns.length || undefined} align="end" iconOnly>
      <p className="mb-2 text-[12.5px] text-muted-foreground">
        Always shown: material, repair PR, plant, vendor, department, stage, expected back, days open and
        declaration.
      </p>
      {OPTIONAL_COLUMNS.map((column) => (
        <label key={column.value} className="flex cursor-pointer items-center gap-2.5 rounded-md px-1 py-1.5 text-sm hover:bg-muted">
          <input
            type="checkbox"
            className="size-4 accent-[var(--primary)]"
            checked={columns.includes(column.value)}
            onChange={(event) => onToggle(column.value, event.target.checked)}
          />
          {column.label}
        </label>
      ))}
    </PopoverButton>
  )
}

/** Keeps the extra columns on when moving between pages. */
function withColumns(href: string, columns: string[]): string {
  if (columns.length === 0) return href
  return `${href}${href.includes("?") ? "&" : "?"}cols=${columns.join(",")}`
}
