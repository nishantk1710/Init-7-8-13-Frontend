"use client"

// The Q2 2026 Quarterly Report, opened from the landing grid like any generated quarter and laid out the same
// way: a control bar (All quarters, status, Refresh, Download PDF), a KPI row, then the charts and tables.
//
// Q2 is a fixed snapshot rather than a generated report -- see utils/quarterly-snapshot.ts. It carries the
// quarter's own figures, so there is nothing to refetch: Refresh clears the filters and returns to the first
// page, exactly as the report this was built from did.
//
// The risk and status charts are clickable. Clicking a segment filters the materials table below it (and the
// Current vs Recommended means above it); clicking it again clears the filter. A status with none is shown
// but not clickable, since there is nothing to filter to.

import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import {
  AlertTriangle,
  Boxes,
  Clock,
  Download,
  FileBarChart,
  Loader2,
  RefreshCw,
  TrendingUp,
  X,
} from "lucide-react"
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts"

import { ChartCard } from "@/components/shared/chart-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn, formatCount } from "@/lib/utils"
import { DonutWithLegend, type DonutSlice } from "@/features/initiative-7/components/donut-with-legend"
import { KpiCard } from "@/features/initiative-7/components/report-kpi-card"
import { QuarterlySnapshotPrintView } from "@/features/initiative-7/components/quarterly-snapshot-print-view"
import "@/features/initiative-7/components/report-print.css"
import {
  ADOPTION_ZERO,
  csvFileName,
  displayStatusCounts,
  EMPTY_FILTER,
  filterMaterials,
  formatPercent,
  formatZar,
  loadQuarterlySnapshot,
  materialsCsv,
  meanParams,
  pageCount,
  PROVENANCE_LABEL,
  pageOf,
  provenanceItems,
  riskDistribution,
  toggled,
  type QuarterlySnapshot,
  type SnapshotFilter,
} from "@/features/initiative-7/utils/quarterly-snapshot"
import {
  canGoNext,
  canGoPrevious,
  pagedFooterText,
} from "@/features/initiative-7/utils/paged-table-state"

const PAGE_SIZE = 5

const STATUS_COLOR: Record<string, string> = {
  "Pending Review": "var(--chart-4)",
  Approved: "var(--chart-3)",
  Implemented: "var(--chart-5)",
  Returned: "var(--warning)",
  Rejected: "var(--destructive)",
}

const RISK_COLOR: Record<string, string> = {
  Critical: "var(--destructive)",
  High: "color-mix(in oklch, var(--warning) 40%, var(--destructive) 60%)",
  Medium: "var(--warning)",
  Low: "var(--success)",
}

const CRITICALITY_TEXT: Record<string, string> = {
  CRITICAL: "text-destructive",
  IMPACT: "text-warning",
  INSURANCE: "text-primary",
  NORMAL: "text-muted-foreground",
  OBSOLETE: "text-muted-foreground",
}

const STATUS_TEXT: Record<string, string> = {
  "Pending Review": "text-warning",
  Approved: "text-success",
  Implemented: "text-success",
  Returned: "text-destructive",
  Rejected: "text-destructive",
}

const ACTUAL_COLOR = "var(--chart-3)"
const FORECAST_COLOR = "var(--chart-1)"

// --- Charts --------------------------------------------------------------------------------------------

/** The stockout-risk bar and its legend. Every segment and every legend row selects that risk level. */
function RiskDistributionChart({
  risk,
  active,
  onSelect,
}: {
  risk: Record<string, number>
  active: string
  onSelect: (level: string) => void
}) {
  const dist = riskDistribution(risk)
  return (
    <div className="flex items-stretch gap-4">
      <div className="flex h-[140px] w-4 shrink-0 flex-col overflow-hidden rounded">
        {dist.map((d) => (
          <button
            key={d.level}
            type="button"
            aria-label={`Show ${d.level} risk materials`}
            aria-pressed={active === d.level}
            disabled={d.count === 0}
            onClick={() => onSelect(d.level)}
            className={cn("min-h-[3px] transition-opacity", d.count > 0 && "cursor-pointer", active && active !== d.level && "opacity-30")}
            style={{ backgroundColor: RISK_COLOR[d.level], flex: Math.max(d.count, 0.001) }}
          />
        ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
        {dist.map((d) => (
          <button
            key={d.level}
            type="button"
            aria-pressed={active === d.level}
            disabled={d.count === 0}
            onClick={() => onSelect(d.level)}
            className={cn(
              "flex items-center justify-between gap-3 rounded-md px-1 py-0.5 text-sm transition-colors",
              d.count > 0 && "cursor-pointer hover:bg-muted/50",
              active && active !== d.level && "opacity-40",
            )}
          >
            <span className="flex min-w-0 items-center gap-2 text-foreground">
              <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: RISK_COLOR[d.level] }} />
              {d.level}
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {formatCount(d.count)} ({d.share.toFixed(1)}%)
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

/** The adoption donut at 0: an empty ring, since there is no slice to draw, and the three counts beside it. */
function AdoptionChart() {
  return (
    <div className="flex flex-wrap items-center gap-5">
      <svg width="120" height="120" viewBox="0 0 120 120" role="img" aria-label="SAP adoption, 0% adopted">
        <circle cx="60" cy="60" r="54" fill="none" stroke="var(--muted)" strokeWidth="12" />
        <text x="60" y="60" textAnchor="middle" fontSize="18" fontWeight="600" fill="var(--foreground)">
          0%
        </text>
        <text x="60" y="76" textAnchor="middle" fontSize="10" fill="var(--muted-foreground)">
          adopted
        </text>
      </svg>
      <div className="flex min-w-[170px] flex-1 flex-col gap-2">
        {ADOPTION_ZERO.map((a, i) => (
          <div key={a.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 text-foreground">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: ["var(--chart-3)", "var(--warning)", "var(--destructive)"][i] }}
              />
              {a.label}
            </span>
            <span className="tabular-nums text-muted-foreground">{formatCount(a.count)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function LineTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="font-medium text-foreground">{label}</div>
      {payload.map((entry) => (
        <div key={entry.name} className="mt-1 flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-3 shrink-0" style={{ backgroundColor: String(entry.color) }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium text-foreground">
            {typeof entry.value === "number" ? formatCount(Math.round(entry.value)) : entry.value}
          </span>
        </div>
      ))}
    </div>
  )
}

function TrendChart({ points }: { points: { month: string; value: number }[] }) {
  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="month" stroke="var(--muted-foreground)" tickLine={false} axisLine={false} fontSize={11} />
          <YAxis
            stroke="var(--muted-foreground)"
            tickLine={false}
            axisLine={false}
            fontSize={11}
            width={40}
            allowDecimals={false}
            domain={[0, "auto"]}
          />
          <Tooltip content={LineTooltip} cursor={{ stroke: "var(--border)" }} />
          <Line
            type="monotone"
            dataKey="value"
            name="At high/critical risk"
            stroke="var(--destructive)"
            strokeWidth={2}
            dot={{ r: 3, strokeWidth: 2, stroke: "var(--card)", fill: "var(--destructive)" }}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function ForecastChart({ points }: { points: { month: string; actual: number; forecast: number }[] }) {
  return (
    <>
      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="month" stroke="var(--muted-foreground)" tickLine={false} axisLine={false} fontSize={11} />
            <YAxis
              stroke="var(--muted-foreground)"
              tickLine={false}
              axisLine={false}
              fontSize={11}
              width={48}
              allowDecimals={false}
              domain={[0, "auto"]}
              tickFormatter={(value: number) => formatCount(Math.round(value))}
            />
            <Tooltip content={LineTooltip} cursor={{ stroke: "var(--border)" }} />
            <Line
              type="monotone"
              dataKey="actual"
              name="Actual"
              stroke={ACTUAL_COLOR}
              strokeWidth={2}
              dot={{ r: 3, strokeWidth: 2, stroke: "var(--card)", fill: ACTUAL_COLOR }}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="forecast"
              name="Forecast"
              stroke={FORECAST_COLOR}
              strokeWidth={2}
              strokeDasharray="4 3"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex items-center justify-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-3 shrink-0" style={{ backgroundColor: ACTUAL_COLOR }} />
          Actual
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3 shrink-0 border-t-2 border-dashed" style={{ borderColor: FORECAST_COLOR }} />
          Forecast
        </div>
      </div>
    </>
  )
}

// --- Where the numbers come from -----------------------------------------------------------------------

// --- The report ----------------------------------------------------------------------------------------

export function QuarterlySnapshotReport({ onBack }: { onBack: () => void }) {
  const [snapshot, setSnapshot] = useState<QuarterlySnapshot | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [filter, setFilter] = useState<SnapshotFilter>(EMPTY_FILTER)
  const [page, setPage] = useState(1)
  const [pdfState, setPdfState] = useState<"idle" | "preparing">("idle")
  const [pdfError, setPdfError] = useState<string | null>(null)
  const [printRequested, setPrintRequested] = useState(false)
  const materialsRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let cancelled = false
    loadQuarterlySnapshot()
      .then((data) => {
        if (!cancelled) setSnapshot(data)
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Could not load the Q2 report.")
      })
    return () => {
      cancelled = true
    }
  }, [])

  const rows = useMemo(() => (snapshot ? filterMaterials(snapshot.materials, filter) : []), [snapshot, filter])
  const params = useMemo(() => meanParams(rows.length ? rows : (snapshot?.materials ?? [])), [rows, snapshot])
  const statusSlices: DonutSlice[] = useMemo(
    () =>
      displayStatusCounts(snapshot?.status ?? {}).map((s) => ({
        label: s.status,
        count: s.count,
        color: STATUS_COLOR[s.status],
      })),
    [snapshot],
  )

  function update(next: Partial<SnapshotFilter>) {
    setFilter((f) => ({ ...f, ...next }))
    setPage(1)
  }

  /** A chart was clicked: filter the table, and bring the table into view since it sits below the charts. */
  function selectFromChart(next: Partial<SnapshotFilter>) {
    update(next)
    materialsRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
  }

  function handleRefresh() {
    setFilter(EMPTY_FILTER)
    setPage(1)
  }

  function handleDownloadCsv() {
    if (!snapshot) return
    const blob = new Blob(["﻿" + materialsCsv(rows.length ? rows : snapshot.materials)], {
      type: "text/csv;charset=utf-8",
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = csvFileName(snapshot.quarter)
    link.click()
    URL.revokeObjectURL(url)
  }

  /** Download PDF -- the browser prints the report. Only requests the print; the effect below opens the dialog
   * once the print view is in the DOM and the fonts are ready, so the PDF is never printed half-drawn. */
  function handleDownloadPdf() {
    if (!snapshot || pdfState === "preparing") return
    setPdfError(null)
    setPdfState("preparing")
    setPrintRequested(true)
  }

  useEffect(() => {
    if (!printRequested || !snapshot) return
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
        // Clear the request before print(): print() blocks on the dialog, and a flag left set would re-enter.
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
  }, [printRequested, snapshot])

  const pages = pageCount(rows.length, PAGE_SIZE)
  const pageRows = pageOf(rows, page, PAGE_SIZE)
  const chartFilterActive = Boolean(filter.risk || filter.status)

  return (
    <div className="flex flex-col gap-4">
      {/* --- Controls: the same bar the generated reports have ------------------------------------- */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
        <Button size="sm" variant="ghost" onClick={onBack}>
          ← All quarters
        </Button>
        <span className="text-sm font-medium text-foreground">{snapshot?.quarter ?? "Q2 2026"}</span>
        <StatusBadge tone="success">COMPLETED</StatusBadge>
        {snapshot && <span className="text-xs text-muted-foreground">{snapshot.period} · {snapshot.snapshot}</span>}

        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleRefresh} disabled={!snapshot}>
            <RefreshCw className="size-3.5" />
            Refresh
          </Button>
          <Button size="sm" variant="outline" onClick={handleDownloadCsv} disabled={!snapshot}>
            <Download className="size-3.5" />
            Download detail (CSV)
          </Button>
          <Button size="sm" onClick={handleDownloadPdf} disabled={!snapshot || pdfState === "preparing"}>
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

      {loadError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-sm text-destructive">
          {loadError}
        </div>
      )}

      {!snapshot && !loadError && (
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">Loading report…</div>
      )}

      {snapshot && (
        <>
          {/* --- KPI row ------------------------------------------------------------------------- */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Critical stockout risk"
              icon={<AlertTriangle className="size-4 text-destructive" />}
              value={formatCount(snapshot.risk_recs.Critical ?? 0)}
              sublabel="materials"
              footnote={`${formatPercent(snapshot.risk_recs.Critical ?? 0, snapshot.recs)} of recommendations`}
              footnoteTone="destructive"
            />
            <KpiCard
              label="Excess inventory candidates"
              icon={<Boxes className="size-4 text-primary" />}
              value={formatCount(snapshot.excess_n)}
              sublabel="materials"
              footnote={`${formatZar(snapshot.excess_val)} tied up · ${formatPercent(snapshot.excess_n, snapshot.inscope)} of in-scope`}
            />
            <KpiCard
              label="Working capital impact"
              icon={<TrendingUp className="size-4 text-success" />}
              value={formatZar(snapshot.wc_recs)}
              sublabel="net across recommendations"
              footnote={snapshot.wc_recs < 0 ? "Net release" : "Net additional investment"}
              footnoteTone={snapshot.wc_recs < 0 ? "success" : "warning"}
            />
            <KpiCard
              label="Pending approval"
              icon={<Clock className="size-4 text-warning" />}
              value={formatCount(snapshot.status["Pending Review"] ?? 0)}
              sublabel="Recommendations"
              footnote={`${formatPercent(snapshot.status["Pending Review"] ?? 0, snapshot.recs)} of recommendations`}
              footnoteTone="warning"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <ChartCard
              title="Stockout risk distribution"
              subtitle="Across this quarter's recommendations. Click a level to filter the materials below."
              span={4}
            >
              <RiskDistributionChart
                risk={snapshot.risk_recs}
                active={filter.risk}
                onSelect={(level) => selectFromChart({ risk: toggled(filter.risk, level) })}
              />
            </ChartCard>

            <ChartCard
              title="Recommendation status"
              subtitle="Where each change sits in the approval flow. Click a status to filter the materials below."
              span={8}
            >
              <DonutWithLegend
                slices={statusSlices}
                activeLabel={filter.status || null}
                onSliceClick={(label) => {
                  const slice = statusSlices.find((s) => s.label === label)
                  if (!slice || slice.count === 0) return
                  selectFromChart({ status: toggled(filter.status, label) })
                }}
              />
            </ChartCard>

            <ChartCard
              title="Current SAP vs I07 recommendation"
              subtitle={
                rows.length === snapshot.materials.length
                  ? "Mean across in-scope material–plants generated this quarter."
                  : `Mean across the ${formatCount(rows.length)} recommendations in view.`
              }
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
                    {params.map((p) => {
                      const flat = Math.abs(p.delta) < 0.05
                      return (
                        <TableRow key={p.key}>
                          <TableCell>
                            {p.label} <span className="text-xs text-muted-foreground">· {p.hint}</span>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{p.current.toFixed(1)}</TableCell>
                          <TableCell className="text-right tabular-nums">{p.recommended.toFixed(1)}</TableCell>
                          <TableCell
                            className={cn(
                              "text-right tabular-nums",
                              flat ? "text-muted-foreground" : p.delta > 0 ? "text-warning" : "text-success",
                            )}
                          >
                            {flat ? "→" : p.delta > 0 ? "↑ +" : "↓ "}
                            {flat ? "" : p.delta.toFixed(1)}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </ChartCard>

            <div ref={materialsRef} className="scroll-mt-4 lg:col-span-12">
              <ChartCard
                title="Materials — top reorder changes"
                subtitle={`Ranked by stockout risk, then working-capital impact. ${formatCount(rows.length)} recommendation${rows.length === 1 ? "" : "s"} in view; the full list is in the CSV download.`}
                span={12}
              >
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Input
                    value={filter.query}
                    onChange={(e) => update({ query: e.target.value })}
                    placeholder="Filter by material…"
                    aria-label="Filter by material"
                    className="max-w-[220px]"
                  />
                  <select
                    value={filter.plant}
                    onChange={(e) => update({ plant: e.target.value })}
                    aria-label="Filter by plant"
                    className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                  >
                    <option value="">All plants</option>
                    {snapshot.plants.map((p) => (
                      <option key={p.code} value={p.name}>
                        {p.name} ({p.code})
                      </option>
                    ))}
                  </select>
                  {filter.risk && (
                    <FilterChip label={`${filter.risk} risk`} onClear={() => update({ risk: "" })} />
                  )}
                  {filter.status && (
                    <FilterChip label={filter.status} onClear={() => update({ status: "" })} />
                  )}
                  {chartFilterActive && (
                    <button
                      type="button"
                      onClick={() => update({ risk: "", status: "" })}
                      className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                    >
                      Clear chart filters
                    </button>
                  )}
                </div>

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
                      {pageRows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="py-6 text-muted-foreground">
                            No materials match this filter. Clear the filters or pick another plant.
                          </TableCell>
                        </TableRow>
                      ) : (
                        pageRows.map((r, i) => (
                          <TableRow key={`${r.matnr}-${r.plant}-${i}`}>
                            <TableCell>
                              <div className="font-medium text-foreground">{r.desc}</div>
                              <div className="text-xs tabular-nums text-muted-foreground">{r.matnr}</div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{r.plant}</TableCell>
                            <TableCell className="text-muted-foreground">{r.circuit}</TableCell>
                            <TableCell>
                              <span className={cn("text-xs font-medium", CRITICALITY_TEXT[r.crit] ?? "text-muted-foreground")}>
                                {r.crit}
                              </span>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{r.pattern}</TableCell>
                            <TableCell className="text-right font-mono text-[13px] tabular-nums">
                              {formatCount(r.rop_cur)} → {formatCount(r.rop_rec)}
                            </TableCell>
                            <TableCell>
                              <span className={cn("text-xs font-medium", STATUS_TEXT[r.status] ?? "text-muted-foreground")}>
                                {r.status}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="text-xs text-muted-foreground" aria-live="polite">
                    {pagedFooterText({ loading: false, page, pageSize: PAGE_SIZE, total: rows.length })}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={!canGoPrevious(false, page)}
                    >
                      Previous
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      Page {formatCount(page)} of {formatCount(pages)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => p + 1)}
                      disabled={!canGoNext(false, page, PAGE_SIZE, rows.length)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </ChartCard>
            </div>

            <ChartCard title="Stockout risk trend" subtitle="Materials at high/critical risk, by month." span={12}>
              <TrendChart points={snapshot.trend.map((t) => ({ month: t.m, value: t.v }))} />
            </ChartCard>

            <ChartCard
              title="Forecast vs Actual Demand"
              subtitle="Consumption across the recommendation set."
              span={7}
              footnote={`Actual = consumption across the ${formatCount(snapshot.recs)} materials in the recommendation set. Forecast = one-step-ahead exponential smoothing (α = 0.3) on that same series, so each point uses only prior months.`}
            >
              <ForecastChart points={snapshot.fa.map((p) => ({ month: p.m, actual: p.a, forecast: p.f }))} />
            </ChartCard>

            <ChartCard title="SAP adoption" subtitle="Whether approved recommendations were applied in SAP." span={5}>
              <AdoptionChart />
              <p className="mt-3 border-t border-dashed border-border pt-2 text-[11px] leading-relaxed text-muted-foreground">
                No recommendation has been applied in SAP yet, so every value is 0. The adoption check compares
                against CDHDR/CDPOS change documents, but the CDPOS extract contains no MARC rows, so
                EISBE/MINBE/MABST changes cannot be traced. For reference, {formatCount(snapshot.sap_touched)} of
                the {formatCount(snapshot.recs)} recommended materials had a material-master change document in the
                quarter, and change-document coverage ends {snapshot.cd_coverage}.
              </p>
            </ChartCard>
          </div>

          <p className="text-xs text-muted-foreground">
            Net working-capital impact this quarter: <b className="text-foreground">{formatZar(snapshot.wc_recs)}</b>{" "}
            across the recommendation set. Across all {formatCount(snapshot.inscope)} in-scope materials, including
            excess release, the net is <b className="text-foreground">{formatZar(snapshot.wc_inscope)}</b> against{" "}
            {formatZar(snapshot.inv_value)} of spares inventory on hand.
          </p>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-sm font-medium text-foreground">Where these numbers come from</div>
            <p className="mt-0.5 text-xs text-muted-foreground">Read this before the report leaves the room.</p>
            <ul className="mt-3 flex flex-col gap-2 text-xs text-foreground">
              {provenanceItems(snapshot).map((item, i) => (
                <li key={i} className="flex gap-2">
                  <span
                    className={cn(
                      "mt-px h-fit shrink-0 rounded px-1.5 py-0.5 text-[9.5px] font-semibold tracking-wide",
                      item.tag === "real" ? "bg-success/15 text-success" : "bg-destructive/10 text-destructive",
                    )}
                  >
                    {PROVENANCE_LABEL[item.tag]}
                  </span>
                  <span>{item.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {/* Portalled to <body>: the print stylesheet hides `body > *` and re-shows only `.print-portal`. Mounted
        * only once a print is requested, so an ordinary page view does not render the report twice. */}
      {printRequested &&
        snapshot &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="print-portal">
            <QuarterlySnapshotPrintView snapshot={snapshot} />
          </div>,
          document.body,
        )}
    </div>
  )
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-primary bg-primary/10 px-2 py-1 text-xs font-medium text-foreground">
      {label}
      <button type="button" onClick={onClear} aria-label={`Clear ${label} filter`} className="rounded hover:bg-muted">
        <X className="size-3" />
      </button>
    </span>
  )
}
