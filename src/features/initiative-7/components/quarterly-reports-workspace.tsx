"use client"

// Step 9 -- I07 Quarterly Deep-Dive Report frontend.
//
// The report workspace: quarter picker (from the list endpoint), a Generate
// button (synchronous POST, ~40-50s per the backend's own docstring), a
// generation-status banner, an Excel download, and the fourteen report
// sections. Every metric that carries an AvailabilityStatus renders through
// AvailabilityValue (see that component) -- never a bare 0/blank/"N/A".

import { useState } from "react"
import { Download, Loader2, RefreshCw } from "lucide-react"

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
import { StatusBadge } from "@/components/shared/status-badge"
import { cn, formatCount } from "@/lib/utils"
import { AvailabilityValue, formatDecimal } from "@/features/initiative-7/components/availability-value"
import { DonutWithLegend, type DonutSlice } from "@/features/initiative-7/components/donut-with-legend"
import { useQuarterlyReport } from "@/features/initiative-7/hooks/use-quarterly-report"
import { useQuarterlyReports } from "@/features/initiative-7/hooks/use-quarterly-reports"
import { fetchQuarterlyReportExportBlob } from "@/features/initiative-7/services/i7-api"
import type {
  ApiForecastAccuracyMetric,
  ApiPopulationCount,
} from "@/features/initiative-7/types/api"

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

export function QuarterlyReportsWorkspace() {
  const quarters = candidateQuarters()
  const { data: existingReports } = useQuarterlyReports(50)
  const [selectedQuarter, setSelectedQuarter] = useState<string>(quarters[0] ?? "")
  const { data: report, loading, error, generating, generationError, status, generate, refetch } =
    useQuarterlyReport(selectedQuarter || null)
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  // Prefer the most recently generated quarter as the initial selection,
  // once the list has loaded, rather than always defaulting to the current
  // calendar quarter (which likely has no report yet). Derived during render
  // (the React-endorsed way to derive state from a changed prop without the
  // "setState synchronously in an effect" cascading-render smell) rather than
  // in a useEffect.
  const [hasAutoSelected, setHasAutoSelected] = useState(false)
  if (!hasAutoSelected && existingReports && existingReports.length > 0) {
    setSelectedQuarter(existingReports[0].quarter)
    setHasAutoSelected(true)
  }

  const allQuarters = Array.from(
    new Set([...quarters, ...(existingReports?.map((r) => r.quarter) ?? [])]),
  )

  async function handleDownload() {
    if (!selectedQuarter) return
    setDownloading(true)
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
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "Download failed.")
    } finally {
      setDownloading(false)
    }
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

  return (
    <div className="flex flex-col gap-4">
      {/* --- Controls -------------------------------------------------- */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
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
          <Button size="sm" variant="outline" onClick={handleDownload} disabled={!report || downloading}>
            {downloading ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
            Export Excel
          </Button>
          <Button size="sm" onClick={() => generate()} disabled={generating || !selectedQuarter}>
            {generating && <Loader2 className="size-3.5 animate-spin" />}
            {generating ? "Generating…" : "Generate report"}
          </Button>
        </div>
      </div>

      {generating && (
        <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Generation runs synchronously against the full dataset and typically takes 40-50 seconds. This page will
          update automatically when it finishes.
        </div>
      )}
      {generationError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {generationError.message}
        </div>
      )}
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
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          No report has been generated for {selectedQuarter || "this quarter"} yet. Click &ldquo;Generate report&rdquo;
          to build one.
        </div>
      )}

      {report && (
        <>
          {/* --- Metadata / Executive Summary ---------------------------- */}
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

          {/* --- Scope & Data Quality ------------------------------------ */}
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

          {/* --- Forecasting ---------------------------------------------- */}
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

          {/* --- Safety Stock / ROP / Max Stock ---------------------------- */}
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

          {/* --- OAR --------------------------------------------------- */}
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

          {/* --- Recommendations / Approval --------------------------------- */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ChartCard title="Recommendations" subtitle={`${formatCount(report.recommendations.total)} total`} span={6}>
              {recommendationSlices.length > 0 ? (
                <DonutWithLegend slices={recommendationSlices} />
              ) : (
                <div className="text-sm text-muted-foreground">No recommendations in scope.</div>
              )}
            </ChartCard>

            <ChartCard title="Approval" span={6}>
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
          </div>

          {/* --- Baseline Comparison ---------------------------------------- */}
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
                      <td className="py-1.5 pr-3 text-foreground">{row.metric}</td>
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

          {/* --- SAP Adoption ------------------------------------------------ */}
          <ChartCard title="SAP Adoption">
            <div className="flex items-center gap-3">
              <AvailabilityValue status={report.sap_adoption.status} />
              <span className="text-sm text-muted-foreground">{report.sap_adoption.reason}</span>
            </div>
          </ChartCard>

          {/* --- Limitations -------------------------------------------------- */}
          <ChartCard title="Limitations & Dependencies">
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
              {report.limitations.items.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </ChartCard>
        </>
      )}
    </div>
  )
}
