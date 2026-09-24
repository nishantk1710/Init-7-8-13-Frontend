"use client"

// Step 9 -- I07 Quarterly Deep-Dive Report frontend.
// Restructured per the approved mockup audit (i07_quarterly_report_mockup.html):
// a management-facing KPI/summary layout up top, backed only by real
// AvailabilityStatus-typed fields -- several mockup KPIs (stockout-risk
// severity, excess inventory, working-capital impact, a stockout-risk trend)
// have no defined business rule anywhere in I07 (confirmed by a full
// source-tree audit), and are rendered as explicit "not yet defined" states
// via ManagementSummary, never approximated or fabricated. The original
// 14-section technical deep-dive (data-quality/forecasting/OAR detail) is
// kept below as "Full report detail" -- real, traceable data that remains
// useful, just not what a management reader needs first.

import { useState } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  Boxes,
  CircleCheck,
  Clock,
  Download,
  FileBarChart,
  Loader2,
  RefreshCw,
  TrendingUp,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { ChartCard } from "@/components/shared/chart-card"
import { KPIStatCard } from "@/components/shared/kpi-stat-card"
import { MaterialIdentity } from "@/components/shared/material-identity"
import { StatusBadge } from "@/components/shared/status-badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn, formatCount } from "@/lib/utils"
import { AvailabilityValue, formatDecimal } from "@/features/initiative-7/components/availability-value"
import { CRITICALITY_TIER_LABEL } from "@/features/initiative-7/components/dashboard-filters"
import { DonutWithLegend, type DonutSlice } from "@/features/initiative-7/components/donut-with-legend"
import { CircuitExposureChart } from "@/features/initiative-7/components/circuit-exposure-chart"
import { ForecastVsActualChart } from "@/features/initiative-7/components/forecast-vs-actual-chart"
import { InventoryHealthCard } from "@/features/initiative-7/components/inventory-health-card"
import { RecommendationStatusChart } from "@/features/initiative-7/components/recommendation-status-chart"
import { useLiveRecommendations } from "@/features/initiative-7/hooks/use-live-recommendations"
import { useLiveAdoptionSummary } from "@/features/initiative-7/hooks/use-live-adoption"
import { useQuarterlyReport } from "@/features/initiative-7/hooks/use-quarterly-report"
import { useQuarterlyReports } from "@/features/initiative-7/hooks/use-quarterly-reports"
import { fetchQuarterlyReportExportBlob } from "@/features/initiative-7/services/i7-api"
import type {
  ApiBaselineComparisonRow,
  ApiForecastAccuracyMetric,
  ApiPopulationCount,
  ApiUndefinedManagementMetric,
} from "@/features/initiative-7/types/api"
import type { QuarterlyReportListRow } from "@/features/initiative-7/services/i7-api"
import type { Criticality } from "@/features/initiative-7/types/inventory"

/** Every quarter this UI lets someone generate a report for -- current + the
 * three previous, in reverse chronological order. There is no backend
 * "list valid quarters" endpoint (only already-generated ones), so this is a
 * small client-side convenience list, not read from the wire. */
function candidateQuarters(): string[] {
  const now = new Date()
  const currentQ = Math.floor(now.getMonth() / 3) + 1
  const out: string[] = []
  let q = currentQ
  let y = now.getFullYear()
  for (let i = 0; i < 6; i++) {
    out.push(`Q${q} ${y}`)
    q -= 1
    if (q < 1) {
      q = 4
      y -= 1
    }
  }
  return out
}

const DEMAND_CLASS_COLOR: Record<string, string> = {
  SMOOTH: "var(--chart-3)",
  ERRATIC: "var(--chart-1)",
  INTERMITTENT: "var(--chart-4)",
  LUMPY: "var(--warning)",
  UNCLASSIFIED: "var(--muted-foreground)",
}

const DEMAND_CLASS_LABEL: Record<string, string> = {
  SMOOTH: "Smooth",
  ERRATIC: "Erratic",
  INTERMITTENT: "Intermittent",
  LUMPY: "Lumpy",
  UNCLASSIFIED: "Unclassified",
}

/** The 5 real ZMM065 tiers, most-severe first -- never collapsed into an
 * invented A/B/C 3-bucket grouping (no such grouping exists in policy or
 * code; see MaterialCriticalitySection's own docstring on the backend).
 * Card tint per tier uses only existing theme tokens (no new hex), following
 * the mockup's tinted-mini-card language: CRITICAL->destructive,
 * IMPACT->warning, INSURANCE->accent, NORMAL->muted (neutral), OBSOLETE->a
 * lighter muted -- five visually distinct tiers from four base tokens. */
const CRITICALITY_TIER_ORDER = ["CRITICAL", "IMPACT", "INSURANCE", "NORMAL", "OBSOLETE"] as const
const CRITICALITY_TIER_STYLE: Record<(typeof CRITICALITY_TIER_ORDER)[number], { card: string; text: string; sub: string }> = {
  CRITICAL: { card: "bg-destructive/10 border-destructive/20", text: "text-destructive", sub: "text-destructive/70" },
  IMPACT: { card: "bg-warning/15 border-warning/25", text: "text-warning", sub: "text-warning/70" },
  INSURANCE: { card: "bg-accent border-accent-foreground/15", text: "text-accent-foreground", sub: "text-accent-foreground/70" },
  NORMAL: { card: "bg-muted border-border", text: "text-foreground", sub: "text-muted-foreground" },
  OBSOLETE: { card: "bg-muted/40 border-border/60", text: "text-muted-foreground", sub: "text-muted-foreground/80" },
}
const CRITICALITY_TIER_CAPTION: Record<(typeof CRITICALITY_TIER_ORDER)[number], string> = {
  CRITICAL: "Line-stopping if unavailable",
  IMPACT: "Some operational impact",
  INSURANCE: "Held for insurance/cover",
  NORMAL: "Standard replenishment",
  OBSOLETE: "Marked for retirement",
}

/** Text-color-only treatment for the material table's Crit. column, keyed on
 * the app's mapped Criticality (not the raw ZMM065 tier) -- the same tone
 * mapping used for CRITICALITY_TIER_STYLE above, applied as plain colored
 * text rather than a tinted badge to match the reference table's style. */
const CRITICALITY_TIER_TEXT_COLOR: Record<Criticality, string> = {
  Critical: "text-destructive",
  High: "text-warning",
  Medium: "text-accent-foreground",
  Low: "text-muted-foreground",
}

/** Text-color-only treatment for the material table's Status column, keyed
 * on the app's mapped RecommendationStatus (rec.status) -- distinct from
 * RECOMMENDATION_STATUS_COLOR above, which keys on the raw backend
 * LifecycleStatus used by the donut chart, a different vocabulary. */
const RECOMMENDATION_STATUS_TEXT_COLOR: Record<string, string> = {
  "Pending Review": "text-warning",
  "In Approval": "text-warning",
  Approved: "text-success",
  Rejected: "text-destructive",
  Returned: "text-destructive",
  Implemented: "text-success",
}

function titleCaseStatus(status: string): string {
  return status
    .toLowerCase()
    .split("_")
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ")
}

/** A plain populated/missing count -- no AvailabilityStatus of its own
 * (unlike ForecastAccuracyMetric), so rendered directly rather than through
 * AvailabilityValue: a 0-populated count here is a real measured fact
 * (see PopulationCount's own docstring), not a missing-data placeholder. */
function PopulationRow({ label, pop }: { label: string; pop: ApiPopulationCount }) {
  const pct = formatDecimal(pop.percentage_populated, 1)
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums text-foreground">
        {formatCount(pop.populated_count)} / {formatCount(pop.total_count)}
        <span className="ml-1.5 text-muted-foreground">({pct ?? "0.0"}%)</span>
      </span>
    </div>
  )
}

function AccuracyMetricRow({ label, metric, unit }: { label: string; metric: ApiForecastAccuracyMetric; unit?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <AvailabilityValue status={metric.status} value={formatDecimal(metric.value)} unit={unit} size="sm" />
        <span className="text-[11px] text-muted-foreground">
          ({formatCount(metric.populated_count)}/{formatCount(metric.total_count)})
        </span>
      </div>
    </div>
  )
}

/** One mockup KPI card for a metric with no defined business rule today --
 * always NOT_CONFIGURED, always shows the real backend-supplied reason, never
 * a fabricated number in its place. Dashed border + muted icon distinguish it
 * at a glance from the real-number KPI cards next to it (see KpiCard below),
 * so "not yet defined" reads as visually different from "measured", not just
 * differently worded. */
function UndefinedKpiCard({
  label,
  icon,
  metric,
}: {
  label: string
  icon: React.ReactNode
  metric: ApiUndefinedManagementMetric
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-dashed border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[13px] text-muted-foreground">{label}</span>
        <span className="text-muted-foreground/60">{icon}</span>
      </div>
      <AvailabilityValue status={metric.status} />
      <p className="text-[11px] leading-relaxed text-muted-foreground">{metric.reason}</p>
    </div>
  )
}

/** A real-number KPI card in the mockup's shape -- label + corner icon on
 * top, a large number, a sublabel, and an optional colored footnote line
 * (e.g. "48.0% of recommendations"). Solid border distinguishes it from
 * UndefinedKpiCard's dashed "not configured" shell. */
function KpiCard({
  label,
  icon,
  value,
  sublabel,
  footnote,
  footnoteTone = "muted",
}: {
  label: string
  icon: React.ReactNode
  value: string
  sublabel: string
  footnote?: string
  footnoteTone?: "muted" | "warning" | "success" | "destructive"
}) {
  const footnoteClass = {
    muted: "text-muted-foreground",
    warning: "text-warning",
    success: "text-success",
    destructive: "text-destructive",
  }[footnoteTone]
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[13px] text-muted-foreground">{label}</span>
        {icon}
      </div>
      <div>
        <div className="text-2xl font-semibold text-foreground">{value}</div>
        <div className="text-xs text-muted-foreground">{sublabel}</div>
      </div>
      {footnote && <p className={cn("text-xs", footnoteClass)}>{footnote}</p>}
    </div>
  )
}

/** The mockup's "How the stock policy is changing" table -- Current (SAP) /
 * Recommended / Change, one row per metric, with REAL mean values (not
 * populated-counts) -- sourced from Section 12's baseline_comparison.rows,
 * the one place the report already computes the mean current value, mean
 * recommended value, and their delta/delta% over rows where both are
 * populated (see BaselineComparisonRow's own docstring on the backend: never
 * derived from two separately-scoped aggregates). A missing SAP baseline
 * (baseline_value === null, e.g. Safety Stock's confirmed 0-populated
 * current_safety_stock) renders as an explicit dash + "not set in SAP" via
 * AvailabilityValue, never a bare 0 or an invented number. */
function StockPolicyRow({
  label,
  sublabel,
  row,
}: {
  label: string
  sublabel: string
  row: ApiBaselineComparisonRow
}) {
  const currentAvailable = row.baseline_value !== null
  const recommendedAvailable = row.recommendation_value !== null
  const changeKnown = row.delta !== null

  const deltaTone = row.delta === null ? "text-muted-foreground" : Number(row.delta) >= 0 ? "text-success" : "text-destructive"

  return (
    <TableRow>
      <TableCell>
        {label} <span className="text-xs text-muted-foreground">· {sublabel}</span>
      </TableCell>
      <TableCell className="text-right">
        {currentAvailable ? (
          <span className="tabular-nums">{formatDecimal(row.baseline_value, 0)}</span>
        ) : (
          <AvailabilityValue status="NOT_AVAILABLE" size="sm" className="justify-end" />
        )}
      </TableCell>
      <TableCell className="text-right">
        {recommendedAvailable ? (
          <span className="tabular-nums">{formatDecimal(row.recommendation_value, 0)}</span>
        ) : (
          <AvailabilityValue status="NOT_AVAILABLE" size="sm" className="justify-end" />
        )}
      </TableCell>
      <TableCell className={cn("text-right tabular-nums", deltaTone)}>
        {changeKnown ? (
          <>
            {Number(row.delta) >= 0 ? "+" : ""}
            {formatDecimal(row.delta, 0)}
            {row.delta_percentage !== null && (
              <span className="ml-1">
                ({Number(row.delta_percentage) >= 0 ? "+" : ""}
                {formatDecimal(row.delta_percentage, 0)}%)
              </span>
            )}
          </>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
    </TableRow>
  )
}

type GenerationTab = "landing" | "report"

const MATERIALS_PAGE_SIZE = 5

export function QuarterlyReportsWorkspace() {
  const quarters = candidateQuarters()
  const { data: existingReports } = useQuarterlyReports(50)
  const [selectedQuarter, setSelectedQuarter] = useState<string>(quarters[0] ?? "")
  const [tab, setTab] = useState<GenerationTab>("landing")
  const [materialsPage, setMaterialsPage] = useState(1)
  const { data: report, loading, error, status, refetch } =
    useQuarterlyReport(tab === "report" ? selectedQuarter || null : null)
  const { summary: adoptionSummary } = useLiveAdoptionSummary()
  const [downloadState, setDownloadState] = useState<"idle" | "preparing" | "ready" | "error">("idle")
  const [downloadError, setDownloadError] = useState<string | null>(null)

  async function handleDownload() {
    if (!selectedQuarter) return
    setDownloadState("preparing")
    setDownloadError(null)
    try {
      const { blobUrl, filename } = await fetchQuarterlyReportExportBlob(selectedQuarter)
      const a = document.createElement("a")
      a.href = blobUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(blobUrl)
      setDownloadState("ready")
      setTimeout(() => setDownloadState((s) => (s === "ready" ? "idle" : s)), 2000)
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "Export failed.")
      setDownloadState("error")
    }
  }

  function openReport(quarter: string) {
    setSelectedQuarter(quarter)
    setTab("report")
    setMaterialsPage(1)
  }

  const demandOrder = ["SMOOTH", "ERRATIC", "INTERMITTENT", "LUMPY", "UNCLASSIFIED"]
  const demandByClass = new Map(report?.demand_classification.by_class.map((d) => [d.demand_class, d]) ?? [])
  const demandSlices: DonutSlice[] = demandOrder
    .filter((cls) => demandByClass.has(cls))
    .map((cls) => {
      const row = demandByClass.get(cls)!
      return { label: DEMAND_CLASS_LABEL[cls] ?? cls, count: row.count, color: DEMAND_CLASS_COLOR[cls] ?? "var(--chart-2)" }
    })

  const criticalityByTier = new Map(report?.material_criticality.by_tier.map((row) => [row.criticality, row.count]) ?? [])

  // Real mean current/recommended/delta per metric, straight from Section
  // 12's baseline comparison -- the one place the report computes these
  // means (see StockPolicyRow's own docstring for why this section is
  // reused rather than the safety_stock/reorder_point/max_stock sections,
  // which carry only populated-counts, not the mean values themselves).
  const baselineRowByMetric = new Map(report?.baseline_comparison.rows.map((row) => [row.metric, row]) ?? [])
  const stockPolicyRow = (metric: string) => baselineRowByMetric.get(metric)

  // Material table: the same unscoped live-recommendations fetch Overview
  // uses (not filtered to the report's own generated_from/generated_to --
  // most recommendation rows predate the reporting feature and were never
  // regenerated inside a specific quarter window, so a quarter-scoped fetch
  // reads as empty even when real, live recommendations exist), sorted so
  // the largest ROP changes surface first. Paged against the real backend
  // (113k+ rows total) rather than fetched-then-sliced client-side.
  const { data: materials, total: materialsTotal } = useLiveRecommendations(
    report
      ? {
          sort: "rop_delta_magnitude",
          sortDesc: true,
          page: materialsPage,
          pageSize: MATERIALS_PAGE_SIZE,
        }
      : {},
  )

  // Same unscoped fetch, but uncapped (matches Overview's
  // LIVE_OVERVIEW_PAGE_SIZE) -- feeds the two Overview-style charts below,
  // which need the full set to group by circuit/compute a forecast series,
  // not just the 5-row "top changes" preview above.
  const { data: chartRecommendations } = useLiveRecommendations(
    report ? { pageSize: 200 } : {},
  )

  return (
    <div className="flex flex-col gap-4">
      {tab === "landing" && (
        <QuarterlyLandingGrid
          quarters={(existingReports ?? []).map((r) => r.quarter)}
          existingReports={existingReports ?? []}
          onView={openReport}
        />
      )}

      {tab === "report" && (
        <>
          {/* --- Controls -------------------------------------------------- */}
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
            <Button size="sm" variant="ghost" onClick={() => setTab("landing")}>
              ← All quarters
            </Button>
            <span className="text-sm font-medium text-foreground">{selectedQuarter}</span>

            {status && (
              <StatusBadge
                tone={
                  status.status === "COMPLETED"
                    ? "success"
                    : status.status === "FAILED"
                      ? "danger"
                      : status.status === "RUNNING"
                        ? "warning"
                        : "default"
                }
              >
                {status.status}
              </StatusBadge>
            )}

            <div className="ml-auto flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => refetch()} disabled={loading}>
                <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
                Refresh
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleDownload}
                disabled={!report || downloadState === "preparing"}
                className={cn(
                  downloadState === "ready" && "border-success text-success",
                  downloadState === "error" && "border-destructive text-destructive",
                )}
              >
                {downloadState === "preparing" && <Loader2 className="size-3.5 animate-spin" />}
                {downloadState === "ready" && <CircleCheck className="size-3.5" />}
                {downloadState === "error" && <AlertTriangle className="size-3.5" />}
                {downloadState === "idle" && <Download className="size-3.5" />}
                {downloadState === "preparing"
                  ? "Preparing…"
                  : downloadState === "ready"
                    ? "Download started"
                    : downloadState === "error"
                      ? "Export failed — retry"
                      : "Download detail Excel"}
              </Button>
            </div>
          </div>

          {downloadError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {downloadError}
            </div>
          )}

          {loading && !report && (
            <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
              Loading report…
            </div>
          )}

          {error && !report && (
            <EmptyReportState quarter={selectedQuarter} />
          )}

          {report && (
            <>
              {/* --- KPI row: real metrics + honestly-undefined ones --------- */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <UndefinedKpiCard
                  label="Critical stockout risk"
                  icon={<AlertTriangle className="size-4" />}
                  metric={report.management_summary.critical_stockout_risk}
                />
                <UndefinedKpiCard
                  label="Excess inventory candidates"
                  icon={<Boxes className="size-4" />}
                  metric={report.management_summary.excess_inventory_candidates}
                />
                <UndefinedKpiCard
                  label="Working capital impact"
                  icon={<TrendingUp className="size-4" />}
                  metric={report.management_summary.working_capital_impact}
                />
                <KpiCard
                  label="Pending approval"
                  icon={<Clock className="size-4 text-warning" />}
                  value={formatCount(report.executive_summary.pending_approval_count)}
                  sublabel="Recommendations"
                  footnote={
                    report.executive_summary.pending_approval_percentage !== null
                      ? `${formatDecimal(report.executive_summary.pending_approval_percentage, 1)}% of recommendations`
                      : `of ${formatCount(report.executive_summary.total_recommendations)} recommendations`
                  }
                  footnoteTone="warning"
                />
              </div>

              {/* --- Material criticality ------------------------------------ */}
              <ChartCard
                title="Material criticality"
                subtitle={
                  report.material_criticality.populated_percentage !== null
                    ? `In-scope materials by ZMM065 tier — criticality populated on ${formatDecimal(report.material_criticality.populated_percentage, 1)}% of rows this quarter.`
                    : "In-scope materials by ZMM065 tier."
                }
              >
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {CRITICALITY_TIER_ORDER.map((tier) => {
                    const style = CRITICALITY_TIER_STYLE[tier]
                    return (
                      <div key={tier} className={cn("rounded-lg border p-3", style.card)}>
                        <div className={cn("text-[13px]", style.text)}>{tier}</div>
                        <div className={cn("mt-1 text-xl font-semibold", style.text)}>
                          {formatCount(criticalityByTier.get(tier) ?? 0)}
                        </div>
                        <div className={cn("mt-0.5 text-[11px]", style.sub)}>{CRITICALITY_TIER_CAPTION[tier]}</div>
                      </div>
                    )
                  })}
                </div>
              </ChartCard>

              {/* --- Everything below in one 12-col grid, matching main's
                  QuarterlyReportsDemoWorkspace layout/spans exactly. --- */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                <ChartCard title="Stockout risk distribution" span={4}>
                  <InventoryHealthCard recommendations={chartRecommendations ?? []} />
                </ChartCard>
                <ChartCard
                  title="Recommendation status"
                  subtitle="Where each change sits in the approval flow."
                  span={8}
                >
                  <RecommendationStatusChart recommendations={chartRecommendations ?? []} />
                </ChartCard>

                <ChartCard
                  title="Current / I11 Baseline vs I07 Recommendation"
                  subtitle="Current SAP values against I07 recommendations, over rows generated this quarter."
                  span={12}
                >
                  <div className="overflow-x-auto rounded-lg border border-border">
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
                        {stockPolicyRow("Safety Stock") && (
                          <StockPolicyRow
                            label="Safety stock"
                            sublabel="demand buffer"
                            row={stockPolicyRow("Safety Stock")!}
                          />
                        )}
                        {stockPolicyRow("ROP") && (
                          <StockPolicyRow
                            label="Reorder point"
                            sublabel="when to raise a PO"
                            row={stockPolicyRow("ROP")!}
                          />
                        )}
                        {stockPolicyRow("Max Stock") && (
                          <StockPolicyRow
                            label="Maximum stock"
                            sublabel="ceiling to hold"
                            row={stockPolicyRow("Max Stock")!}
                          />
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    A dash means no value is set in SAP — not a stock level of zero. Current Safety Stock is
                    confirmed NOT_AVAILABLE on this extract (EISBE is absent from MARC).
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {report.reorder_point.current_sap_value_reused_note}
                  </p>
                </ChartCard>

                <ChartCard
                  title="Materials — top reorder changes"
                  subtitle="Full list in the Excel export."
                  span={12}
                >
                  {materials && materials.length > 0 ? (
                    <div className="flex flex-col gap-3">
                      <div className="overflow-x-auto rounded-lg border border-border">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/40 hover:bg-muted/40">
                              <TableHead>Material</TableHead>
                              <TableHead>Plant</TableHead>
                              <TableHead>Circuit</TableHead>
                              <TableHead>Crit.</TableHead>
                              <TableHead>Demand pattern</TableHead>
                              <TableHead className="text-right">Recommended ROP</TableHead>
                              <TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {materials.map((rec) => (
                              <TableRow key={rec.id}>
                                <TableCell>
                                  <Link href={`/inventory-planning/recommendations/${rec.id}`} className="hover:underline">
                                    <MaterialIdentity material={rec.material} />
                                  </Link>
                                </TableCell>
                                <TableCell className="text-muted-foreground">{rec.plantId}</TableCell>
                                <TableCell className="text-muted-foreground">{rec.circuit}</TableCell>
                                <TableCell>
                                  <span className={cn("text-xs font-medium", CRITICALITY_TIER_TEXT_COLOR[rec.criticality as Criticality])}>
                                    {CRITICALITY_TIER_LABEL[rec.criticality as Criticality]}
                                  </span>
                                </TableCell>
                                <TableCell className="text-muted-foreground">{rec.demandPattern}</TableCell>
                                <TableCell className="text-right font-mono text-[13px] tabular-nums">
                                  {formatCount(rec.current.rop)} → {formatCount(rec.recommended.rop)}
                                </TableCell>
                                <TableCell>
                                  <span className={cn("text-xs font-medium", RECOMMENDATION_STATUS_TEXT_COLOR[rec.status] ?? "text-muted-foreground")}>
                                    {rec.status}
                                  </span>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs text-muted-foreground">
                          Showing {materialsTotal === 0 ? 0 : (materialsPage - 1) * MATERIALS_PAGE_SIZE + 1}–
                          {Math.min(materialsTotal, materialsPage * MATERIALS_PAGE_SIZE)} of{" "}
                          {formatCount(materialsTotal)}
                        </span>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setMaterialsPage((p) => Math.max(1, p - 1))}
                            disabled={materialsPage <= 1}
                          >
                            Previous
                          </Button>
                          <span className="text-xs text-muted-foreground">
                            Page {materialsPage} of {Math.max(1, Math.ceil(materialsTotal / MATERIALS_PAGE_SIZE))}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setMaterialsPage((p) => p + 1)}
                            disabled={materialsPage * MATERIALS_PAGE_SIZE >= materialsTotal}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">No recommendations found.</div>
                  )}
                </ChartCard>

                <ChartCard
                  title="Critical circuit exposure"
                  subtitle="Recommendations per circuit, split by stockout-risk exposure."
                  span={7}
                >
                  <CircuitExposureChart recommendations={chartRecommendations ?? []} activeCircuit={null} onCircuitClick={() => {}} />
                </ChartCard>

                <ChartCard title="Stockout risk trend" subtitle="Materials at high/critical risk, by month." span={5}>
                  <div className="flex flex-col items-center gap-2 py-6 text-center">
                    <AvailabilityValue status={report.management_summary.stockout_risk_trend.status} />
                    <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
                      {report.management_summary.stockout_risk_trend.reason}
                    </p>
                  </div>
                </ChartCard>

                <ChartCard
                  title="Forecast vs Actual Demand"
                  span={7}
                  footnote={`Actual = consumption for the ${chartRecommendations?.length ?? 0} material(s) in view. Forecast = one-step-ahead exponential smoothing on that same series, so each point uses only prior months.`}
                >
                  <ForecastVsActualChart recommendations={chartRecommendations ?? []} />
                </ChartCard>

                <ChartCard title="SAP adoption" subtitle="Whether approved recommendations were applied in SAP." span={5}>
                  <div className="flex flex-col items-center gap-2 py-6 text-center">
                    <AvailabilityValue status={report.sap_adoption.status} />
                    <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">{report.sap_adoption.reason}</p>
                  </div>
                  {adoptionSummary && adoptionSummary.totalEvaluated > 0 && (
                    <div className="mt-3 border-t border-border/60 pt-3 text-center">
                      <p className="text-[11px] text-muted-foreground">
                        FR-9 ledger (all quarters): {adoptionSummary.adoptedCount} adopted ·{" "}
                        {adoptionSummary.partiallyAdoptedCount} partial · {adoptionSummary.notAdoptedCount} not
                        adopted · {adoptionSummary.unknownCount} unknown, of {adoptionSummary.totalEvaluated}{" "}
                        reconciled.
                      </p>
                    </div>
                  )}
                </ChartCard>
              </div>

              {/* --- Full report detail (the original 14-section deep-dive) --- */}
              <details className="rounded-xl border border-border bg-card">
                <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-foreground">
                  Full report detail
                </summary>
                <div className="flex flex-col gap-4 border-t border-border p-4">
                  <ChartCard
                    title="Executive Summary"
                    subtitle={`${report.metadata.quarter} · ${report.metadata.period_start} to ${report.metadata.period_end} · generated ${new Date(report.metadata.generated_at).toLocaleString()} · v${report.metadata.report_version}`}
                  >
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                      <KPIStatCard label="Material-Plants in Scope" value={formatCount(report.executive_summary.total_material_plants)} />
                      <KPIStatCard
                        label="Demand-Classified"
                        value={
                          report.executive_summary.classified_percentage !== null
                            ? `${formatDecimal(report.executive_summary.classified_percentage, 1)}%`
                            : "—"
                        }
                        hint={report.executive_summary.classified_percentage === null ? "0 rows in scope" : undefined}
                      />
                      <KPIStatCard label="Total Recommendations" value={formatCount(report.executive_summary.total_recommendations)} />
                      <KPIStatCard label="Ready for Review" value={formatCount(report.executive_summary.ready_for_review_count)} />
                      <KPIStatCard label="Pending Approval" value={formatCount(report.executive_summary.pending_approval_count)} />
                      <KPIStatCard label="Not Evaluable" value={formatCount(report.executive_summary.not_evaluable_count)} />
                      <KPIStatCard label="OAR Materials" value={formatCount(report.executive_summary.oar_count)} />
                      <KPIStatCard label="Approval Ledger Entries" value={formatCount(report.executive_summary.approval_ledger_entries)} />
                    </div>
                  </ChartCard>

                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <ChartCard title="Scope & Data Quality" span={6}>
                      <PopulationRow
                        label="Classified"
                        pop={{
                          populated_count: report.scope_and_data_quality.classified_count,
                          missing_count: report.scope_and_data_quality.unclassified_count,
                          total_count: report.scope_and_data_quality.total_records,
                          percentage_populated: report.scope_and_data_quality.classified_percentage,
                        }}
                      />
                      <PopulationRow
                        label="Criticality Populated"
                        pop={{
                          populated_count: report.scope_and_data_quality.criticality_populated_count,
                          missing_count:
                            report.scope_and_data_quality.total_records - report.scope_and_data_quality.criticality_populated_count,
                          total_count: report.scope_and_data_quality.total_records,
                          percentage_populated: report.scope_and_data_quality.criticality_populated_percentage,
                        }}
                      />
                      <PopulationRow
                        label="Lead Time Populated"
                        pop={{
                          populated_count: report.scope_and_data_quality.lead_time_populated_count,
                          missing_count:
                            report.scope_and_data_quality.total_records - report.scope_and_data_quality.lead_time_populated_count,
                          total_count: report.scope_and_data_quality.total_records,
                          percentage_populated: report.scope_and_data_quality.lead_time_populated_percentage,
                        }}
                      />
                      <div className="mt-3">
                        <div className="mb-1.5 text-xs font-medium text-muted-foreground">History Status Breakdown</div>
                        {report.scope_and_data_quality.history_status_breakdown.map((row) => (
                          <div key={row.history_status} className="flex items-center justify-between py-1 text-sm">
                            <span className="text-muted-foreground">{titleCaseStatus(row.history_status)}</span>
                            <span className="tabular-nums text-foreground">{formatCount(row.count)}</span>
                          </div>
                        ))}
                      </div>
                    </ChartCard>

                    <ChartCard title="Demand Classification" subtitle={`${formatCount(report.demand_classification.total)} material-plants`} span={6}>
                      {demandSlices.length > 0 ? (
                        <DonutWithLegend slices={demandSlices} />
                      ) : (
                        <div className="text-sm text-muted-foreground">No demand-classified rows in scope.</div>
                      )}
                    </ChartCard>
                  </div>

                  <ChartCard title="Forecasting" subtitle={`${formatCount(report.forecasting.total_forecasts)} forecast rows`}>
                    <div className="grid grid-cols-1 gap-x-8 gap-y-1 sm:grid-cols-2">
                      <div>
                        <AccuracyMetricRow label="Mean Absolute Error" metric={report.forecasting.mean_absolute_error} />
                        <AccuracyMetricRow label="Pinball Loss" metric={report.forecasting.pinball_loss} />
                        <AccuracyMetricRow label="Bias %" metric={report.forecasting.bias_percentage} unit="%" />
                        <AccuracyMetricRow label="Fill Rate" metric={report.forecasting.fill_rate} />
                        <AccuracyMetricRow label="Holding Cost" metric={report.forecasting.holding_cost} />
                        <div className="flex items-center justify-between gap-3 border-b border-border/60 py-2 text-sm last:border-0">
                          <span className="text-muted-foreground">MAPE</span>
                          <AvailabilityValue status={report.forecasting.mape_status} size="sm" />
                        </div>
                      </div>
                      <div>
                        <div className="mb-1.5 text-xs font-medium text-muted-foreground">Champion / Challenger</div>
                        <div className="flex items-center justify-between py-1 text-sm">
                          <span className="text-muted-foreground">Champion</span>
                          <span className="tabular-nums text-foreground">{formatCount(report.forecasting.champion_challenger.champion_count)}</span>
                        </div>
                        <div className="flex items-center justify-between py-1 text-sm">
                          <span className="text-muted-foreground">Challenger</span>
                          <span className="tabular-nums text-foreground">{formatCount(report.forecasting.champion_challenger.challenger_count)}</span>
                        </div>
                        <div className="flex items-center justify-between py-1 text-sm">
                          <span className="text-muted-foreground">Baseline</span>
                          <span className="tabular-nums text-foreground">{formatCount(report.forecasting.champion_challenger.baseline_count)}</span>
                        </div>
                      </div>
                    </div>
                  </ChartCard>

                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    <ChartCard title="Safety Stock" span={4}>
                      <PopulationRow label="Current" pop={report.safety_stock.current} />
                      <PopulationRow label="Recommended" pop={report.safety_stock.recommended} />
                      <div className="mt-2 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Mean Delta</span>
                        <span className="tabular-nums text-foreground">{formatDecimal(report.safety_stock.mean_delta) ?? "—"}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Service Level Policy</span>
                        <AvailabilityValue status={report.safety_stock.service_level_status} size="sm" />
                      </div>
                    </ChartCard>

                    <ChartCard title="Reorder Point" span={4}>
                      <PopulationRow label="Current" pop={report.reorder_point.current} />
                      <PopulationRow label="Recommended" pop={report.reorder_point.recommended} />
                      <div className="mt-2 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Mean Delta</span>
                        <span className="tabular-nums text-foreground">{formatDecimal(report.reorder_point.mean_delta) ?? "—"}</span>
                      </div>
                    </ChartCard>

                    <ChartCard title="Max Stock" span={4}>
                      <PopulationRow label="Current" pop={report.max_stock.current} />
                      <PopulationRow label="Recommended" pop={report.max_stock.recommended} />
                      <div className="mt-2 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Mean Delta</span>
                        <span className="tabular-nums text-foreground">{formatDecimal(report.max_stock.mean_delta) ?? "—"}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Strategy Policy</span>
                        <AvailabilityValue status={report.max_stock.strategy_policy_status} size="sm" />
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        {formatCount(report.max_stock.strategy_production_resolved_count)} production-resolved of{" "}
                        {formatCount(report.max_stock.strategy_labeled_count)} labeled (
                        {formatCount(report.max_stock.strategy_unresolved_fixture_count)} unresolved fixtures)
                      </div>
                    </ChartCard>
                  </div>

                  <ChartCard title="OAR / Min-Max">
                    <div className="grid grid-cols-1 gap-x-8 gap-y-1 sm:grid-cols-2">
                      <div>
                        <div className="flex items-center justify-between py-1 text-sm">
                          <span className="text-muted-foreground">Is OAR — True</span>
                          <span className="tabular-nums text-foreground">{formatCount(report.oar.is_oar_true_count)}</span>
                        </div>
                        <div className="flex items-center justify-between py-1 text-sm">
                          <span className="text-muted-foreground">Is OAR — False</span>
                          <span className="tabular-nums text-foreground">{formatCount(report.oar.is_oar_false_count)}</span>
                        </div>
                        <div className="flex items-center justify-between py-1 text-sm">
                          <span className="text-muted-foreground">Is OAR — Unknown (null)</span>
                          <span className="tabular-nums text-foreground">{formatCount(report.oar.is_oar_null_count)}</span>
                        </div>
                      </div>
                      <div>
                        <div className="mb-1.5 text-xs font-medium text-muted-foreground">Conversion Eligibility</div>
                        {report.oar.conversion_eligibility_breakdown.map((row) => (
                          <div key={row.conversion_eligibility ?? "null"} className="flex items-center justify-between py-1 text-sm">
                            <span className="text-muted-foreground">{row.conversion_eligibility ?? "Not recorded"}</span>
                            <span className="tabular-nums text-foreground">{formatCount(row.count)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </ChartCard>

                  <ChartCard title="Approval">
                    <div className="flex items-center justify-between py-1 text-sm">
                      <span className="text-muted-foreground">Ledger Entries</span>
                      <span className="tabular-nums text-foreground">{formatCount(report.approval.ledger_entry_count)}</span>
                    </div>
                    <div className="flex items-center justify-between py-1 text-sm">
                      <span className="text-muted-foreground">Distinct Recommendations</span>
                      <span className="tabular-nums text-foreground">{formatCount(report.approval.distinct_recommendations_in_approval)}</span>
                    </div>
                    <div className="flex items-center justify-between py-1 text-sm">
                      <span className="text-muted-foreground">Pending</span>
                      <span className="tabular-nums text-foreground">{formatCount(report.approval.pending_count)}</span>
                    </div>
                    <div className="flex items-center justify-between py-1 text-sm">
                      <span className="text-muted-foreground">Approved</span>
                      <span className="tabular-nums text-foreground">{formatCount(report.approval.approved_count)}</span>
                    </div>
                    <div className="flex items-center justify-between py-1 text-sm">
                      <span className="text-muted-foreground">Rejected</span>
                      <span className="tabular-nums text-foreground">{formatCount(report.approval.rejected_count)}</span>
                    </div>
                  </ChartCard>

                  <ChartCard
                    title="Current / I11 Baseline vs I07 Recommendation"
                    subtitle={`Baseline lead time source: ${report.baseline_comparison.baseline_lead_time_source}${
                      report.baseline_comparison.i07_lead_time_source ? ` · I07 lead time source: ${report.baseline_comparison.i07_lead_time_source}` : ""
                    }`}
                  >
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[640px] text-sm">
                        <thead>
                          <tr className="border-b border-border text-left text-xs text-muted-foreground">
                            <th className="py-1.5 pr-3 font-medium">Metric</th>
                            <th className="py-1.5 pr-3 font-medium">Baseline</th>
                            <th className="py-1.5 pr-3 font-medium">I07 Recommendation</th>
                            <th className="py-1.5 pr-3 font-medium">Delta</th>
                            <th className="py-1.5 pr-3 font-medium">Delta %</th>
                            <th className="py-1.5 pr-3 font-medium">Both Available</th>
                            <th className="py-1.5 font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.baseline_comparison.rows.map((row) => (
                            <tr key={row.metric} className="border-b border-border/60 last:border-0">
                              <td className="py-1.5 pr-3 text-foreground">
                                {row.metric}
                                {row.self_referential && (
                                  <span className="ml-1.5 text-[11px] text-warning">self-comparison</span>
                                )}
                              </td>
                              <td className="py-1.5 pr-3">
                                <AvailabilityValue
                                  status={row.availability_status === "AVAILABLE" && row.baseline_value === null ? "NOT_AVAILABLE" : row.availability_status}
                                  value={formatDecimal(row.baseline_value)}
                                  size="sm"
                                />
                              </td>
                              <td className="py-1.5 pr-3">
                                <AvailabilityValue
                                  status={row.availability_status === "AVAILABLE" && row.recommendation_value === null ? "NOT_AVAILABLE" : row.availability_status}
                                  value={formatDecimal(row.recommendation_value)}
                                  size="sm"
                                />
                              </td>
                              <td className="py-1.5 pr-3">
                                <AvailabilityValue status={row.availability_status} value={formatDecimal(row.delta)} size="sm" />
                              </td>
                              <td className="py-1.5 pr-3">
                                <AvailabilityValue
                                  status={row.availability_status}
                                  value={formatDecimal(row.delta_percentage)}
                                  unit={row.delta_percentage !== null ? "%" : undefined}
                                  size="sm"
                                />
                              </td>
                              <td className="py-1.5 pr-3 tabular-nums text-foreground">{formatCount(row.both_available_count)}</td>
                              <td className="py-1.5">
                                <StatusBadge tone={row.availability_status === "AVAILABLE" ? "success" : "warning"}>
                                  {row.availability_status}
                                </StatusBadge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {report.baseline_comparison.rows.some((r) => r.self_referential) && (
                      <p className="mt-2 text-[11px] text-warning">
                        Lead Time compares MARC-PLIFZ against itself — I07 has no separately-calculated lead time, so
                        this row&apos;s delta is agreement by construction, not independent validation.
                      </p>
                    )}
                    <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground sm:grid-cols-4">
                      {report.baseline_comparison.rows.map((row) => (
                        <div key={row.metric}>
                          {row.metric}: {formatCount(row.baseline_missing_count)} baseline missing ·{" "}
                          {formatCount(row.recommendation_missing_count)} rec. missing · {formatCount(row.not_evaluable_count)} not
                          evaluable
                        </div>
                      ))}
                    </div>
                  </ChartCard>

                  <ChartCard title="Limitations & Dependencies">
                    <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
                      {report.limitations.items.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </ChartCard>
                </div>
              </details>
            </>
          )}
        </>
      )}
    </div>
  )
}

/** The landing grid: one card per quarter that has an actual generated
 * report -- callers pass only `existingReports`' own quarters, never the
 * candidate/current-quarter list, so a quarter with nothing generated yet
 * shows no card at all rather than a placeholder. There is no manual
 * Generate action anywhere in this UI -- every report is produced only by
 * the scheduled task (Windows Task Scheduler "I07 Quarterly Report", see
 * app/reporting/generate_quarterly.py --auto); a card simply appears once
 * that task has run. */
function QuarterlyLandingGrid({
  quarters,
  existingReports,
  onView,
}: {
  quarters: string[]
  existingReports: QuarterlyReportListRow[]
  onView: (quarter: string) => void
}) {
  const byQuarter = new Map(existingReports.map((r) => [r.quarter, r]))

  if (quarters.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
        <FileBarChart className="mx-auto size-10 text-muted-foreground" />
        <div className="mt-3 text-base font-medium text-foreground">No quarterly reports yet</div>
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
          Reports are generated automatically after each quarter closes.
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {quarters.map((quarter) => {
          const existing = byQuarter.get(quarter)
          const completed = existing?.status === "COMPLETED"
          const failed = existing?.status === "FAILED"
          return (
            <div key={quarter} className="rounded-xl border border-border bg-card p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[15px] font-medium text-foreground">{quarter}</span>
                {completed && <StatusBadge tone="success">Completed</StatusBadge>}
                {failed && <StatusBadge tone="danger">Failed</StatusBadge>}
              </div>
              {existing && (
                <p className="mb-3.5 text-xs text-muted-foreground">
                  Generated {new Date(existing.generatedAt).toLocaleDateString()}
                </p>
              )}
              <Button size="sm" variant="outline" className="w-full" onClick={() => onView(quarter)}>
                View report
              </Button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function EmptyReportState({ quarter }: { quarter: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
      <FileBarChart className="mx-auto size-10 text-muted-foreground" />
      <div className="mt-3 text-base font-medium text-foreground">No report generated for {quarter}</div>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
        Reports are generated automatically after each quarter closes.
      </p>
    </div>
  )
}
