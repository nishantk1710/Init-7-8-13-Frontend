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

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import {
  AlertTriangle,
  Boxes,
  Clock,
  FileBarChart,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  TrendingUp,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { ChartCard } from "@/components/shared/chart-card"
import { MaterialIdentity } from "@/components/shared/material-identity"
import { StatusBadge } from "@/components/shared/status-badge"
import { LoadingSpinner } from "@/components/shared/loading-spinner"
import { PageLoader } from "@/components/shared/page-loader"
import { TablePagination } from "@/components/shared/table-pagination"
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
import { PortfolioForecastVsActualChart } from "@/features/initiative-7/components/portfolio-forecast-vs-actual-chart"
import { InventoryHealthCard } from "@/features/initiative-7/components/inventory-health-card"
import { RecommendationStatusChart } from "@/features/initiative-7/components/recommendation-status-chart"
import { useLiveRecommendations } from "@/features/initiative-7/hooks/use-live-recommendations"
import { useLiveAdoptionSummary } from "@/features/initiative-7/hooks/use-live-adoption"
import { KpiCard } from "@/features/initiative-7/components/report-kpi-card"
import { dayAfter, QuarterlyManagementView } from "@/features/initiative-7/components/quarterly-management-view"
import { ManagementPrintView } from "@/features/initiative-7/components/quarterly-management-print"
import { StockPolicyRow } from "@/features/initiative-7/components/quarterly-stock-policy-row"
import { QuarterlySnapshotReport } from "@/features/initiative-7/components/quarterly-snapshot-report"
import { QuarterlySourceActivity } from "@/features/initiative-7/components/quarterly-source-activity"
import { useQuarterlyReport } from "@/features/initiative-7/hooks/use-quarterly-report"
import { useQuarterlyReports } from "@/features/initiative-7/hooks/use-quarterly-reports"
import { fetchQuarterlyReportExportBlob, generateQuarterlyReport } from "@/features/initiative-7/services/i7-api"
import { ReportPrintView } from "@/features/initiative-7/components/report-print-view"
import "@/features/initiative-7/components/report-print.css"
import { ApiError } from "@/lib/api/client"
import type { ApiUndefinedManagementMetric } from "@/features/initiative-7/types/api"
import type { QuarterlyReportListRow } from "@/features/initiative-7/services/i7-api"
import type { Criticality } from "@/features/initiative-7/types/inventory"
import { hasRealCircuit } from "@/features/initiative-7/utils/circuit"
import { pagedTableView } from "@/features/initiative-7/utils/paged-table-state"
import { SNAPSHOT_CAPTION, SNAPSHOT_QUARTER } from "@/features/initiative-7/utils/quarterly-snapshot"
import {
  REPORT_KINDS,
  landingReports,
  reportKindOf,
  reportNoun,
  type ReportKind,
} from "@/features/initiative-7/utils/report-period"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

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

/** Shown above a report saved before the management view existed (report version 1.1 and earlier). Its charts are
 * built from a sample of the 200 newest recommendations and some of its cards say "Not configured", so it is offered
 * for regeneration rather than presented as the period's full picture. */
function RegenerateBanner({ onRegenerate, generating }: { onRegenerate: () => void; generating: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-warning/40 bg-warning/10 p-3">
      <p className="min-w-[260px] flex-1 text-xs leading-relaxed text-foreground">
        This report was saved before the management view existed. Its stockout and status charts come from a sample of
        the 200 newest recommendations, not from this period. Regenerate it to see the updated figures.
      </p>
      <Button size="sm" variant="outline" onClick={onRegenerate} disabled={generating}>
        <RefreshCw className={cn("size-3.5", generating && "animate-spin")} />
        {generating ? "Regenerating…" : "Regenerate"}
      </Button>
    </div>
  )
}

type GenerationTab = "landing" | "report"

const MATERIALS_PAGE_SIZE = 5

/** Rows the PDF's material table carries. The screen shows a 5-row preview;
 * the PDF is the fuller record, but still a subset of ~113k and labelled as
 * one -- it is not ranked by ROP change, because no such ranking exists in
 * the backend (see recommendation-sort-contract.test.ts). */
const PDF_MATERIALS_SIZE = 50

/** Rows backing the on-screen charts. Printed verbatim in the PDF's
 * disclosure so a sample is never implied to be the whole quarter. */
const CHART_SAMPLE_SIZE = 200

export function QuarterlyReportsWorkspace() {
  const quarters = candidateQuarters()
  const { data: existingReports, refetch: refetchReportsList } = useQuarterlyReports(50)
  const [selectedQuarter, setSelectedQuarter] = useState<string>(quarters[0] ?? "")
  const [tab, setTab] = useState<GenerationTab>("landing")
  // Which list the landing grid shows. Opening a report sets it to that report's kind, so "← All reports" returns to
  // the list the report came from.
  const [kind, setKind] = useState<ReportKind>("quarterly")
  const [materialsPage, setMaterialsPage] = useState(1)
  // Q2 2026 is a fixed snapshot with its own view; there is no generated report to fetch for it.
  const isSnapshot = tab === "report" && selectedQuarter === SNAPSHOT_QUARTER
  const { data: report, loading, error, status, refetch, generate, generating, generationError } =
    useQuarterlyReport(tab === "report" && !isSnapshot ? selectedQuarter || null : null)
  const { summary: adoptionSummary } = useLiveAdoptionSummary()
  const [pdfState, setPdfState] = useState<"idle" | "preparing">("idle")
  const [pdfError, setPdfError] = useState<string | null>(null)
  const [excelState, setExcelState] = useState<"idle" | "preparing">("idle")
  const [excelError, setExcelError] = useState<string | null>(null)
  // Set when the user asks to print; cleared once the dialog has been
  // opened. The effect below waits on it rather than printing inline, so
  // the 50-row fetch and the print view's own render both land first.
  const [printRequested, setPrintRequested] = useState(false)
  const printTimer = useRef<number | null>(null)

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
      // "Latest closed" means the latest closed month or quarter, whichever toggle the landing grid is on.
      const generated = await generateQuarterlyReport(undefined, kind === "monthly" ? "month" : undefined)
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

  /** Download PDF -- the complete management report, printed by the
   * browser.
   *
   * This only *requests* a print. The actual window.print() happens in the
   * effect below, once the PDF's own 50-row material fetch has resolved and
   * React has committed the print view. Calling print() here would open the
   * dialog against a half-populated DOM and produce a PDF with an empty
   * material table -- the exact "blank section" failure this has to avoid.
   *
   * Re-entrancy: the button is disabled while pdfState is "preparing", and
   * the effect clears the request before printing, so a double click cannot
   * open two dialogs. */
  function handleDownloadPdf() {
    if (!report || pdfState === "preparing") return
    setPdfError(null)
    setPdfState("preparing")
    setPrintRequested(true)
  }

  /** Download Excel -- the saved report's workbook from GET /reports/quarterly/{quarter}/export: the KPI cards, the
   * monthly activity and the raw detail. Unlike the PDF it needs no print view, so it is one request and a download.
   * The button is disabled while the request is out, so a double click cannot download it twice. */
  async function handleDownloadExcel() {
    if (!report || excelState === "preparing") return
    setExcelError(null)
    setExcelState("preparing")
    try {
      const { blobUrl, filename } = await fetchQuarterlyReportExportBlob(selectedQuarter)
      const link = document.createElement("a")
      link.href = blobUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(blobUrl)
    } catch (err) {
      setExcelError(
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : "The Excel download failed.",
      )
    } finally {
      setExcelState("idle")
    }
  }

  function openReport(quarter: string) {
    setKind(reportKindOf(quarter))
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
  const { data: materials, total: materialsTotal, loading: materialsLoading } = useLiveRecommendations(
    report && !report.management
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
    report && !report.management ? { pageSize: 200 } : {},
  )

  // No circuit in the data means every row reads "Unassigned": the table
  // column and the exposure chart would each be one repeated word.
  const showCircuit = hasRealCircuit(materials ?? [])

  // The PDF's material table: 50 rows, fetched only once a print has been
  // requested so an ordinary page view never pays for it. Same unscoped,
  // newest-first fetch as the on-screen preview -- deliberately the same
  // query, so the PDF cannot disagree with the screen about what the most
  // recent recommendations are.
  const { data: pdfMaterials, total: pdfMaterialsTotal, loading: pdfMaterialsLoading } =
    useLiveRecommendations(
      report && printRequested
        ? {
            sort: "generated_at",
            sortDesc: true,
            page: 1,
            pageSize: PDF_MATERIALS_SIZE,
            // A report with the management view prints this period's recommendations; an older one keeps the unscoped list.
            ...(report.management
              ? {
                  generatedFrom: `${report.metadata.period_start}T00:00:00`,
                  generatedTo: `${dayAfter(report.metadata.period_end)}T00:00:00`,
                }
              : {}),
          }
        : {},
    )

  // Open the print dialog only when everything the PDF needs is on the page.
  //
  // Waits on: the report itself, the 50-row material fetch, and -- via
  // document.fonts.ready -- webfont loading, because printing mid-swap
  // reflows every table and can clip a column. The rAF pair after that
  // yields until React has committed and the browser has painted, so the
  // print view is in the DOM and laid out before the dialog snapshots it.
  useEffect(() => {
    if (!printRequested) return
    if (!report) return
    if (pdfMaterialsLoading) return

    let cancelled = false

    const fontsReady: Promise<unknown> =
      typeof document !== "undefined" && "fonts" in document
        ? (document as Document & { fonts: { ready: Promise<unknown> } }).fonts.ready
        : Promise.resolve()

    fontsReady
      .then(
        () =>
          new Promise<void>((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
          }),
      )
      .then(() => {
        if (cancelled) return
        // Clear the request BEFORE print(): print() blocks on the modal
        // dialog, and leaving the flag set would re-enter this effect.
        setPrintRequested(false)
        try {
          window.print()
        } catch (err) {
          setPdfError(err instanceof Error ? err.message : "Could not open the print dialog.")
        } finally {
          setPdfState("idle")
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setPrintRequested(false)
        setPdfState("idle")
        setPdfError(err instanceof Error ? err.message : "Could not prepare the PDF.")
      })

    return () => {
      cancelled = true
    }
  }, [printRequested, report, pdfMaterialsLoading])

  // Guard against a stuck "Preparing…" if the dialog never opens.
  useEffect(() => {
    if (pdfState !== "preparing") return
    printTimer.current = window.setTimeout(() => {
      setPdfState("idle")
      setPrintRequested(false)
      setPdfError("Preparing the PDF timed out. Please try again.")
    }, 30_000)
    return () => {
      if (printTimer.current !== null) window.clearTimeout(printTimer.current)
    }
  }, [pdfState])

  return (
    <div className="flex flex-col gap-4">
      {tab === "landing" && (
        <>
          {/* The Action Center's toggle: the same blue bordered track, one report kind at a time. */}
          <Tabs value={kind} onValueChange={(v) => setKind(v as ReportKind)}>
            <TabsList className="w-full max-w-sm border-2 border-action/40 bg-card p-1 shadow-lg ring-0 group-data-horizontal/tabs:h-11">
              {REPORT_KINDS.map((k) => (
                <TabsTrigger
                  key={k.id}
                  value={k.id}
                  className="px-4 font-semibold text-foreground/70 duration-300 ease-out data-active:border-action data-active:bg-background data-active:text-foreground data-active:shadow-md dark:data-active:border-action dark:data-active:bg-background dark:data-active:text-foreground"
                >
                  {k.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <QuarterlyLandingGrid
            kind={kind}
            quarters={landingReports(kind, (existingReports ?? []).map((r) => r.quarter))}
            existingReports={existingReports ?? []}
            onView={openReport}
            onGenerateLatest={handleGenerateLatest}
            generating={generatingLatest}
            generateError={generateLatestError}
          />
        </>
      )}

      {isSnapshot && <QuarterlySnapshotReport onBack={() => setTab("landing")} />}

      {tab === "report" && !isSnapshot && (
        <>
          {/* --- Controls -------------------------------------------------- */}
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
            <Button size="sm" variant="ghost" onClick={() => setTab("landing")}>
              ← All reports
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
                className="h-9 border-action bg-action/10 font-semibold text-action shadow-sm hover:bg-action/20 hover:text-action"
                onClick={handleDownloadExcel}
                disabled={!report || excelState === "preparing"}
              >
                {excelState === "preparing" ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <FileSpreadsheet className="size-3.5" />
                )}
                {excelState === "preparing" ? "Preparing Excel…" : "Download Excel"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-9 border-action bg-action/10 font-semibold text-action shadow-sm hover:bg-action/20 hover:text-action"
                onClick={handleDownloadPdf}
                disabled={!report || pdfState === "preparing"}
              >
                {pdfState === "preparing" ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <FileBarChart className="size-3.5" />
                )}
                {pdfState === "preparing" ? "Preparing PDF…" : "Download PDF"}
              </Button>
            </div>
          </div>

          {pdfError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {pdfError}
            </div>
          )}
          {excelError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {excelError}
            </div>
          )}

          {loading && !report && (
            <PageLoader label="Loading the report" className="h-72 w-full" />
          )}

          {error && !report && (
            <EmptyReportState
              quarter={selectedQuarter}
              onGenerate={generate}
              generating={generating}
              generateError={generationError instanceof Error ? generationError.message : null}
            />
          )}

          {report && report.management && <QuarterlyManagementView report={report} management={report.management} />}

          {report && !report.management && (
            <>
              <RegenerateBanner onRegenerate={generate} generating={generating} />
              {/* --- KPI row: real metrics + honestly-undefined ones --------- */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <UndefinedKpiCard
                  label="High Stockout Risk"
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
                {report.source_activity && (
                  <ChartCard
                    title="Source activity by month"
                    subtitle={`Consumption recorded in each month of ${selectedQuarter}, from the staged SAP data.`}
                    span={12}
                  >
                    <QuarterlySourceActivity section={report.source_activity} />
                  </ChartCard>
                )}

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
                  {pagedTableView(materialsLoading, materials) === "skeleton" ? (
                    <LoadingSpinner label="Loading recommendations" className="h-48 w-full" />
                  ) : pagedTableView(materialsLoading, materials) === "rows" && materials ? (
                    <div className="flex flex-col gap-3">
                      <div
                        className={cn("overflow-x-auto rounded-lg border border-border transition-opacity", materialsLoading && "opacity-50")}
                        aria-busy={materialsLoading}
                      >
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/40 hover:bg-muted/40">
                              <TableHead>Material</TableHead>
                              <TableHead>Plant</TableHead>
                              {showCircuit && <TableHead>Circuit</TableHead>}
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
                                {showCircuit && <TableCell className="text-muted-foreground">{rec.circuit}</TableCell>}
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

                      <TablePagination
                        page={materialsPage}
                        pageSize={MATERIALS_PAGE_SIZE}
                        total={materialsTotal}
                        count={materials.length}
                        noun="recommendations"
                        loading={materialsLoading}
                        onPageChange={setMaterialsPage}
                      />
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">No recommendations found.</div>
                  )}
                </ChartCard>

                <ChartCard title="Stockout risk trend" subtitle="Materials at high/critical risk, by month." span={12}>
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
                >
                  <PortfolioForecastVsActualChart
                    period={{
                      start: report.metadata.period_start,
                      end: report.metadata.period_end,
                      label: report.metadata.quarter,
                    }}
                  />
                </ChartCard>

                <ChartCard title="SAP adoption" subtitle="Whether approved recommendations were applied in SAP." span={5}>
                  <div className="flex flex-col items-center gap-2 py-6 text-center">
                    <AvailabilityValue status={report.sap_adoption.status} />
                    <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">{report.sap_adoption.reason}</p>
                  </div>
                  {adoptionSummary && adoptionSummary.totalEvaluated > 0 && (
                    <div className="mt-3 border-t border-border/60 pt-3 text-center">
                      <p className="text-[11px] text-muted-foreground">
                        {adoptionSummary.adoptedCount} adopted · {adoptionSummary.partiallyAdoptedCount} partial ·{" "}
                        {adoptionSummary.notAdoptedCount} not adopted · {adoptionSummary.unknownCount} pending, of{" "}
                        {adoptionSummary.totalEvaluated} recommendations tracked.
                      </p>
                    </div>
                  )}
                </ChartCard>
              </div>

            </>
          )}
        </>
      )}

      {/* The print view is portalled to <body> because the print stylesheet
        * hides `body > *` and re-shows only `.print-portal`. Rendered inside
        * the app's own tree it would be hidden along with its ancestors.
        *
        * Mounted only once a print has been requested: it is a second, full
        * render of every section, and an ordinary page view should not pay
        * for it. By the time print() fires (the effect above) this has been
        * committed and painted. */}
      {/* printRequested can only be true after a click, so this never
        * evaluates during SSR; the typeof check documents that rather than
        * relying on it. */}
      {printRequested &&
        report &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="print-portal">
            {report.management ? (
              <ManagementPrintView
                report={report}
                management={report.management}
                materials={pdfMaterials ?? []}
                materialsTotal={pdfMaterialsTotal}
              />
            ) : (
              <ReportPrintView
                report={report}
                materials={pdfMaterials ?? []}
                materialsTotal={pdfMaterialsTotal}
                chartSampleSize={CHART_SAMPLE_SIZE}
                chartRecommendations={chartRecommendations ?? []}
              />
            )}
          </div>,
          document.body,
        )}
    </div>
  )
}

/** A manual "Generate" trigger, in the same pending/idle visual language as
 * the report view's own Download PDF button (see handleDownloadPdf/pdfState
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
    <Button
      size="sm"
      variant="outline"
      className="h-9 border-action bg-action/10 font-semibold text-action shadow-sm hover:bg-action/20 hover:text-action"
      onClick={onClick}
      disabled={generating}
    >
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
  kind,
  quarters,
  existingReports,
  onView,
  onGenerateLatest,
  generating,
  generateError,
}: {
  kind: ReportKind
  quarters: string[]
  existingReports: QuarterlyReportListRow[]
  onView: (quarter: string) => void
  onGenerateLatest: () => void
  generating: boolean
  generateError: string | null
}) {
  const byQuarter = new Map(existingReports.map((r) => [r.quarter, r]))
  // "month" or "quarter": the grid's words and its generate button follow the toggle.
  const noun = reportNoun(kind).singular
  const generateLabel = `Generate latest closed ${noun}`

  if (quarters.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
        <FileBarChart className="mx-auto size-10 text-muted-foreground" />
        <div className="mt-3 text-base font-medium text-foreground">No {kind} reports yet</div>
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
          {kind === "monthly" ? "Monthly" : "Quarterly"} reports are generated automatically after each {noun}{" "}
          {kind === "monthly" ? "ends" : "closes"}. You can also generate the latest closed {noun} manually.
        </p>
        <div className="mt-4 flex justify-center">
          <GenerateReportButton label={generateLabel} generating={generating} onClick={onGenerateLatest} />
        </div>
        {generateError && <p className="mt-2 text-xs text-destructive">{generateError}</p>}
      </div>
    )
  }

  return (
    <div>
      <div className="mb-3.5 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Reports are generated automatically after each {noun} {kind === "monthly" ? "ends" : "closes"}. You can also
          generate the latest closed {noun} manually.
        </p>
        <GenerateReportButton label={generateLabel} generating={generating} onClick={onGenerateLatest} />
      </div>
      {generateError && <p className="mb-3 text-xs text-destructive">{generateError}</p>}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {quarters.map((quarter) => {
          const existing = byQuarter.get(quarter)
          const completed = existing?.status === "COMPLETED" || quarter === SNAPSHOT_QUARTER
          const failed = existing?.status === "FAILED"
          return (
            <div key={quarter} className="rounded-xl border border-border bg-card p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[15px] font-medium text-foreground">{quarter}</span>
                {completed && <StatusBadge tone="success">Completed</StatusBadge>}
                {failed && <StatusBadge tone="danger">Failed</StatusBadge>}
              </div>
              {existing && quarter !== SNAPSHOT_QUARTER && (
                <p className="mb-3.5 text-xs text-muted-foreground">
                  Generated {new Date(existing.generatedAt).toLocaleDateString()}
                </p>
              )}
              {quarter === SNAPSHOT_QUARTER && (
                <p className="mb-3.5 text-xs text-muted-foreground">{SNAPSHOT_CAPTION}</p>
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
        {reportKindOf(quarter) === "monthly"
          ? "Monthly reports are generated automatically after each month ends. You can also generate this month's report manually."
          : "Quarterly reports are generated automatically after each quarter closes. You can also generate the latest closed quarter manually."}
      </p>
      <div className="mt-4 flex justify-center">
        <GenerateReportButton label={`Generate ${quarter}`} generating={generating} onClick={onGenerate} />
      </div>
      {generateError && <p className="mt-2 text-xs text-destructive">{generateError}</p>}
    </div>
  )
}
