"use client"

// The management view of a generated quarterly report (report version 1.2): what happened in each month, how
// the cards were measured, and the Overview's own four charts for the period.
//
// Everything here is read from the saved report's `management` section -- the page, the PDF and the Excel
// export show one set of figures. Nothing is fetched except the list of the period's recommendations at the bottom,
// which is a list, not the population the figures above are over.
//
// A figure that is not available says so and says why. Nothing is drawn as 0, and a stockout measurement that is too
// old for the period is never shown as the period's position.

import { useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import { AlertTriangle, ArrowLeftRight, Boxes, CheckCircle2, ClipboardList, Clock, Info, Layers, Repeat, Search, Wallet } from "lucide-react"

import { ChartCard } from "@/components/shared/chart-card"
import type { InfoTone } from "@/components/shared/info-popup"
import { MaterialIdentity } from "@/components/shared/material-identity"
import { InfoPopup } from "@/components/shared/info-popup"
import { StatusBadge } from "@/components/shared/status-badge"
import { buttonVariants } from "@/components/ui/button"
import { LoadingSpinner } from "@/components/shared/loading-spinner"
import { StickyScrollTable } from "@/components/shared/sticky-scroll-table"
import { TablePagination } from "@/components/shared/table-pagination"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn, formatCount, formatIsoDateDMY } from "@/lib/utils"
import { CRITICALITY_TIER_LABEL } from "@/features/initiative-7/components/dashboard-filters"
import { AdoptionRateCard, StockoutRiskDistribution } from "@/features/initiative-7/components/overview-widgets"
import { PortfolioKpiCard } from "@/features/initiative-7/components/inventory-portfolio-kpis"
import { ExcessPositionCard, StockoutPositionCard } from "@/features/initiative-7/components/plant-position-cards"
import {
  ActivityInfo,
  ApprovalStagesCard,
  CoverageStatusTable,
  ExcessByPlantValues,
  KpiGuide,
  MoreInfo,
  PerspectiveTag,
} from "@/features/initiative-7/components/monthly-report-sections"
import { OverviewInfo } from "@/features/initiative-7/components/overview-info-popup"
import { MinMaxConversionDialog } from "@/features/initiative-7/components/min-max-conversion-dialog"
import { PerformanceTrends } from "@/features/initiative-7/components/performance-trends-section"
import { MonthlyTrends, QuarterEndCard } from "@/features/initiative-7/components/quarterly-trends-section"
import { useLiveRecommendations } from "@/features/initiative-7/hooks/use-live-recommendations"
import type { ApiKpiCard, ApiQuarterlyReport, ApiQuarterManagement } from "@/features/initiative-7/types/api"
import type { Criticality, StockParameters } from "@/features/initiative-7/types/inventory"
import { pagedTableView } from "@/features/initiative-7/utils/paged-table-state"
import { anyRecommendedSafetyStock } from "@/features/initiative-7/utils/safety-stock-display"
import { stockFigure } from "@/features/initiative-7/utils/stock-figure"
import { reportKindOf, reportNoun } from "@/features/initiative-7/utils/report-period"
import {
  activityCell,
  adoptionSummaryOf,
  cardCaption,
  kpiValueText,
  num,
  orderedKpis,
  pageCardTitle,
  pageDenominatorLabel,
  plantPositionsOf,
  rowAddsUp,
  stockoutUsable,
} from "@/features/initiative-7/utils/quarterly-management"
import { STATUS_FILTER_OPTIONS } from "@/features/initiative-7/utils/quarterly-sections"
import { ALL_FILTER, RECOMMENDATION_TYPE_OPTIONS } from "@/features/initiative-7/components/dashboard-filters"

const MATERIALS_PAGE_SIZE = 5

/** The two money cards are estimates of what the recommendations would change, whatever else they are measured as. */
const ESTIMATE_KEYS = new Set(["excess_inventory_opportunity", "working_capital_impact", "working_capital_stock", "working_capital_oar", "working_capital_potential"])

const CRITICALITY_TIER_TEXT: Record<Criticality, string> = {
  Critical: "text-destructive",
  High: "text-warning",
  Medium: "text-accent-foreground",
  Low: "text-muted-foreground",
}

const STATUS_TEXT: Record<string, string> = {
  "Pending Review": "text-warning",
  "In Approval": "text-warning",
  Approved: "text-success",
  Rejected: "text-destructive",
  Returned: "text-destructive",
  Implemented: "text-success",
}

/** The day after an ISO date, as an ISO date: the exclusive upper bound a period filter uses. */
export function dayAfter(iso: string): string {
  const next = new Date(`${iso}T00:00:00Z`)
  next.setUTCDate(next.getUTCDate() + 1)
  return next.toISOString().slice(0, 10)
}

// --- Period ----------------------------------------------------------------------------------------

function PeriodBanner({ management }: { management: ApiQuarterManagement }) {
  const { period } = management
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone={period.status === "COMPLETE" ? "success" : "warning"}>
          {period.status === "COMPLETE" ? "Complete period" : "In progress"}
        </StatusBadge>
        <span className="text-xs text-muted-foreground">{period.note}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {period.months.map((month) => (
          <span
            key={month.month}
            className={cn(
              "rounded-md border px-2 py-0.5 text-[11px]",
              month.usable ? "border-success/40 text-foreground" : "border-dashed border-border text-muted-foreground",
            )}
            title={
              month.usable
                ? "Started, and the staged SAP consumption covers it"
                : month.state === "not_started"
                  ? "This month has not started"
                  : "The staged SAP consumption does not cover this month"
            }
          >
            {month.label} · {month.usable ? "usable data" : month.state === "not_started" ? "not started" : "no consumption data"}
          </span>
        ))}
      </div>
    </div>
  )
}

// --- KPI cards -------------------------------------------------------------------------------------

// The same icon and accent the Overview's cards use for the same figures.
const CARD_LOOK: Record<string, { icon: ReactNode; tone: InfoTone }> = {
  materials_assessed: { icon: <Boxes className="size-3.5" />, tone: "info" },
  recommendations_generated: { icon: <ClipboardList className="size-3.5" />, tone: "info" },
  critical_stockout_risk: { icon: <AlertTriangle className="size-3.5" />, tone: "danger" },
  excess_inventory_opportunity: { icon: <Layers className="size-3.5" />, tone: "info" },
  working_capital_impact: { icon: <Wallet className="size-3.5" />, tone: "success" },
  working_capital_stock: { icon: <Wallet className="size-3.5" />, tone: "success" },
  working_capital_oar: { icon: <Wallet className="size-3.5" />, tone: "success" },
  working_capital_potential: { icon: <Wallet className="size-3.5" />, tone: "info" },
  pending_approval: { icon: <Clock className="size-3.5" />, tone: "warning" },
  approved: { icon: <CheckCircle2 className="size-3.5" />, tone: "success" },
  oar_recommendations: { icon: <Repeat className="size-3.5" />, tone: "info" },
  min_max_conversion: { icon: <ArrowLeftRight className="size-3.5" />, tone: "success" },
}

/** One card, drawn as the Overview draws its own, without the (i): the figure, one plain line, and what it covers. What
 * a reader must not miss stays on the card: when a figure is not available it says why, and a figure worked out from
 * current data (rather than a saved month-end snapshot) says so. The report's longer explanation and notes for the card
 * are in the PDF and the Excel. */
function ManagementKpiCard({ card, onOpen }: { card: ApiKpiCard; onOpen?: () => void }) {
  const available = card.status === "AVAILABLE" && num(card.value) !== null
  const look = CARD_LOOK[card.key] ?? { icon: <Info className="size-3.5" />, tone: "info" as const }
  const title = pageCardTitle(card)
  const measured =
    card.measured_on && card.kind !== "STATUS_AS_OF" && card.kind !== "MEASUREMENT"
      ? ` · ${formatIsoDateDMY(card.measured_on)}`
      : ""
  const covers =
    card.denominator !== null ? ` · of ${formatCount(card.denominator)} ${pageDenominatorLabel(card)}`.trimEnd() : ""
  const measuredNow = available && card.kind === "MEASUREMENT" && card.basis === "current_calculation"
  const body = (
    <PortfolioKpiCard
      title={title}
      icon={look.icon}
      tone={look.tone}
      value={kpiValueText(card)}
      suffix={available && !ESTIMATE_KEYS.has(card.key) ? card.unit : undefined}
      caption={cardCaption(card)}
      note={`${card.period_label}${measured}${covers}`}
      styled
    >
      {card.basis === "snapshot" && (
        <span className="text-[10px] font-medium tracking-[0.4px] text-success uppercase">Saved at month end</span>
      )}
      {measuredNow && <span className="text-xs text-muted-foreground">Based on today&apos;s figures</span>}
      {!available && card.unavailable_reason && (
        <MoreInfo summary="Why is this not shown?" className="text-warning">
          {card.unavailable_reason}
        </MoreInfo>
      )}
      {onOpen && (card.denominator ?? 0) > 0 && <span className="text-xs font-medium text-action">Click to see the materials</span>}
    </PortfolioKpiCard>
  )
  if (!onOpen) return body
  // A card that opens the list of materials behind its number: a button in behaviour, still the Overview's card to look at.
  return (
    <div
      role="button"
      tabIndex={0}
      aria-haspopup="dialog"
      aria-label={`${title}: show the materials`}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onOpen()
        }
      }}
      className="cursor-pointer rounded-xl focus-visible:ring-2 focus-visible:ring-action/40 focus-visible:outline-none"
    >
      {body}
    </div>
  )
}

// --- Activity by month -----------------------------------------------------------------------------

function ActivityTable({ management, totalLabel }: { management: ApiQuarterManagement; totalLabel: string }) {
  const { months, rows } = management.monthly_activity
  return (
    <>
      <div className="rounded-lg border border-border">
        <StickyScrollTable
          widths={[30, ...Array.from({ length: months.length + 1 }, () => 70 / (months.length + 1))]}
          minWidth={240 + (months.length + 1) * 100}
          wrapCells
        >
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead>Metric</TableHead>
              {months.map((m) => (
                <TableHead key={m.month} className="text-right">
                  {m.label}
                </TableHead>
              ))}
              <TableHead className="text-right">{totalLabel}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const adds = rowAddsUp(row)
              return (
                <TableRow key={row.key}>
                  <TableCell>
                    <div className="font-medium text-foreground">{row.label}</div>
                    <div className="text-[11px] text-muted-foreground">{row.unit}</div>
                  </TableCell>
                  {row.months.map((value, i) => (
                    <TableCell key={months[i]?.month ?? i} className="text-right tabular-nums">
                      {num(value) === null ? <span className="text-muted-foreground">—</span> : activityCell(value)}
                    </TableCell>
                  ))}
                  <TableCell className="text-right font-medium tabular-nums">
                    {num(row.quarter_total) === null ? <span className="font-normal text-muted-foreground">—</span> : activityCell(row.quarter_total)}
                    {(adds === false || row.reconciles === false) && (
                      <span className="ml-1 text-[10px] font-normal text-destructive" title="The months do not add up to the total counted over the whole period">
                        ⚠
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </StickyScrollTable>
      </div>
    </>
  )
}

// --- The period's recommendations ------------------------------------------------------------------

/** The table's type filter: every recommendation, only the OAR ones, or only the stock items (everything that is not
 * OAR) -- the same two groups the Recommendations page lists. */
type PeriodTypeFilter = "all" | (typeof RECOMMENDATION_TYPE_OPTIONS)[number]["value"]

function periodTypeLabel(value: PeriodTypeFilter): string {
  return value === "all" ? "All recommendations" : (RECOMMENDATION_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? value)
}

/** "Oct 2026" for a one-month report, the quarter's own name ("Q4 2026") otherwise. */
function periodName(report: ApiQuarterlyReport): string {
  const start = new Date(`${report.metadata.period_start}T00:00:00`)
  const end = new Date(`${report.metadata.period_end}T00:00:00`)
  return start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()
    ? start.toLocaleDateString("en-US", { month: "short", year: "numeric" })
    : report.metadata.quarter
}

/** The month (or quarter) the figures below are for, in place of an "as of today" tag. */
function PeriodBadge({ report }: { report: ApiQuarterlyReport }) {
  return (
    <span
      title="The recommendations behind these figures were generated in this period"
      className="mb-2 inline-flex w-fit items-center rounded-md border border-primary/40 px-2 py-0.5 text-xs font-medium tracking-[0.4px] text-primary uppercase"
    >
      {periodName(report)}
    </span>
  )
}

function PeriodMaterials({ report }: { report: ApiQuarterlyReport }) {
  const [page, setPage] = useState(1)
  const [type, setType] = useState<PeriodTypeFilter>("all")
  const [statusKey, setStatusKey] = useState("all")
  const { period_start, period_end } = report.metadata
  const statusOption = STATUS_FILTER_OPTIONS.find((option) => option.value === statusKey) ?? STATUS_FILTER_OPTIONS[0]

  function chooseStatus(next: string) {
    setStatusKey(next)
    setPage(1)
  }

  // A different group is a different list: back to its first page, not a page that may not exist.
  function chooseType(next: PeriodTypeFilter) {
    setType(next)
    setPage(1)
  }

  const { data, total, loading } = useLiveRecommendations({
    sort: "generated_at",
    sortDesc: true,
    page,
    pageSize: MATERIALS_PAGE_SIZE,
    type: type === "all" ? undefined : type,
    // The period itself, half-open: a record stamped late on the last day is in it, one on the next day is not.
    generatedFrom: `${period_start}T00:00:00`,
    generatedTo: `${dayAfter(period_end)}T00:00:00`,
    // Only what SAP has adopted (the reconciliation's ADOPTED result), not every recommendation generated.
    adoptedInSap: true,
    ...statusOption.query,
  })
  const view = pagedTableView(loading, data)
  // The Safety stock column only when some listed recommendation carries one: a column of dashes says nothing.
  const showSafetyStock = anyRecommendedSafetyStock(data ?? [])
  return (
    <ChartCard
      size="large"
      title={`Adopted recommendations in ${periodName(report)}`}
      subtitle="Newest first. Only adopted recommendations are listed: those SAP now holds. The numbers above cover all recommendations, not only these."
      span={12}
      info={
        <div className="flex flex-wrap items-center justify-end gap-2">
        <Select value={statusKey} onValueChange={(v) => chooseStatus((v as string | null) ?? "all")}>
          <SelectTrigger className="h-8 w-[170px]" aria-label="Show recommendations with status">
            <SelectValue placeholder="All statuses">
              {(v: string) => STATUS_FILTER_OPTIONS.find((option) => option.value === v)?.label ?? "All statuses"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTER_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={(v) => chooseType((v as PeriodTypeFilter | null) ?? "all")}>
          <SelectTrigger className="h-8 w-[190px]" aria-label="Show recommendations for">
            <SelectValue placeholder="All recommendations">{(v: string) => periodTypeLabel(v as PeriodTypeFilter)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{periodTypeLabel("all")}</SelectItem>
            {RECOMMENDATION_TYPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        </div>
      }
    >
      <PerspectiveTag perspective="monthly" />
      {view === "skeleton" ? (
        <LoadingSpinner label="Loading recommendations" className="h-48 w-full" />
      ) : view === "rows" && data && data.length > 0 ? (
        <div className="flex flex-col gap-3">
          <div className={cn("rounded-lg border border-border transition-opacity", loading && "opacity-50")} aria-busy={loading}>
            <StickyScrollTable
              tableClassName="text-base"
              widths={showSafetyStock ? [22, 8, 8, 12, 10, 10, 10, 10, 10] : [24, 9, 9, 14, 11, 11, 11, 11]}
              minWidth={900}
              wrapCells
            >
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead>Material</TableHead>
                  <TableHead>Plant</TableHead>
                  <TableHead>Crit.</TableHead>
                  <TableHead>Demand pattern</TableHead>
                  {showSafetyStock && <TableHead className="text-right">Safety stock</TableHead>}
                  <TableHead className="text-right">Reorder point</TableHead>
                  <TableHead className="text-right">Max stock</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Generated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((rec) => (
                  <TableRow key={rec.id}>
                    <TableCell>
                      <Link href={`/inventory-planning/recommendations/${rec.id}`} className="hover:underline">
                        <MaterialIdentity material={rec.material} />
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{rec.plantId}</TableCell>
                    <TableCell>
                      <span className={cn("text-xs font-medium", CRITICALITY_TIER_TEXT[rec.criticality as Criticality])}>
                        {CRITICALITY_TIER_LABEL[rec.criticality as Criticality]}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{rec.demandPattern}</TableCell>
                    {showSafetyStock && (
                      <TableCell className="text-right font-mono text-[15px] tabular-nums">
                        {/* A dash, never a 0, for a recommendation that carries no safety stock. */}
                        {figureCell(stockFigure(rec, "recommended", "safetyStock"))}
                      </TableCell>
                    )}
                    <TableCell className="text-right font-mono text-[15px] tabular-nums">
                      {formatCount(rec.recommended.rop)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-[15px] tabular-nums">
                      {formatCount(rec.recommended.maxStock)}
                    </TableCell>
                    <TableCell>
                      <span className={cn("text-xs font-medium", STATUS_TEXT[rec.status] ?? "text-muted-foreground")}>{rec.status}</span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{rec.generatedAt}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </StickyScrollTable>
          </div>
          <TablePagination
            page={page}
            pageSize={MATERIALS_PAGE_SIZE}
            total={total}
            count={data.length}
            noun="recommendations"
            loading={loading}
            alwaysShowButtons
            onPageChange={setPage}
          />
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">
          {type === "all" && statusKey === "all"
            ? "No recommendation generated in this period has been adopted in SAP yet."
            : `No ${type === "all" ? "" : `${periodTypeLabel(type)} `}recommendations${statusKey === "all" ? "" : ` with status “${statusOption.label}”`} generated in this period have been adopted in SAP.`}
        </div>
      )}
    </ChartCard>
  )
}

// --- Current SAP against the recommendation, a row per recommendation -------------------------------------

const STOCK_LEVELS: { key: keyof StockParameters; label: string; sublabel: string }[] = [
  { key: "safetyStock", label: "Safety stock", sublabel: "demand buffer" },
  { key: "rop", label: "Reorder point", sublabel: "when to raise a PO" },
  { key: "maxStock", label: "Maximum stock", sublabel: "ceiling to hold" },
]

/** A few recommendations a page, each its own row: the table is each material's own figures, not an average over many. */
const COMPARE_PAGE_SIZE = 10

export { stockFigure }

/** From SAP's figure to the recommended one; null when either is missing, and no percentage from a starting 0. */
export function stockChange(current: number | null, recommended: number | null): { delta: number; percent: number | null } | null {
  if (current === null || recommended === null) return null
  const delta = recommended - current
  return { delta, percent: current !== 0 ? (delta / current) * 100 : null }
}


/** A figure, or a dash when it is missing -- never a 0 that nothing set. */
function figureCell(value: number | null) {
  return value === null ? (
    <span className="text-muted-foreground" title="No value is set">
      —
    </span>
  ) : (
    <span className="tabular-nums">{formatCount(value)}</span>
  )
}

/** What SAP holds against what I07 recommends, one row per recommendation generated in the period. Only recommendations
 * with at least one recommended value are listed (the backend's `has_recommended` filter): one that could not be computed
 * is not something to compare. A search narrows it to a material; the same material in another plant is its own row. */
function PeriodStockComparison({ report }: { report: ApiQuarterlyReport }) {
  const [page, setPage] = useState(1)
  const [input, setInput] = useState("")
  const [query, setQuery] = useState("")
  const { period_start, period_end } = report.metadata

  // The search runs a moment after typing stops, so a request is not sent for every keystroke.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(input.trim())
      setPage(1)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [input])

  const { data, total, loading } = useLiveRecommendations({
    sort: "generated_at",
    sortDesc: true,
    page,
    pageSize: COMPARE_PAGE_SIZE,
    generatedFrom: `${period_start}T00:00:00`,
    generatedTo: `${dayAfter(period_end)}T00:00:00`,
    search: query || undefined,
    // Only OAR materials the conversion rule allows to move to Min-Max, with a recommended value: the same set as the OAR card.
    // Everything else is on the Recommendations page, which the link below leads to.
    type: "oar",
    conversionEligibility: "ELIGIBLE",
    hasRecommended: true,
  })
  const view = pagedTableView(loading, data)
  // The Safety stock pair only when some listed recommendation carries a safety stock: a pair of dashes says nothing.
  const levels = STOCK_LEVELS.filter((level) => level.key !== "safetyStock" || anyRecommendedSafetyStock(data ?? []))

  return (
    <ChartCard
      size="large"
      highlightSubtitle
      title={`Current vs recommended in ${periodName(report)}`}
      subtitle={
        query
          ? `Eligible OAR materials matching “${query}”.`
          : "These are the eligible OAR materials only (OAR materials that can move to Min-Max ordering)."
      }
      span={12}
      info={
        <div className="relative w-[260px]">
          <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-action" aria-hidden />
          <Input
            type="search"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Search a material"
            aria-label="Search a material by number or description"
            className="h-9 border-action bg-action/10 pl-8 font-semibold text-foreground shadow-sm placeholder:font-normal placeholder:text-action/70 focus-visible:border-action focus-visible:ring-action/30"
          />
        </div>
      }
    >
      <PeriodBadge report={report} />
      {view === "skeleton" ? (
        <LoadingSpinner label="Loading recommendations" className="h-48 w-full" />
      ) : view === "rows" && data && data.length > 0 ? (
        <div className="flex flex-col gap-3">
          <div className={cn("rounded-lg border border-border transition-opacity", loading && "opacity-50")} aria-busy={loading}>
            <StickyScrollTable tableClassName="text-base" widths={levels.length === 3 ? [28, 8, 11, 11, 11, 11, 10, 10] : [34, 10, 14, 14, 14, 14]} minWidth={900} wrapCells>
              <TableHeader>
                <TableRow className="bg-action/10 hover:bg-action/10">
                  <TableHead rowSpan={2} className="align-bottom">
                    Material
                  </TableHead>
                  <TableHead rowSpan={2} className="align-bottom">
                    Plant
                  </TableHead>
                  {levels.map((level) => (
                    <TableHead key={level.key} colSpan={2} className="border-l border-action/20 text-center font-semibold text-action">
                      {level.label}
                    </TableHead>
                  ))}
                </TableRow>
                <TableRow className="bg-action/10 hover:bg-action/10">
                  {levels.flatMap((level) => [
                    <TableHead key={`${level.key}-now`} className="border-l border-action/20 text-right text-sm font-normal text-muted-foreground">
                      SAP now
                    </TableHead>,
                    <TableHead key={`${level.key}-suggested`} className="bg-action/10 text-right text-sm font-semibold text-action">
                      Suggested
                    </TableHead>,
                  ])}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((rec) => (
                  <TableRow key={rec.id} className="even:bg-muted/30">
                    <TableCell className="whitespace-normal">
                      <Link href={`/inventory-planning/recommendations/${rec.id}`} className="block hover:underline">
                        <span className="block font-medium text-foreground">{rec.material.description}</span>
                        {rec.material.materialCode !== rec.material.description && (
                          <span className="block text-sm text-muted-foreground">{rec.material.materialCode}</span>
                        )}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{rec.plantId}</TableCell>
                    {levels.flatMap((level) => [
                      <TableCell key={`${level.key}-now`} className="border-l border-action/20 text-right text-muted-foreground">
                        {figureCell(stockFigure(rec, "current", level.key))}
                      </TableCell>,
                      <TableCell key={`${level.key}-suggested`} className="bg-action/5 text-right text-lg font-semibold text-action">
                        {figureCell(stockFigure(rec, "recommended", level.key))}
                      </TableCell>,
                    ])}
                  </TableRow>
                ))}
              </TableBody>
            </StickyScrollTable>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-action/40 border-l-4 border-l-action bg-action/10 px-3 py-2.5">
            <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Info className="size-4 shrink-0 text-action" aria-hidden />
              Only eligible OAR materials are listed here. Stock items and other materials are on the Recommendations page.
            </span>
            <Link
              href="/inventory-planning/recommendations"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "whitespace-nowrap border-action font-semibold text-action hover:text-action")}
            >
              See other recommendations →
            </Link>
          </div>
          <TablePagination
            page={page}
            pageSize={COMPARE_PAGE_SIZE}
            total={total}
            count={data?.length ?? 0}
            noun="eligible OAR materials"
            loading={loading}
            alwaysShowButtons
            onPageChange={setPage}
          />
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">
          {query
            ? `No eligible OAR material from this period matches “${query}”.`
            : "No eligible OAR material with a recommended value was generated in this period."}{" "}
          <Link href="/inventory-planning/recommendations" className="font-medium text-action hover:underline">
            See other recommendations →
          </Link>
        </div>
      )}
    </ChartCard>
  )
}

// --- Data coverage ---------------------------------------------------------------------------------

/** What the Data coverage popup holds: what needs attention first, then every source, the months, the limitations and what the
 * figures mean. Its own component so it can be read without opening the popup. */
export function DataCoverageBody({ management }: { management: ApiQuarterManagement }) {
  const c = management.data_coverage
  return (
    <div className="flex flex-col gap-4 text-sm">
      <section className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold tracking-wide text-warning uppercase">Needs attention</h3>
        <CoverageStatusTable management={management} problemsOnly />
      </section>
      <section className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold tracking-wide text-warning uppercase">Every source</h3>
        <CoverageStatusTable management={management} />
        {/* A report saved before the statuses existed has only the dates. */}
        {!c.items?.length && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
            {[
              ["Latest consumption (goods issue)", c.latest_consumption_date ? formatIsoDateDMY(c.latest_consumption_date) : null],
              ["Stockout usage measured as of", c.stockout_usage_as_of ? formatIsoDateDMY(c.stockout_usage_as_of) : null],
              ["Stock on hand last loaded", c.latest_stock_loaded_at ? formatIsoDateDMY(c.latest_stock_loaded_at.slice(0, 10)) : null],
              ["Recommendations counted", formatCount(c.eligible_recommendations)],
              ["Material-plants assessed", formatCount(c.eligible_material_plants)],
            ].map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase">{label}</dt>
                <dd className="mt-0.5 text-[13px] text-foreground">{value ?? <span className="text-muted-foreground">Not available</span>}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>
      <section className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold tracking-wide text-warning uppercase">Months</h3>
        <p className="text-xs text-muted-foreground">
          Figures are: <span className="font-medium text-foreground">{c.basis === "snapshot" ? "Saved month-end snapshots" : "Current calculations"}</span>
        </p>
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead>Month</TableHead>
                <TableHead>SAP consumption data</TableHead>
                <TableHead className="text-right">Recommendations generated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {c.months.map((m) => (
                <TableRow key={m.month}>
                  <TableCell>{m.label}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {{ AVAILABLE: "Covered", NO_ACTIVITY: "Covered, no movements", NOT_COVERED: "Not covered", NO_SOURCE_DATA: "No data loaded" }[m.consumption_status]}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatCount(m.recommendations_generated)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
      {c.warnings.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold tracking-wide text-warning uppercase">Limitations</h3>
          <ul className="flex list-disc flex-col gap-1 pl-4 text-xs leading-relaxed text-muted-foreground">
            {c.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </section>
      )}
      <section className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold tracking-wide text-warning uppercase">What the figures on this page mean</h3>
        <ul className="flex list-disc flex-col gap-1 pl-4 text-xs leading-relaxed text-muted-foreground">
          {management.definitions.map((definition) => (
            <li key={definition}>{definition}</li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function DataCoverageCard({ management }: { management: ApiQuarterManagement }) {
  // One button, the same popup the (i) buttons open: what needs attention first, then everything behind it.
  return (
    <InfoPopup
      title="Data coverage and limitations"
      description="Where these figures come from, and anything missing or old."
      tone="warning"
      triggerLabel="Data coverage and limitations"
      triggerText="Data coverage and limitations"
      className="size-auto h-8 gap-1.5 border border-border bg-card px-3"
    >
      <DataCoverageBody management={management} />
    </InfoPopup>
  )
}

// --- The view --------------------------------------------------------------------------------------

/** A chart with nothing to draw: what is missing in one short line, and the full reason one click away. */
function NotAvailableChart({ summary, reason }: { summary: string; reason: string }) {
  return (
    <div className="flex h-[150px] w-full flex-col items-center justify-center gap-1 text-center text-xs text-muted-foreground">
      <p className="font-medium text-foreground">Not available</p>
      <p className="max-w-sm leading-relaxed">{summary}</p>
      <MoreInfo summary="Why?" className="max-w-sm">
        {reason}
      </MoreInfo>
    </div>
  )
}

export function QuarterlyManagementView({ report, management }: { report: ApiQuarterlyReport; management: ApiQuarterManagement }) {
  // A month or a quarter: the words and the trend charts follow it.
  const kind = reportKindOf(report.metadata.quarter)
  const usable = stockoutUsable(management)
  const stockout = management.position.stockout
  const staleReason = `${stockout.stale_note ?? "The stockout usage has not been built, so nothing can be judged."} This is not zero risk: it was not measured for the period.`
  // One short line for the chart; the full reason is behind "Why?".
  const staleSummary = `Not measured for ${report.metadata.quarter}.${stockout.as_of ? ` Last data: ${formatIsoDateDMY(stockout.as_of)}.` : ""}`
  const positions = plantPositionsOf(management)
  const adoption = adoptionSummaryOf(management.adoption)
  const [minMaxOpen, setMinMaxOpen] = useState(false)

  return (
    <>
      <PeriodBanner management={management} />

      <div className="flex items-center justify-end gap-2">
        <DataCoverageCard management={management} />
        <KpiGuide cards={management.kpis} />
      </div>

      {/* --- Cards: each says what kind of figure it is, when it was measured and over what --------- */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {orderedKpis(management.kpis).map((card) => (
          <ManagementKpiCard key={card.key} card={card} onOpen={card.key === "min_max_conversion" && (card.denominator ?? 0) > 0 ? () => setMinMaxOpen(true) : undefined} />
        ))}
      </div>
      <MinMaxConversionDialog
        open={minMaxOpen}
        onOpenChange={setMinMaxOpen}
        generatedFrom={`${report.metadata.period_start}T00:00:00`}
        generatedTo={`${dayAfter(report.metadata.period_end)}T00:00:00`}
        periodLabel={report.metadata.quarter}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* --- Right under the cards: the eligible OAR materials with the values we suggest, then what SAP has adopted ----- */}
        <PeriodStockComparison report={report} />

        <PeriodMaterials report={report} />

        {/* --- The Overview's charts, for the period ----------------------------------------------- */}
        <ChartCard
          title="Stockout Risk Distribution"
          subtitle="Materials that may run out before new stock arrives."
          span={6}
        >
          {usable ? (
            <StockoutRiskDistribution
              figures={{ atRisk: stockout.at_risk, evaluated: stockout.evaluated, insufficient: stockout.insufficient_data, asOf: stockout.as_of }}
              unavailable={staleReason}
            />
          ) : (
            <NotAvailableChart summary={staleSummary} reason={staleReason} />
          )}
        </ChartCard>
        <ChartCard
          title="Stockout risk by plant"
          subtitle="Where those materials are held."
          span={6}
        >
          {usable ? (
            <StockoutPositionCard state={{ positions, loading: false, error: null }} />
          ) : (
            <NotAvailableChart summary={staleSummary} reason={staleReason} />
          )}
        </ChartCard>
        <ChartCard
          title="Excess inventory by plant"
          subtitle="Materials holding more than the recommended maximum."
          info={<OverviewInfo id="excessByPlant" />}
          span={6}
        >
          <PerspectiveTag perspective={management.position_basis === "snapshot" ? "snapshot" : "current"} />
          <ExcessPositionCard state={{ positions, loading: false, error: null }} />
          <ExcessByPlantValues management={management} />
        </ChartCard>
        <ApprovalStagesCard adoption={management.adoption} periodName={periodName(report)} />
        <ChartCard
          title="SAP adoption"
          subtitle="Recommendations SAP has actually changed. Separate from approval."
          span={6}
        >
          <PeriodBadge report={report} />
          {adoption ? (
            <AdoptionRateCard summary={adoption} plant={ALL_FILTER} onPlantChange={() => {}} showPlantPicker={false} />
          ) : (
            <NotAvailableChart summary="SAP has not been checked yet." reason={management.adoption.reason} />
          )}
        </ChartCard>

        {/* --- From the saved monthly snapshots -------------------------------------------------- */}
        {/* A month has one point per chart, so there is no trend to draw: its report shows the month-end position only. */}
        {management.trends && kind === "quarterly" && <MonthlyTrends trends={management.trends} />}
        {management.performance && kind === "monthly" && <PerformanceTrends performance={management.performance} />}
        {management.trends && kind === "quarterly" && <QuarterEndCard trends={management.trends} period={reportNoun(kind).singular} />}


        {/* --- What happened, month by month ------------------------------------------------------- */}

        <ChartCard
          title="Activity by month"
          subtitle="What happened each month."
          info={<ActivityInfo />}
          span={12}
        >
          <PerspectiveTag perspective="monthly" />
          <ActivityTable management={management} totalLabel={reportNoun(kind).total} />
        </ChartCard>
      </div>
    </>
  )
}
