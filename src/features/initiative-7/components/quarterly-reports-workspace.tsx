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
  CircleCheck,
  Download,
  FileBarChart,
  Loader2,
  Play,
  RefreshCw,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ChartCard } from "@/components/shared/chart-card"
import { KPIStatCard } from "@/components/shared/kpi-stat-card"
import { MaterialIdentity } from "@/components/shared/material-identity"
import { RiskBadge } from "@/components/shared/risk-badge"
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
import { DonutWithLegend, type DonutSlice } from "@/features/initiative-7/components/donut-with-legend"
import { CRITICALITY_CODE } from "@/features/initiative-7/components/recommendation-review-panel"
import { useLiveRecommendations } from "@/features/initiative-7/hooks/use-live-recommendations"
import { useQuarterlyReport } from "@/features/initiative-7/hooks/use-quarterly-report"
import { useQuarterlyReports } from "@/features/initiative-7/hooks/use-quarterly-reports"
import { fetchQuarterlyReportExportBlob } from "@/features/initiative-7/services/i7-api"
import type {
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

const RECOMMENDATION_STATUS_COLOR: Record<string, string> = {
  NOT_EVALUABLE: "var(--muted-foreground)",
  READY_FOR_REVIEW: "var(--chart-4)",
  PENDING_APPROVAL: "var(--chart-1)",
  HELD: "var(--chart-1)",
  SENT_BACK: "var(--warning)",
  ADJUSTED: "var(--chart-1)",
  APPROVED: "var(--chart-3)",
  REJECTED: "var(--destructive)",
  SAP_EXECUTION_PENDING: "var(--chart-3)",
  SAP_EXECUTED: "var(--chart-5)",
  ADOPTED: "var(--chart-5)",
  PARTIALLY_ADOPTED: "var(--chart-5)",
  NOT_ADOPTED: "var(--chart-5)",
}

/** The 5 real ZMM065 tiers, most-severe first -- never collapsed into an
 * invented A/B/C 3-bucket grouping (no such grouping exists in policy or
 * code; see MaterialCriticalitySection's own docstring on the backend). */
const CRITICALITY_TIER_ORDER = ["CRITICAL", "IMPACT", "INSURANCE", "NORMAL", "OBSOLETE"] as const
const CRITICALITY_TIER_TONE: Record<string, "danger" | "warning" | "default"> = {
  CRITICAL: "danger",
  IMPACT: "warning",
  INSURANCE: "warning",
  NORMAL: "default",
  OBSOLETE: "default",
}

function statusColor(status: string): string {
  return RECOMMENDATION_STATUS_COLOR[status] ?? "var(--chart-2)"
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
 * a fabricated number in its place. */
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
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        {icon}
      </div>
      <AvailabilityValue status={metric.status} />
      <p className="text-[11px] leading-relaxed text-muted-foreground">{metric.reason}</p>
    </div>
  )
}

/** The mockup's "How the stock policy is changing" table -- Current (SAP) /
 * Recommended / Change, one row per metric. A missing SAP baseline renders as
 * an explicit dash + "not set in SAP" via AvailabilityValue, never a bare 0
 * -- see PopulationCount.current's own docstring for why 0 populated is a
 * real, different claim from "unknown". */
function StockPolicyRow({
  label,
  sublabel,
  current,
  recommended,
}: {
  label: string
  sublabel: string
  current: ApiPopulationCount
  recommended: ApiPopulationCount
}) {
  const currentAvailable = current.populated_count > 0
  const recommendedAvailable = recommended.populated_count > 0
  const changeKnown = currentAvailable && recommendedAvailable

  return (
    <TableRow>
      <TableCell>
        {label} <span className="text-xs text-muted-foreground">· {sublabel}</span>
      </TableCell>
      <TableCell className="text-right">
        {currentAvailable ? (
          <span className="tabular-nums">{formatCount(current.populated_count)} of {formatCount(current.total_count)} populated</span>
        ) : (
          <AvailabilityValue status="NOT_AVAILABLE" size="sm" />
        )}
      </TableCell>
      <TableCell className="text-right">
        {recommendedAvailable ? (
          <span className="tabular-nums">{formatCount(recommended.populated_count)} of {formatCount(recommended.total_count)} populated</span>
        ) : (
          <AvailabilityValue status="NOT_AVAILABLE" size="sm" />
        )}
      </TableCell>
      <TableCell className="text-right text-muted-foreground">
        {changeKnown ? "See Mean Delta below" : "—"}
      </TableCell>
    </TableRow>
  )
}

type GenerationTab = "landing" | "report"

export function QuarterlyReportsWorkspace() {
  const quarters = candidateQuarters()
  const { data: existingReports, refetch: refetchList } = useQuarterlyReports(50)
  const [selectedQuarter, setSelectedQuarter] = useState<string>(quarters[0] ?? "")
  const [tab, setTab] = useState<GenerationTab>("landing")
  const { data: report, loading, error, generating, generationError, status, generate, refetch } =
    useQuarterlyReport(tab === "report" ? selectedQuarter || null : null)
  const [downloadState, setDownloadState] = useState<"idle" | "preparing" | "ready" | "error">("idle")
  const [downloadError, setDownloadError] = useState<string | null>(null)

  const allQuarters = Array.from(
    new Set([...quarters, ...(existingReports?.map((r) => r.quarter) ?? [])]),
  )

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

  async function handleGenerate(quarter: string) {
    setSelectedQuarter(quarter)
    setTab("report")
    await generate()
    refetchList()
  }

  function openReport(quarter: string) {
    setSelectedQuarter(quarter)
    setTab("report")
  }

  const recommendationSlices: DonutSlice[] =
    report?.recommendations.by_status.map((row) => ({
      label: titleCaseStatus(row.status),
      count: row.count,
      color: statusColor(row.status),
    })) ?? []

  const demandOrder = ["SMOOTH", "ERRATIC", "INTERMITTENT", "LUMPY", "UNCLASSIFIED"]
  const demandByClass = new Map(report?.demand_classification.by_class.map((d) => [d.demand_class, d]) ?? [])
  const demandSlices: DonutSlice[] = demandOrder
    .filter((cls) => demandByClass.has(cls))
    .map((cls) => {
      const row = demandByClass.get(cls)!
      return { label: DEMAND_CLASS_LABEL[cls] ?? cls, count: row.count, color: DEMAND_CLASS_COLOR[cls] ?? "var(--chart-2)" }
    })

  const criticalityByTier = new Map(report?.material_criticality.by_tier.map((row) => [row.criticality, row.count]) ?? [])

  // Material table: the existing recommendations list endpoint, scoped to
  // the report's own quarter (generated_from/generated_to), sorted so the
  // largest ROP changes surface first -- reused, not a new endpoint. Only
  // fetched once a report is loaded, since the period comes from it.
  const { data: materials, total: materialsTotal } = useLiveRecommendations(
    report
      ? {
          generatedFrom: `${report.metadata.period_start}T00:00:00Z`,
          generatedTo: `${report.metadata.period_end}T23:59:59Z`,
          sort: "generated_at",
          sortDesc: true,
          pageSize: 5,
        }
      : {},
  )

  return (
    <div className="flex flex-col gap-4">
      {tab === "landing" && (
        <QuarterlyLandingGrid
          quarters={allQuarters}
          existingReports={existingReports ?? []}
          onGenerate={handleGenerate}
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
            <span className="text-xs font-medium text-muted-foreground">Quarter</span>
            <Select value={selectedQuarter} onValueChange={(value) => setSelectedQuarter(value ?? "")}>
              <SelectTrigger size="sm" className="min-w-32">
                <SelectValue placeholder="Select quarter" />
              </SelectTrigger>
              <SelectContent>
                {allQuarters.map((q) => (
                  <SelectItem key={q} value={q}>
                    {q}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

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
              <Button size="sm" variant="outline" onClick={() => refetch()} disabled={loading || generating}>
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
              <Button size="sm" onClick={() => generate()} disabled={generating || !selectedQuarter}>
                {generating && <Loader2 className="size-3.5 animate-spin" />}
                {generating ? "Generating…" : "Regenerate"}
              </Button>
            </div>
          </div>

          {generating && (
            <GeneratingState quarter={selectedQuarter} />
          )}
          {generationError && !generating && (
            <FailedState
              quarter={selectedQuarter}
              message={generationError.message}
              onRetry={() => generate()}
            />
          )}
          {downloadError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {downloadError}
            </div>
          )}

          {loading && !report && !generating && (
            <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
              Loading report…
            </div>
          )}

          {error && !report && !generating && !generationError && (
            <EmptyReportState quarter={selectedQuarter} onGenerate={() => generate()} />
          )}

          {report && !generating && (
            <>
              {/* --- KPI row: real metrics + honestly-undefined ones --------- */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <UndefinedKpiCard
                  label="Critical stockout risk"
                  icon={<AlertTriangle className="size-4 text-destructive" />}
                  metric={report.management_summary.critical_stockout_risk}
                />
                <UndefinedKpiCard
                  label="Excess inventory candidates"
                  icon={<FileBarChart className="size-4 text-accent-foreground" />}
                  metric={report.management_summary.excess_inventory_candidates}
                />
                <UndefinedKpiCard
                  label="Working capital impact"
                  icon={<FileBarChart className="size-4 text-success" />}
                  metric={report.management_summary.working_capital_impact}
                />
                <KPIStatCard
                  label="Pending approval"
                  value={formatCount(report.executive_summary.pending_approval_count)}
                  hint={
                    report.executive_summary.pending_approval_percentage !== null
                      ? `${formatDecimal(report.executive_summary.pending_approval_percentage, 1)}% of recommendations`
                      : `of ${formatCount(report.executive_summary.total_recommendations)} recommendations`
                  }
                />
              </div>

              {/* --- Stockout risk distribution + Recommendation status ------ */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <ChartCard title="Stockout risk distribution" span={6}>
                  <AvailabilityValue status={report.management_summary.stockout_risk_distribution.status} />
                  <p className="mt-2 text-xs text-muted-foreground">
                    {report.management_summary.stockout_risk_distribution.reason}
                  </p>
                </ChartCard>

                <ChartCard
                  title="Recommendation status"
                  subtitle="Where each change sits in the approval flow."
                  span={6}
                >
                  {recommendationSlices.length > 0 ? (
                    <DonutWithLegend slices={recommendationSlices} />
                  ) : (
                    <div className="text-sm text-muted-foreground">No recommendations in scope.</div>
                  )}
                </ChartCard>
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
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {CRITICALITY_TIER_ORDER.map((tier) => (
                    <div key={tier} className="rounded-lg border border-border/60 bg-muted/20 p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{tier}</span>
                        <StatusBadge tone={CRITICALITY_TIER_TONE[tier]}>{tier[0]}</StatusBadge>
                      </div>
                      <div className="mt-1 text-xl font-semibold text-foreground">
                        {formatCount(criticalityByTier.get(tier) ?? 0)}
                      </div>
                    </div>
                  ))}
                  <div className="rounded-lg border border-dashed border-border/60 bg-muted/10 p-3">
                    <span className="text-xs text-muted-foreground">Not populated</span>
                    <div className="mt-1 text-xl font-semibold text-muted-foreground">
                      {formatCount(criticalityByTier.get(undefined as unknown as string) ?? report.material_criticality.total - report.material_criticality.populated_count)}
                    </div>
                  </div>
                </div>
              </ChartCard>

              {/* --- Stock policy table --------------------------------------- */}
              <ChartCard
                title="How the stock policy is changing"
                subtitle="Current SAP values against I07 recommendations, over rows generated this quarter."
              >
                <div className="overflow-x-auto rounded-lg border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Stock level</TableHead>
                        <TableHead className="text-right">Current (SAP)</TableHead>
                        <TableHead className="text-right">Recommended</TableHead>
                        <TableHead className="text-right">Change</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <StockPolicyRow
                        label="Safety stock"
                        sublabel="demand buffer"
                        current={report.safety_stock.current}
                        recommended={report.safety_stock.recommended}
                      />
                      <StockPolicyRow
                        label="Reorder point"
                        sublabel="when to raise a PO"
                        current={report.reorder_point.current}
                        recommended={report.reorder_point.recommended}
                      />
                      <StockPolicyRow
                        label="Maximum stock"
                        sublabel="ceiling to hold"
                        current={report.max_stock.current}
                        recommended={report.max_stock.recommended}
                      />
                    </TableBody>
                  </Table>
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Populated counts, not aggregated levels — Current Safety Stock is confirmed NOT_AVAILABLE on this
                  extract (EISBE is absent from MARC); see Mean Delta in Full report detail below for the actual
                  quantity change where both sides exist.
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {report.reorder_point.current_sap_value_reused_note}
                </p>
              </ChartCard>

              {/* --- Material table -------------------------------------------- */}
              <ChartCard
                title="Materials — top reorder changes"
                subtitle={`Showing ${formatCount(materials?.length ?? 0)} of ${formatCount(materialsTotal)}. Full list in the Excel export.`}
              >
                {materials && materials.length > 0 ? (
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Material</TableHead>
                          <TableHead>Plant</TableHead>
                          <TableHead>Circuit</TableHead>
                          <TableHead>Crit.</TableHead>
                          <TableHead>Demand pattern</TableHead>
                          <TableHead className="text-right">ROP now → rec.</TableHead>
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
                              <StatusBadge tone="default">{CRITICALITY_CODE[rec.criticality as Criticality]}</StatusBadge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{rec.demandPattern}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatCount(rec.current.rop)} → {formatCount(rec.recommended.rop)}
                            </TableCell>
                            <TableCell>
                              <RiskBadge level={rec.risk} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">No recommendations generated in this quarter.</div>
                )}
              </ChartCard>

              {/* --- Stockout risk trend + SAP adoption ------------------------ */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <ChartCard title="Stockout risk trend" subtitle="Materials at high/critical risk, by month.">
                  <AvailabilityValue status={report.management_summary.stockout_risk_trend.status} />
                  <p className="mt-2 text-xs text-muted-foreground">
                    {report.management_summary.stockout_risk_trend.reason}
                  </p>
                </ChartCard>

                <ChartCard title="SAP adoption" subtitle="Whether approved recommendations were applied in SAP.">
                  <AvailabilityValue status={report.sap_adoption.status} />
                  <p className="mt-2 text-xs text-muted-foreground">{report.sap_adoption.reason}</p>
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

/** The mockup's landing grid: one card per quarter, Completed/Not-generated
 * badge, View report / Generate. Data comes entirely from the existing list
 * endpoint (status per quarter) -- no new backend capability. */
function QuarterlyLandingGrid({
  quarters,
  existingReports,
  onGenerate,
  onView,
}: {
  quarters: string[]
  existingReports: QuarterlyReportListRow[]
  onGenerate: (quarter: string) => void
  onView: (quarter: string) => void
}) {
  const byQuarter = new Map(existingReports.map((r) => [r.quarter, r]))

  if (quarters.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
        <FileBarChart className="mx-auto size-10 text-muted-foreground" />
        <div className="mt-3 text-base font-medium text-foreground">No quarterly reports yet</div>
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
          Generate a report for a completed quarter to see a management summary of inventory recommendations.
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-base font-medium text-foreground">Quarterly Report</h2>
        <p className="text-sm text-muted-foreground">
          Pick a quarter to view its report, or generate one that hasn&apos;t been run yet.
        </p>
      </div>
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
                {!existing && <StatusBadge tone="default">Not generated</StatusBadge>}
              </div>
              <p className="mb-3.5 text-xs text-muted-foreground">
                {existing
                  ? `Generated ${new Date(existing.generatedAt).toLocaleDateString()}`
                  : "No report yet"}
              </p>
              {existing ? (
                <Button size="sm" variant="outline" className="w-full" onClick={() => onView(quarter)}>
                  View report
                </Button>
              ) : (
                <Button size="sm" className="w-full" onClick={() => onGenerate(quarter)}>
                  <Play className="size-3.5" />
                  Generate
                </Button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function GeneratingState({ quarter }: { quarter: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-8 text-center">
      <Loader2 className="mx-auto size-9 animate-spin text-accent-foreground" />
      <div className="mt-4 text-base font-medium text-foreground">Generating {quarter} report…</div>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Aggregating I07 results across all plants. This usually takes 40-50 seconds.
      </p>
      <div className="mt-5 flex items-center justify-center gap-2 text-xs">
        <span className="flex items-center gap-1.5 text-success">
          <CircleCheck className="size-3.5" />
          Pending
        </span>
        <span className="h-px w-6 bg-border" />
        <span className="flex items-center gap-1.5 font-medium text-accent-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          Running
        </span>
        <span className="h-px w-6 bg-border" />
        <span className="flex items-center gap-1.5 text-muted-foreground">Completed</span>
      </div>
    </div>
  )
}

function FailedState({ quarter, message, onRetry }: { quarter: string; message: string; onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-destructive/30 bg-card p-8 text-center">
      <AlertTriangle className="mx-auto size-8 text-destructive" />
      <div className="mt-2.5 text-base font-medium text-foreground">Report generation failed</div>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
        {quarter} couldn&apos;t be generated. {message}
      </p>
      <div className="mt-5 flex justify-center gap-2">
        <Button size="sm" onClick={onRetry}>
          <RefreshCw className="size-3.5" />
          Try again
        </Button>
      </div>
    </div>
  )
}

function EmptyReportState({ quarter, onGenerate }: { quarter: string; onGenerate: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
      <FileBarChart className="mx-auto size-10 text-muted-foreground" />
      <div className="mt-3 text-base font-medium text-foreground">No report generated for {quarter}</div>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
        Click &ldquo;Generate&rdquo; to build a management summary of inventory recommendations for this quarter.
      </p>
      <Button size="sm" className="mt-4" onClick={onGenerate}>
        <Play className="size-3.5" />
        Generate first report
      </Button>
    </div>
  )
}
