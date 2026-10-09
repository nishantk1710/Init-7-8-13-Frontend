"use client"

// Step 9 -- I07 Quarterly Deep-Dive Report frontend.
// Restructured per the approved mockup audit (i07_quarterly_report_mockup.html):
// a management-facing KPI/summary layout up top, backed only by real
// AvailabilityStatus-typed fields -- several mockup KPIs (stockout-risk
// severity, excess inventory, working-capital impact, a stockout-risk trend)
// have no defined business rule anywhere in I07 (confirmed by a full
// source-tree audit), and are rendered as explicit "not yet defined" states
// via ManagementSummary, never approximated or fabricated.
//
// The "Full report detail" accordion (the original 14-section technical
// deep-dive) and the Material criticality tier cards were removed on
// request: the deep-dive duplicated detail a management reader does not
// need first, and ZMM065 criticality is unpopulated for current quarters,
// so the tier cards rendered five honest-but-misleading zeros. Both remain
// available in the report JSON and the Excel export.

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
import { CircuitExposureChart } from "@/features/initiative-7/components/circuit-exposure-chart"
import { ForecastVsActualChart } from "@/features/initiative-7/components/forecast-vs-actual-chart"
import { InventoryHealthCard } from "@/features/initiative-7/components/inventory-health-card"
import { RecommendationStatusChart } from "@/features/initiative-7/components/recommendation-status-chart"
import { useLiveRecommendations } from "@/features/initiative-7/hooks/use-live-recommendations"
import { useLiveAdoptionSummary } from "@/features/initiative-7/hooks/use-live-adoption"
import { useQuarterlyReport } from "@/features/initiative-7/hooks/use-quarterly-report"
import { useQuarterlyReports } from "@/features/initiative-7/hooks/use-quarterly-reports"
import { fetchQuarterlyReportExportBlob, generateQuarterlyReport } from "@/features/initiative-7/services/i7-api"
import { ApiError } from "@/lib/api/client"
import type {
  ApiBaselineComparisonRow,
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
/** Text-color-only treatment for the material table's Crit. column, keyed on
 * the app's mapped Criticality (not the raw ZMM065 tier), applied as plain
 * colored text rather than a tinted badge to match the reference table's
 * style. */
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
  const { data: existingReports, refetch: refetchReportsList } = useQuarterlyReports(50)
  const [selectedQuarter, setSelectedQuarter] = useState<string>(quarters[0] ?? "")
  const [tab, setTab] = useState<GenerationTab>("landing")
  const [materialsPage, setMaterialsPage] = useState(1)
  const { data: report, loading, error, status, refetch, generate, generating, generationError } =
    useQuarterlyReport(tab === "report" ? selectedQuarter || null : null)
  const { summary: adoptionSummary } = useLiveAdoptionSummary()
  const [downloadState, setDownloadState] = useState<"idle" | "preparing" | "ready" | "error">("idle")
  const [downloadError, setDownloadError] = useState<string | null>(null)

  // "Generate latest closed quarter", from the landing grid -- no quarter is
  // selected yet at that point, so this cannot reuse useQuarterlyReport's own
  // generate() (which acts on the hook's current `quarter`). A thin,
  // self-contained action: call the no-arg generate endpoint, then open the
  // quarter the backend actually picked and refresh the landing grid's list
  // so the new report's card appears without a manual reload.
  const [generatingLatest, setGeneratingLatest] = useState(false)
  const [generateLatestError, setGenerateLatestError] = useState<string | null>(null)

  async function handleGenerateLatest() {
    setGeneratingLatest(true)
    setGenerateLatestError(null)
    try {
      const generated = await generateQuarterlyReport()
      refetchReportsList()
      openReport(generated.metadata.quarter)
    } catch (err) {
      setGenerateLatestError(
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Report generation failed.",
      )
    } finally {
      setGeneratingLatest(false)
    }
  }

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
  // reads as empty even when real, live recommendations exist). Paged
  // against the real backend (113k+ rows total) rather than
  // fetched-then-sliced client-side.
  //
  // Sorted newest-first. This previously asked for "rop_delta_magnitude",
  // which is NOT in the backend's sort whitelist
  // (app/api/i7/recommendations.py::SORT_FIELDS -- generated_at, status,
  // material, plant, demand_class, confidence). An unknown value is not
  // ignored: the route raises 400 INVALID_SORT_FIELD, so this fetch failed
  // outright and the table rendered its empty state on every load.
  //
  // There is no persisted ROP-delta column to sort on -- ranking by it would
  // mean computing a delta across all 113k rows -- so this uses a real,
  // indexed, whitelisted field instead of inventing a ranking. The heading
  // says "recent", not "top", because that is what the data now is.
  const { data: materials, total: materialsTotal } = useLiveRecommendations(
    report
      ? {
          sort: "generated_at",
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
          onGenerateLatest={handleGenerateLatest}
          generating={generatingLatest}
          generateError={generateLatestError}
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
            <EmptyReportState
              quarter={selectedQuarter}
              onGenerate={generate}
              generating={generating}
              generateError={generationError instanceof Error ? generationError.message : null}
            />
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
                  title="Materials — most recent recommendations"
                  subtitle="Newest first. Not ranked by reorder-point change — no such ranking exists in the backend today."
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

            </>
          )}
        </>
      )}
    </div>
  )
}

/** A manual "Generate" trigger, in the same pending/idle visual language as
 * the report view's own Download button (see handleDownload/downloadState
 * above) -- spinner while in flight, disabled for the duration so a double
 * click cannot submit two concurrent generations (harmless either way, since
 * the backend upserts by quarter, but a disabled button during the ~40-50s
 * call is the honest reflection of "a request is already running"). */
function GenerateReportButton({
  label,
  generating,
  onClick,
}: {
  label: string
  generating: boolean
  onClick: () => void
}) {
  return (
    <Button size="sm" variant="outline" onClick={onClick} disabled={generating}>
      {generating ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
      {generating ? "Generating…" : label}
    </Button>
  )
}

/** The landing grid: one card per quarter that has an actual generated
 * report -- callers pass only `existingReports`' own quarters, never the
 * candidate/current-quarter list, so a quarter with nothing generated yet
 * shows no card at all rather than a placeholder. A manual "Generate latest
 * closed quarter" action (wired to POST .../generate with no quarter, which
 * the backend resolves itself -- see period.latest_closed_quarter) sits
 * alongside the automatic path; it does not replace it. */
function QuarterlyLandingGrid({
  quarters,
  existingReports,
  onView,
  onGenerateLatest,
  generating,
  generateError,
}: {
  quarters: string[]
  existingReports: QuarterlyReportListRow[]
  onView: (quarter: string) => void
  onGenerateLatest: () => void
  generating: boolean
  generateError: string | null
}) {
  const byQuarter = new Map(existingReports.map((r) => [r.quarter, r]))

  if (quarters.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
        <FileBarChart className="mx-auto size-10 text-muted-foreground" />
        <div className="mt-3 text-base font-medium text-foreground">No quarterly reports yet</div>
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
          Quarterly reports are generated automatically after each quarter closes. You can also generate the
          latest closed quarter manually.
        </p>
        <div className="mt-4 flex justify-center">
          <GenerateReportButton label="Generate latest closed quarter" generating={generating} onClick={onGenerateLatest} />
        </div>
        {generateError && <p className="mt-2 text-xs text-destructive">{generateError}</p>}
      </div>
    )
  }

  return (
    <div>
      <div className="mb-3.5 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Reports are generated automatically after each quarter closes. You can also generate the latest closed
          quarter manually.
        </p>
        <GenerateReportButton label="Generate latest closed quarter" generating={generating} onClick={onGenerateLatest} />
      </div>
      {generateError && <p className="mb-3 text-xs text-destructive">{generateError}</p>}
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

function EmptyReportState({
  quarter,
  onGenerate,
  generating,
  generateError,
}: {
  quarter: string
  onGenerate: () => void
  generating: boolean
  generateError: string | null
}) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
      <FileBarChart className="mx-auto size-10 text-muted-foreground" />
      <div className="mt-3 text-base font-medium text-foreground">No report generated for {quarter}</div>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
        Quarterly reports are generated automatically after each quarter closes. You can also generate the latest
        closed quarter manually.
      </p>
      <div className="mt-4 flex justify-center">
        <GenerateReportButton label={`Generate ${quarter}`} generating={generating} onClick={onGenerate} />
      </div>
      {generateError && <p className="mt-2 text-xs text-destructive">{generateError}</p>}
    </div>
  )
}
