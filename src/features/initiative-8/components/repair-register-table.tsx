"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState, type KeyboardEvent, type MouseEvent } from "react"
import Link from "next/link"
import { Columns3, Download, Loader2, SlidersHorizontal } from "lucide-react"

import { StickyScrollTable } from "@/components/shared/sticky-scroll-table"
import { TablePagination } from "@/components/shared/table-pagination"
import { Button } from "@/components/ui/button"
import { TableBody, TableHeader, TableRow } from "@/components/ui/table"
import { I08Cell as Cell, I08Head as Head } from "@/features/initiative-8/components/kit/table"
import { InfoPopover, PopoverButton } from "@/features/initiative-8/components/kit/info-popover"
import {
  FilterChips,
  MaterialCell,
  PanelField,
  QuickViews,
  ResultsCard,
} from "@/features/initiative-8/components/kit/list"
import { Dot, I08Page } from "@/features/initiative-8/components/kit/page"
import { StatusDot } from "@/features/initiative-8/components/kit/status"
import { UrlSearchInput, UrlSelect, useUrlFilters, withSelected } from "@/features/initiative-8/components/url-filters"
import { DEFAULT_EXCEPTION_STATUS, exceptionsHref } from "@/features/initiative-8/data/live-exceptions"
import {
  REGISTER_PATH,
  REGISTER_VIEWS,
  fetchAllRegisterLines,
  registerHref,
  type RegisterFacets,
  type RegisterFilters,
} from "@/features/initiative-8/data/live-register"
import type { RepairChain } from "@/features/initiative-8/types/repair"
import { i08DateTime, plantShort, plural, stageLabel } from "@/features/initiative-8/utils/format"
import { REGISTER_CSV_HEADERS, registerRowsToCsv } from "@/features/initiative-8/utils/register-view"
import {
  OVERDUE_STATUSES,
  OVERDUE_STATUS_LABEL,
  exceptionTypeLabel,
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
  /** The active aging bands, from the snapshot's rules. */
  agingBands: string[]
  filters: RegisterFilters
  viewCounts: ApiRegisterViewCounts | null
  sourceLoadedAt: string | null
}

/** The repair detail page for one register line. */
export function repairHref(chain: Pick<RepairChain, "id">): string {
  return `/repairable-spares/repair-register/${chain.id}`
}

/** Where the repair page's breadcrumb goes back to: the register as it was left. */
export const REGISTER_RETURN_KEY = "i08.register.lastHref"

/** The columns that are off by default, behind "Columns". */
const OPTIONAL_COLUMNS = [
  { value: "qty", label: "Qty under repair" },
  { value: "crit", label: "Criticality" },
  { value: "pr", label: "Repair PR" },
  { value: "po", label: "Repair PO" },
] as const
type OptionalColumn = (typeof OPTIONAL_COLUMNS)[number]["value"]

/** Widths, in %, of the eight default columns: they fit a 1366px laptop. */
const DEFAULT_WIDTHS = [22, 11, 15, 9, 13, 9, 12, 9]
const OPTIONAL_WIDTHS: Record<OptionalColumn, number> = { qty: 7, crit: 9, pr: 11, po: 11 }

const DECLARATION: Record<string, { tone: "warn" | "good" | "crit"; label: string }> = {
  Required: { tone: "warn", label: "Required" },
  Completed: { tone: "good", label: "Declared" },
  Flagged: { tone: "crit", label: "Against assessment" },
}

/** The filters that live behind "More filters". */
const MORE_FILTERS = ["criticality", "declarationStatus", "overdue", "aging", "exceptions"] as const

/**
 * The Repair Register (FR-10) -- I08_Live_UI_Redesign_Plan.md, L2.
 *
 * One row per repair PO line SAP still has open. Eight columns by default, so
 * the table fits a 1366px laptop: it was fourteen across 2,125px, and the
 * sideways scrollbar sat under the 25th row. The material number comes first
 * and the description once (it was shown twice per row). Lateness is said
 * once, as "113 days late" under the expected date. Colour only where it asks
 * for something: "PO issued" is plain text.
 *
 * Quick views (Overdue, Not declared, At vendor, With exceptions) sit above
 * four filters; the rest are under "More filters", and every filter that is
 * set shows as a removable chip. "Columns" brings back quantity, criticality,
 * PR and PO, and only then does the table scroll sideways -- with the pinned
 * scrollbar and the frozen Material column (`StickyScrollTable`). The Excel
 * export stays wide whatever is on screen.
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
  agingBands,
  filters,
  viewCounts,
  sourceLoadedAt,
}: RepairRegisterTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { push, isPending } = useUrlFilters(REGISTER_PATH)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  const columns = (searchParams.get("cols") ?? "")
    .split(",")
    .filter((value): value is OptionalColumn => OPTIONAL_COLUMNS.some((c) => c.value === value))
  const widths = [...DEFAULT_WIDTHS, ...columns.map((c) => OPTIONAL_WIDTHS[c])]
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

  const plantName = (id?: string) => facets.plants.find((p) => p.plantId === id)?.name ?? id
  const vendorName = (code?: string) => facets.vendors.find((v) => v.value === code)?.label ?? code
  const chips = [
    filters.q && { key: "q", label: `Search: “${filters.q}”` },
    filters.plant && { key: "plant", label: `Plant: ${plantName(filters.plant)}` },
    filters.vendor && { key: "vendor", label: `Vendor: ${vendorName(filters.vendor)}` },
    filters.repairStatus && { key: "repairStatus", label: `Stage: ${stageLabel(filters.repairStatus)}` },
    filters.stageAging && { key: "stageAging", label: `${filters.stageAging.replace("-", "–")} days in stage` },
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
    filters.exceptions && { key: "exceptions", label: "With exceptions" },
  ].filter((chip): chip is { key: string; label: string } => Boolean(chip))
  const moreSet = MORE_FILTERS.filter((key) => filters[key]).length

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
      exceptions: undefined,
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

  return (
    <I08Page
      crumbs={[{ label: "Repairable Spares", href: "/repairable-spares" }, { label: "Repair Register" }]}
      title="Repair Register"
      summary={
        <>
          <span>{plural(meta.openLines, "open repair line")}</span>
          <Dot />
          <span>{plural(meta.distinctMaterials, "material")}</span>
          {sourceLoadedAt && (
            <>
              <Dot />
              <span>SAP data loaded {i08DateTime(sourceLoadedAt)}</span>
            </>
          )}
          <InfoPopover title="What this list holds">
            <p>
              Every repair PO line SAP still has open, for 80-series materials. A line leaves the list when SAP
              marks it delivery completed.
            </p>
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
          <PopoverButton label="Columns" icon={<Columns3 />} badge={columns.length || undefined} align="end">
            <p className="mb-2 text-[12.5px] text-muted-foreground">
              Always shown: material, plant, vendor, stage, expected back, days open, declaration and
              exceptions.
            </p>
            {OPTIONAL_COLUMNS.map((column) => (
              <label key={column.value} className="flex cursor-pointer items-center gap-2.5 rounded-md px-1 py-1.5 text-sm hover:bg-muted">
                <input
                  type="checkbox"
                  className="size-4 accent-[var(--primary)]"
                  checked={columns.includes(column.value)}
                  onChange={(event) => toggleColumn(column.value, event.target.checked)}
                />
                {column.label}
              </label>
            ))}
          </PopoverButton>
          <Button size="lg" variant="outline" className="px-3.5" onClick={() => void exportExcel()} disabled={exporting || total === 0}>
            {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            Export Excel
          </Button>
        </>
      }
    >
      <QuickViews
        choices={REGISTER_VIEWS.map((view) => ({
          value: view.value,
          label: view.label,
          count: viewCounts ? viewCounts[view.value === "" ? "all" : view.value] : undefined,
        }))}
        value={filters.view ?? ""}
        onSelect={(value) => push({ view: value || undefined })}
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">
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
        <PopoverButton label="More filters" icon={<SlidersHorizontal />} badge={moreSet || undefined}>
          <div className="grid gap-3">
            {/* FR-10 asks for the register to be filterable by criticality. */}
            <PanelField label="Criticality">
              <UrlSelect
                value={filters.criticality ?? ""}
                onChange={(value) => push({ criticality: value })}
                allLabel="All criticalities"
                options={choices(facets.criticalities, filters.criticality)}
              />
            </PanelField>
            <PanelField label="Declaration">
              <UrlSelect
                value={filters.declarationStatus ?? ""}
                onChange={(value) => push({ declarationStatus: value })}
                allLabel="Any declaration"
                options={Object.entries(DECLARATION).map(([value, d]) => ({ value, label: d.label }))}
              />
            </PanelField>
            <PanelField label="Due date">
              <UrlSelect
                value={filters.overdue ?? ""}
                onChange={(value) => push({ overdue: value })}
                allLabel="Any due date"
                options={OVERDUE_STATUSES.map((s) => ({ value: s, label: OVERDUE_STATUS_LABEL[s] }))}
              />
            </PanelField>
            <PanelField label="Days open">
              <UrlSelect
                value={filters.aging ?? ""}
                onChange={(value) => push({ aging: value })}
                allLabel="Any age"
                options={choices(
                  agingBands.map((b) => ({ value: b, label: `${b.replace("-", "–")} days` })),
                  filters.aging,
                )}
              />
            </PanelField>
            <PanelField label="Exceptions">
              <UrlSelect
                value={filters.exceptions ? "1" : ""}
                onChange={(value) => push({ exceptions: value || undefined })}
                allLabel="With or without"
                options={[{ value: "1", label: "With exceptions only" }]}
              />
            </PanelField>
          </div>
        </PopoverButton>
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
            <StickyScrollTable tableClassName={cn("table-fixed", columns.length > 0 && "min-w-[1320px]")}>
              <colgroup>
                {widths.map((width, index) => (
                  <col key={index} style={{ width: `${((width / widthTotal) * 100).toFixed(2)}%` }} />
                ))}
              </colgroup>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <Head frozen>Material</Head>
                  <Head>Plant</Head>
                  <Head>Vendor</Head>
                  <Head>Stage</Head>
                  <Head>Expected back</Head>
                  <Head right>Days open</Head>
                  <Head>Declaration</Head>
                  <Head>Exceptions</Head>
                  {columns.includes("qty") && <Head right>Qty</Head>}
                  {columns.includes("crit") && <Head>Criticality</Head>}
                  {columns.includes("pr") && <Head>Repair PR</Head>}
                  {columns.includes("po") && <Head>Repair PO</Head>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {chains.map((c) => {
                  const href = repairHref(c)
                  const overdue = overdueStatusOf(c)
                  const late = c.daysRemainingInRepair !== undefined && c.daysRemainingInRepair < 0 ? -c.daysRemainingInRepair : 0
                  const declaration = DECLARATION[c.declarationStatus] ?? { tone: "warn" as const, label: c.declarationStatus }
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
                      <Cell wrap>
                        <span title={c.plant.name}>{plantShort(c.plant.name)}</span>
                      </Cell>
                      <Cell>
                        <span className="block truncate" title={c.vendor ? `${vendorLabel(c)} (vendor ${c.vendor})` : vendorLabel(c)}>
                          {vendorLabel(c)}
                        </span>
                      </Cell>
                      <Cell>{stageLabel(c.repairStatus)}</Cell>
                      <Cell>
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
                      </Cell>
                      <Cell right>{formatCount(c.daysOpen)}</Cell>
                      <Cell>
                        <span
                          title={
                            c.declaredAt
                              ? `Declared ${c.declaredAt}${c.condition ? `: ${c.condition}` : ""}`
                              : undefined
                          }
                        >
                          <StatusDot tone={declaration.tone}>{declaration.label}</StatusDot>
                        </span>
                      </Cell>
                      <Cell>
                        {c.exceptions === undefined ? (
                          <span className="text-[12.5px] text-muted-foreground" title="The checks were not read for this line, so its findings are unknown.">
                            Not checked
                          </span>
                        ) : c.exceptions.length === 0 ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <Link
                            href={exceptionsHref({ status: DEFAULT_EXCEPTION_STATUS, repair: c.id })}
                            title={c.exceptions.map((e) => exceptionTypeLabel(e.type)).join(" · ")}
                            aria-label={`${plural(c.exceptions.length, "exception")}: ${c.exceptions
                              .map((e) => exceptionTypeLabel(e.type))
                              .join(", ")}`}
                            className="inline-grid h-[22px] min-w-[26px] place-items-center rounded-full border border-i08-warn-border bg-i08-warn-tint px-2 text-[12.5px] font-semibold text-i08-warn-ink transition-[filter] hover:brightness-95"
                          >
                            {c.exceptions.length}
                          </Link>
                        )}
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
                      {columns.includes("pr") && (
                        <Cell>
                          <span className="font-mono text-[13px]">
                            {c.repairPR.documentNumber}
                            {c.repairPR.line ? `/${c.repairPR.line}` : ""}
                          </span>
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

/** Keeps the extra columns on when moving between pages. */
function withColumns(href: string, columns: string[]): string {
  if (columns.length === 0) return href
  return `${href}${href.includes("?") ? "&" : "?"}cols=${columns.join(",")}`
}
