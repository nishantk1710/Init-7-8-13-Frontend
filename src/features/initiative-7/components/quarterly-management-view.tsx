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

import { useState } from "react"
import Link from "next/link"

import { ChartCard } from "@/components/shared/chart-card"
import { MaterialIdentity } from "@/components/shared/material-identity"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn, formatCount, formatIsoDateDMY } from "@/lib/utils"
import { CRITICALITY_TIER_LABEL } from "@/features/initiative-7/components/dashboard-filters"
import { AdoptionRateCard, StockoutRiskDistribution } from "@/features/initiative-7/components/overview-widgets"
import { ExcessPositionCard, StockoutPositionCard } from "@/features/initiative-7/components/plant-position-cards"
import { QuarterlySourceActivity } from "@/features/initiative-7/components/quarterly-source-activity"
import { StockPolicyRow } from "@/features/initiative-7/components/quarterly-stock-policy-row"
import { MonthlyTrends, QuarterEndCard } from "@/features/initiative-7/components/quarterly-trends-section"
import { useLiveRecommendations } from "@/features/initiative-7/hooks/use-live-recommendations"
import type { ApiKpiCard, ApiMetricKind, ApiQuarterlyReport, ApiQuarterManagement } from "@/features/initiative-7/types/api"
import type { Criticality } from "@/features/initiative-7/types/inventory"
import { canGoNext, canGoPrevious, pagedFooterText, pagedTableView } from "@/features/initiative-7/utils/paged-table-state"
import {
  activityCell,
  adoptionSummaryOf,
  kpiValueText,
  num,
  orderedKpis,
  plantPositionsOf,
  rowAddsUp,
  stockoutUsable,
} from "@/features/initiative-7/utils/quarterly-management"
import { ALL_FILTER } from "@/features/initiative-7/components/dashboard-filters"

const MATERIALS_PAGE_SIZE = 5

const KIND_LABEL: Record<ApiMetricKind, string> = {
  EVENT: "Event in the period",
  STATUS_AS_OF: "Status on a date",
  MEASUREMENT: "Measurement",
  AGGREGATE: "Total over the period",
}

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

function ManagementKpiCard({ card }: { card: ApiKpiCard }) {
  const available = card.status === "AVAILABLE" && num(card.value) !== null
  const measured = card.measured_on ? ` · ${formatIsoDateDMY(card.measured_on)}` : ""
  return (
    <div className="flex min-w-0 flex-col gap-1.5 rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-foreground">{card.title}</span>
        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] tracking-[0.4px] text-muted-foreground uppercase">
          {ESTIMATE_KEYS.has(card.key) ? "Estimate" : KIND_LABEL[card.kind]}
        </span>
      </div>
      <div className="flex min-w-0 items-baseline gap-1.5">
        <span className={cn("truncate text-2xl font-bold tabular-nums", available ? "text-foreground" : "text-muted-foreground")}>
          {kpiValueText(card)}
        </span>
        {available && !ESTIMATE_KEYS.has(card.key) && <span className="shrink-0 text-xs text-muted-foreground">{card.unit}</span>}
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">{card.explanation}</p>
      {card.basis === "snapshot" && (
        <p className="text-[10px] font-medium tracking-[0.4px] text-success uppercase">Saved month-end snapshot</p>
      )}
      <p className="text-[11px] font-medium text-foreground">
        {card.period_label}
        {card.kind === "STATUS_AS_OF" || card.kind === "MEASUREMENT" ? "" : measured}
        {card.denominator !== null && (
          <span className="font-normal text-muted-foreground">
            {" "}
            · of {formatCount(card.denominator)} {card.denominator_label}
          </span>
        )}
      </p>
      {!available && card.unavailable_reason && (
        <p className="text-[11px] leading-relaxed text-warning">{card.unavailable_reason}</p>
      )}
      {card.note && <p className="text-[11px] leading-relaxed text-muted-foreground">{card.note}</p>}
    </div>
  )
}

// --- Activity by month -----------------------------------------------------------------------------

function ActivityTable({ management }: { management: ApiQuarterManagement }) {
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
              <TableHead className="text-right">Quarter total</TableHead>
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

function PeriodMaterials({ report }: { report: ApiQuarterlyReport }) {
  const [page, setPage] = useState(1)
  const { period_start, period_end } = report.metadata
  const { data, total, loading } = useLiveRecommendations({
    sort: "generated_at",
    sortDesc: true,
    page,
    pageSize: MATERIALS_PAGE_SIZE,
    // The period itself, half-open: a record stamped late on the last day is in it, one on the next day is not.
    generatedFrom: `${period_start}T00:00:00`,
    generatedTo: `${dayAfter(period_end)}T00:00:00`,
  })
  const view = pagedTableView(loading, data)
  return (
    <ChartCard
      title={`Recommendations generated in ${report.metadata.quarter}`}
      subtitle="Newest first. A list of this period's records only; the figures above cover every one of them, not just these."
      span={12}
    >
      {view === "skeleton" ? (
        <Skeleton className="h-48 w-full" />
      ) : view === "rows" && data ? (
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
                      {formatCount(rec.current.safetyStock)} → {formatCount(rec.recommended.safetyStock)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-[13px] tabular-nums">
                      {formatCount(rec.current.rop)} → {formatCount(rec.recommended.rop)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-[13px] tabular-nums">
                      {formatCount(rec.current.maxStock)} → {formatCount(rec.recommended.maxStock)}
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
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground" aria-live="polite">
              {pagedFooterText({ loading, page, pageSize: MATERIALS_PAGE_SIZE, total })}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={!canGoPrevious(loading, page)}>
                Previous
              </Button>
              <span className="text-xs text-muted-foreground">
                Page {page} of {Math.max(1, Math.ceil(total / MATERIALS_PAGE_SIZE))}
              </span>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={!canGoNext(loading, page, MATERIALS_PAGE_SIZE, total)}>
                Next
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">No recommendations were generated in this period.</div>
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
  const usable = stockoutUsable(management)
  const stockout = management.position.stockout
  const staleReason = stockout.stale_note ?? "The stockout usage has not been built, so nothing can be judged."
  const positions = plantPositionsOf(management)
  const adoption = adoptionSummaryOf(management.adoption)
  const baseline = new Map(report.baseline_comparison.rows.map((row) => [row.metric, row]))
  const levels = [
    { metric: "Safety Stock", label: "Safety stock", sublabel: "demand buffer" },
    { metric: "ROP", label: "Reorder point", sublabel: "when to raise a PO" },
    { metric: "Max Stock", label: "Maximum stock", sublabel: "ceiling to hold" },
  ]

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
            <QuarterlySourceActivity section={report.source_activity} />
          </ChartCard>
        )}

        <ChartCard
          title="Activity by month"
          subtitle="Events counted in the month they happened in, with the quarter total. Decisions come from the dated approval history, not from a recommendation's current status."
          span={12}
        >
          <ActivityTable management={management} />
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
        {management.trends && <MonthlyTrends trends={management.trends} />}
        {management.trends && <QuarterEndCard trends={management.trends} />}

        {/* --- Stock levels: an average over the recommendations, with how many ------------------- */}
        <ChartCard
          title="Current SAP vs I07 recommendation"
          subtitle="Average per recommendation generated this period, over those with both a current and a recommended value."
          span={12}
        >
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead>Stock level</TableHead>
                  <TableHead className="text-right">Current (SAP), average</TableHead>
                  <TableHead className="text-right">Recommended, average</TableHead>
                  <TableHead className="text-right">Change</TableHead>
                  <TableHead className="text-right">Records</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {levels.map(({ metric, label, sublabel }) => {
                  const row = baseline.get(metric)
                  return row ? <StockPolicyRow key={metric} label={label} sublabel={sublabel} row={row} showRecords /> : null
                })}
              </TableBody>
            </Table>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            A dash means no value is set in SAP — not a stock level of zero. Records is how many recommendations each
            average is over, so a mean over a few is never read like one over all of them.
          </p>
        </ChartCard>

        <PeriodMaterials report={report} />
        <DataCoverageCard management={management} />
      </div>
    </>
  )
}
