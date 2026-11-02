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
import { AlertTriangle, Boxes, ClipboardList, Clock, Info, Layers, Search, Wallet } from "lucide-react"

import { ChartCard } from "@/components/shared/chart-card"
import type { InfoTone } from "@/components/shared/info-popup"
import { MaterialIdentity } from "@/components/shared/material-identity"
import { StatusBadge } from "@/components/shared/status-badge"
import { LoadingSpinner } from "@/components/shared/loading-spinner"
import { TablePagination } from "@/components/shared/table-pagination"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn, formatCount, formatIsoDateDMY } from "@/lib/utils"
import { CRITICALITY_TIER_LABEL } from "@/features/initiative-7/components/dashboard-filters"
import { AdoptionRateCard, StockoutRiskDistribution } from "@/features/initiative-7/components/overview-widgets"
import { AvailabilityValue } from "@/features/initiative-7/components/availability-value"
import { PortfolioKpiCard } from "@/features/initiative-7/components/inventory-portfolio-kpis"
import { ExcessPositionCard, StockoutPositionCard } from "@/features/initiative-7/components/plant-position-cards"
import { QuarterlySourceActivity } from "@/features/initiative-7/components/quarterly-source-activity"
import { MonthlyTrends, QuarterEndCard } from "@/features/initiative-7/components/quarterly-trends-section"
import { useLiveRecommendations } from "@/features/initiative-7/hooks/use-live-recommendations"
import type { ApiKpiCard, ApiQuarterlyReport, ApiQuarterManagement } from "@/features/initiative-7/types/api"
import type { Criticality, Recommendation, StockParameters } from "@/features/initiative-7/types/inventory"
import { pagedTableView } from "@/features/initiative-7/utils/paged-table-state"
import { reportKindOf, reportNoun } from "@/features/initiative-7/utils/report-period"
import {
  activityCell,
  adoptionSummaryOf,
  cardCaption,
  cardTitle,
  kpiValueText,
  num,
  orderedKpis,
  plantPositionsOf,
  rowAddsUp,
  stockoutUsable,
} from "@/features/initiative-7/utils/quarterly-management"
import { ALL_FILTER, RECOMMENDATION_TYPE_OPTIONS } from "@/features/initiative-7/components/dashboard-filters"

const MATERIALS_PAGE_SIZE = 5

/** The two money cards are estimates of what the recommendations would change, whatever else they are measured as. */
const ESTIMATE_KEYS = new Set(["excess_inventory_opportunity", "working_capital_impact"])

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
  pending_approval: { icon: <Clock className="size-3.5" />, tone: "warning" },
}

/** One card, drawn as the Overview draws its own, without the (i): the figure, one plain line, and what it covers. What
 * a reader must not miss stays on the card: when a figure is not available it says why, and a figure worked out from
 * current data (rather than a saved month-end snapshot) says so. The report's longer explanation and notes for the card
 * are in the PDF and the Excel. */
function ManagementKpiCard({ card }: { card: ApiKpiCard }) {
  const available = card.status === "AVAILABLE" && num(card.value) !== null
  const look = CARD_LOOK[card.key] ?? { icon: <Info className="size-3.5" />, tone: "info" as const }
  const title = cardTitle(card)
  const measured =
    card.measured_on && card.kind !== "STATUS_AS_OF" && card.kind !== "MEASUREMENT"
      ? ` · ${formatIsoDateDMY(card.measured_on)}`
      : ""
  const covers =
    card.denominator !== null ? ` · of ${formatCount(card.denominator)} ${card.denominator_label ?? ""}`.trimEnd() : ""
  const measuredNow = available && card.kind === "MEASUREMENT" && card.basis === "current_calculation"
  return (
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
        <span className="text-[10px] font-medium tracking-[0.4px] text-success uppercase">Saved month-end snapshot</span>
      )}
      {measuredNow && <span className="text-xs text-muted-foreground">Current figures, no month-end snapshot</span>}
      {!available && card.unavailable_reason && (
        <span className="text-xs leading-relaxed text-warning">{card.unavailable_reason}</span>
      )}
    </PortfolioKpiCard>
  )
}

// --- Activity by month -----------------------------------------------------------------------------

function ActivityTable({ management, totalLabel }: { management: ApiQuarterManagement; totalLabel: string }) {
  const { months, rows } = management.monthly_activity
  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
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
        </Table>
      </div>
      <ul className="mt-2 flex flex-col gap-1 text-[11px] leading-relaxed text-muted-foreground">
        <li>A dash means not available for that month (not started, not covered by the staged data, or not tracked) — it is not a count of zero.</li>
        {rows
          .filter((row) => row.note)
          .map((row) => (
            <li key={row.key}>
              <span className="font-medium text-foreground">{row.label}:</span> {row.note}
            </li>
          ))}
      </ul>
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

function PeriodMaterials({ report }: { report: ApiQuarterlyReport }) {
  const [page, setPage] = useState(1)
  const [type, setType] = useState<PeriodTypeFilter>("all")
  const { period_start, period_end } = report.metadata

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
  })
  const view = pagedTableView(loading, data)
  return (
    <ChartCard
      title={`Recommendations generated in ${report.metadata.quarter}`}
      subtitle="Newest first, with the recommended values. The figures above cover every recommendation in the period, not only these."
      span={12}
      info={
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
      }
    >
      {view === "skeleton" ? (
        <LoadingSpinner label="Loading recommendations" className="h-48 w-full" />
      ) : view === "rows" && data && data.length > 0 ? (
        <div className="flex flex-col gap-3">
          <div className={cn("overflow-x-auto rounded-lg border border-border transition-opacity", loading && "opacity-50")} aria-busy={loading}>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead>Material</TableHead>
                  <TableHead>Plant</TableHead>
                  <TableHead>Crit.</TableHead>
                  <TableHead>Demand pattern</TableHead>
                  <TableHead className="text-right">Safety stock</TableHead>
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
                    <TableCell className="text-right font-mono text-[13px] tabular-nums">
                      {formatCount(rec.recommended.safetyStock)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-[13px] tabular-nums">
                      {formatCount(rec.recommended.rop)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-[13px] tabular-nums">
                      {formatCount(rec.recommended.maxStock)}
                    </TableCell>
                    <TableCell>
                      <span className={cn("text-xs font-medium", STATUS_TEXT[rec.status] ?? "text-muted-foreground")}>{rec.status}</span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{rec.generatedAt}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
          {type === "all"
            ? "No recommendations were generated in this period."
            : `No ${periodTypeLabel(type)} recommendations were generated in this period.`}
        </div>
      )}
    </ChartCard>
  )
}

// --- Current SAP against the recommendation, for one material ----------------------------------------

const STOCK_LEVELS: { key: keyof StockParameters; label: string; sublabel: string }[] = [
  { key: "safetyStock", label: "Safety stock", sublabel: "demand buffer" },
  { key: "rop", label: "Reorder point", sublabel: "when to raise a PO" },
  { key: "maxStock", label: "Maximum stock", sublabel: "ceiling to hold" },
]

/** One recommendation at a time: the table is one material's, not an average over many. */
const COMPARE_PAGE_SIZE = 1

/** One of a recommendation's stock figures, or null when the backend did not send it -- the mapped `current` and
 * `recommended` read a missing figure as 0, and a comparison must not call that "set to 0 in SAP". */
export function stockFigure(rec: Recommendation, side: "current" | "recommended", key: keyof StockParameters): number | null {
  return rec.present?.[side][key] === false ? null : rec[side][key]
}

/** From SAP's figure to the recommended one; null when either is missing, and no percentage from a starting 0. */
export function stockChange(current: number | null, recommended: number | null): { delta: number; percent: number | null } | null {
  if (current === null || recommended === null) return null
  const delta = recommended - current
  return { delta, percent: current !== 0 ? (delta / current) * 100 : null }
}

const signed = (n: number) => `${n >= 0 ? "+" : "−"}${formatCount(Math.abs(n))}`

/** What SAP holds now against what I07 recommends, for one recommendation generated in the period, in the Stock level /
 * Current (SAP) / Recommended / Change table. It opens on the latest one; a search shows a material's own, and Previous
 * and Next step through the matches (the same material in another plant, or other materials the text matches),
 * newest first. */
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
  })
  const view = pagedTableView(loading, data)
  const rec = data?.[0]

  return (
    <ChartCard
      title="Current SAP vs I07 recommendation"
      subtitle={query ? `The latest recommendation for “${query}”.` : "The latest recommendation generated this period. Search a material to see its own."}
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
      {view === "skeleton" ? (
        <LoadingSpinner label="Loading recommendations" className="h-48 w-full" />
      ) : view === "rows" && rec ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <Link href={`/inventory-planning/recommendations/${rec.id}`} className="hover:underline">
              <MaterialIdentity material={rec.material} />
            </Link>
            <span className="text-muted-foreground">Plant {rec.plantId}</span>
            <span className="text-xs text-muted-foreground">Generated {rec.generatedAt}</span>
          </div>
          <div className={cn("overflow-x-auto rounded-lg border border-border transition-opacity", loading && "opacity-50")} aria-busy={loading}>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead>Stock level</TableHead>
                  <TableHead className="text-right">Current (SAP)</TableHead>
                  <TableHead className="text-right">Recommended</TableHead>
                  <TableHead className="text-right">Change</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {STOCK_LEVELS.map((level) => {
                  const current = stockFigure(rec, "current", level.key)
                  const recommended = stockFigure(rec, "recommended", level.key)
                  const change = stockChange(current, recommended)
                  return (
                    <TableRow key={level.key}>
                      <TableCell>
                        {level.label} <span className="text-xs text-muted-foreground">· {level.sublabel}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        {current === null ? (
                          <AvailabilityValue status="NOT_AVAILABLE" size="sm" className="justify-end" />
                        ) : (
                          <span className="tabular-nums">{formatCount(current)}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {recommended === null ? (
                          <AvailabilityValue status="NOT_AVAILABLE" size="sm" className="justify-end" />
                        ) : (
                          <span className="tabular-nums">{formatCount(recommended)}</span>
                        )}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right tabular-nums",
                          change === null ? "text-muted-foreground" : change.delta >= 0 ? "text-success" : "text-destructive",
                        )}
                      >
                        {change === null ? (
                          "—"
                        ) : (
                          <>
                            {signed(change.delta)}
                            {change.percent !== null && <span className="ml-1">({signed(change.percent)}%)</span>}
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
          <p className="text-[11px] text-muted-foreground">A dash means no value is set in SAP — not a stock level of zero.</p>
          <TablePagination
            page={page}
            pageSize={COMPARE_PAGE_SIZE}
            total={total}
            count={data?.length ?? 0}
            noun="recommendations"
            loading={loading}
            alwaysShowButtons
            onPageChange={setPage}
          />
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">
          {query ? `No recommendation from this period matches “${query}”.` : "No recommendations were generated in this period."}
        </div>
      )}
    </ChartCard>
  )
}

// --- Data coverage ---------------------------------------------------------------------------------

function DataCoverageCard({ management }: { management: ApiQuarterManagement }) {
  const c = management.data_coverage
  const fact = (label: string, value: string | null) => (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-0.5 text-[13px] text-foreground">{value ?? <span className="text-muted-foreground">Not available</span>}</dd>
    </div>
  )
  return (
    <ChartCard
      title="Data coverage and limitations"
      subtitle="What these figures are based on, and why anything on this page may be missing or old."
      span={12}
    >
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
        {fact("Latest consumption (goods issue)", c.latest_consumption_date ? formatIsoDateDMY(c.latest_consumption_date) : null)}
        {fact("Staged consumption ends", c.latest_consumption_month ? formatIsoDateDMY(c.latest_consumption_month).replace(/^\d+ /, "") : null)}
        {fact("Stockout usage measured as of", c.stockout_usage_as_of ? formatIsoDateDMY(c.stockout_usage_as_of) : null)}
        {fact("Stock on hand last loaded", c.latest_stock_loaded_at ? formatIsoDateDMY(c.latest_stock_loaded_at.slice(0, 10)) : null)}
        {fact("Recommendations counted", formatCount(c.eligible_recommendations))}
        {fact("Material-plants assessed", formatCount(c.eligible_material_plants))}
        {fact("Figures are", c.basis === "snapshot" ? "Saved month-end snapshots" : "Current calculations")}
      </dl>
      <div className="mt-3 overflow-x-auto rounded-lg border border-border">
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
      <ul className="mt-3 flex list-disc flex-col gap-1 pl-4 text-[11px] leading-relaxed text-muted-foreground">
        {c.warnings.map((warning) => (
          <li key={warning}>{warning}</li>
        ))}
      </ul>
      <details className="mt-3 text-[11px] text-muted-foreground">
        <summary className="cursor-pointer font-medium text-foreground">What the figures on this page mean</summary>
        <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-4 leading-relaxed">
          {management.definitions.map((definition) => (
            <li key={definition}>{definition}</li>
          ))}
        </ul>
      </details>
    </ChartCard>
  )
}

// --- The view --------------------------------------------------------------------------------------

function NotAvailableChart({ reason }: { reason: string }) {
  return (
    <div className="flex h-[150px] w-full flex-col items-center justify-center gap-1 text-center text-xs text-muted-foreground">
      <p className="font-medium text-foreground">Not available</p>
      <p className="max-w-sm leading-relaxed">{reason}</p>
    </div>
  )
}

export function QuarterlyManagementView({ report, management }: { report: ApiQuarterlyReport; management: ApiQuarterManagement }) {
  // A month or a quarter: the words and the trend charts follow it.
  const kind = reportKindOf(report.metadata.quarter)
  const usable = stockoutUsable(management)
  const stockout = management.position.stockout
  const staleReason = stockout.stale_note ?? "The stockout usage has not been built, so nothing can be judged."
  const positions = plantPositionsOf(management)
  const adoption = adoptionSummaryOf(management.adoption)

  return (
    <>
      <PeriodBanner management={management} />

      {/* --- Cards: each says what kind of figure it is, when it was measured and over what --------- */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {orderedKpis(management.kpis).map((card) => (
          <ManagementKpiCard key={card.key} card={card} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* --- What happened, month by month ------------------------------------------------------- */}
        {report.source_activity && (
          <ChartCard
            title="Source activity by month"
            subtitle={`Consumption recorded in each month of ${report.metadata.quarter}, from the staged SAP data.`}
            span={12}
          >
            <QuarterlySourceActivity section={report.source_activity} kind={kind} />
          </ChartCard>
        )}

        <ChartCard
          title="Activity by month"
          subtitle={`Events counted in the month they happened in, with the ${reportNoun(kind).singular} total. Decisions come from the dated approval history, not from a recommendation's current status.`}
          span={12}
        >
          <ActivityTable management={management} totalLabel={reportNoun(kind).total} />
        </ChartCard>

        {/* --- The Overview's charts, for the period ----------------------------------------------- */}
        <ChartCard
          title="Stockout Risk Distribution"
          subtitle="Fast and slow moving material-plants, by stock on hand against lead-time need."
          span={6}
        >
          <StockoutRiskDistribution
            figures={
              usable
                ? { atRisk: stockout.at_risk, evaluated: stockout.evaluated, insufficient: stockout.insufficient_data, asOf: stockout.as_of }
                : null
            }
            unavailable={staleReason}
          />
        </ChartCard>
        <ChartCard
          title="Stockout risk by plant"
          subtitle="Fast and slow moving material-plants short of their lead-time need."
          span={6}
        >
          {usable ? (
            <StockoutPositionCard state={{ positions, loading: false, error: null }} />
          ) : (
            <NotAvailableChart reason={staleReason} />
          )}
        </ChartCard>
        <ChartCard
          title="Excess inventory by plant"
          subtitle="Material-plants whose current maximum stock is above the recommended one."
          span={6}
        >
          <ExcessPositionCard state={{ positions, loading: false, error: null }} />
        </ChartCard>
        <ChartCard
          title="SAP adoption"
          subtitle="Recommendations with a change to adopt, checked against SAP change history."
          span={6}
        >
          {adoption ? (
            <AdoptionRateCard summary={adoption} plant={ALL_FILTER} onPlantChange={() => {}} showPlantPicker={false} />
          ) : (
            <NotAvailableChart reason={management.adoption.reason} />
          )}
        </ChartCard>

        {/* --- From the saved monthly snapshots -------------------------------------------------- */}
        {/* A month has one point per chart, so there is no trend to draw: its report shows the month-end position only. */}
        {management.trends && kind === "quarterly" && <MonthlyTrends trends={management.trends} />}
        {management.trends && <QuarterEndCard trends={management.trends} period={reportNoun(kind).singular} />}

        {/* --- Stock levels: what SAP holds against what I07 recommends, material by material ----- */}
        <PeriodStockComparison report={report} />

        <PeriodMaterials report={report} />
        <DataCoverageCard management={management} />
      </div>
    </>
  )
}
