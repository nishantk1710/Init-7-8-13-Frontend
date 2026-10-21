"use client"

// The Q2 2026 Quarterly Report, opened from the landing grid like any generated quarter and laid out the same
// way: a control bar (All quarters, status, Refresh, Download PDF), then the figures.
//
// Q2 is a fixed snapshot of the Inventory Planning Overview's own figures -- see utils/quarterly-snapshot.ts --
// so this page is the Overview as a report: the same four cards, the same four charts, and the Plant and
// Recommendation (OAR / Stock item) choices narrow all of them. Two tables sit under the charts, counted over
// the same recommendations as the Adopted card. Nothing is fetched: Refresh puts the choices back.

import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { FileBarChart, Loader2, RefreshCw } from "lucide-react"

import { ChartCard } from "@/components/shared/chart-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn, formatCount, formatIsoDateDMY } from "@/lib/utils"
import { sapPlantLabel } from "@/lib/shared-data/sap-plants"
import { ALL_FILTER } from "@/features/initiative-7/components/dashboard-filters"
import { InventoryPortfolioKpis } from "@/features/initiative-7/components/inventory-portfolio-kpis"
import { AdoptionRateCard, StockoutRiskDistribution } from "@/features/initiative-7/components/overview-widgets"
import { ExcessPositionCard, StockoutPositionCard } from "@/features/initiative-7/components/plant-position-cards"
import { QuarterlySnapshotPrintView } from "@/features/initiative-7/components/quarterly-snapshot-print-view"
import "@/features/initiative-7/components/report-print.css"
import {
  adoptionOf,
  findScope,
  loadQuarterlySnapshot,
  pageCount,
  pageOf,
  plantPositions,
  SNAPSHOT_TYPES,
  stockLevelRows,
  type QuarterlySnapshot,
  type SnapshotType,
} from "@/features/initiative-7/utils/quarterly-snapshot"
import { canGoNext, canGoPrevious, pagedFooterText } from "@/features/initiative-7/utils/paged-table-state"

const PAGE_SIZE = 5

/** The plants the Overview offers. The snapshot holds a scope for each. */
const PLANTS = ["1300", "1500"] as const

const CRITICALITY_TEXT: Record<string, string> = {
  CRITICAL: "text-destructive",
  IMPACT: "text-warning",
  INSURANCE: "text-primary",
  NORMAL: "text-muted-foreground",
  OBSOLETE: "text-muted-foreground",
}

const STATUS_TEXT: Record<string, string> = {
  "Pending Review": "text-warning",
  "In Approval": "text-warning",
  Approved: "text-success",
  Implemented: "text-success",
  Returned: "text-destructive",
  Rejected: "text-destructive",
}

const FILTER_SELECT = "h-8 w-48"

export function QuarterlySnapshotReport({ onBack }: { onBack: () => void }) {
  const [snapshot, setSnapshot] = useState<QuarterlySnapshot | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [plant, setPlant] = useState<string>(ALL_FILTER)
  const [type, setType] = useState<SnapshotType>("all")
  const [page, setPage] = useState(1)
  const [pdfState, setPdfState] = useState<"idle" | "preparing">("idle")
  const [pdfError, setPdfError] = useState<string | null>(null)
  const [printRequested, setPrintRequested] = useState(false)
  const printTimer = useRef<number | null>(null)

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

  const plantCode = plant === ALL_FILTER ? null : plant
  const scope = snapshot ? findScope(snapshot, plantCode, type) : undefined
  const positions = useMemo(
    () => (snapshot ? plantPositions(snapshot, type, plantCode) : []),
    [snapshot, type, plantCode],
  )
  const adoption = scope ? adoptionOf(scope.figures) : null
  const stockLevels = stockLevelRows(scope?.stock_levels ?? null)

  function handleRefresh() {
    setPlant(ALL_FILTER)
    setType("all")
    setPage(1)
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

  const materials = scope?.materials ?? null
  const pages = pageCount(materials?.length ?? 0, PAGE_SIZE)
  const pageRows = pageOf(materials ?? [], page, PAGE_SIZE)

  return (
    <div className="flex flex-col gap-4">
      {/* --- Controls: the same bar the generated reports have ------------------------------------- */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
        <Button size="sm" variant="ghost" onClick={onBack}>
          ← All quarters
        </Button>
        <span className="text-sm font-medium text-foreground">{snapshot?.quarter ?? "Q2 2026"}</span>
        <StatusBadge tone="success">COMPLETED</StatusBadge>
        {snapshot && (
          <span className="text-xs text-muted-foreground">
            {snapshot.period} · {snapshot.source}
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleRefresh} disabled={!snapshot}>
            <RefreshCw className="size-3.5" />
            Refresh
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
          {/* --- The Overview's filters ------------------------------------------------------------ */}
          <div className="flex flex-wrap items-end gap-4 rounded-xl border border-border bg-card p-3">
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase">Plant</span>
              <Select
                value={plant}
                onValueChange={(v) => {
                  setPlant(v ?? ALL_FILTER)
                  setPage(1)
                }}
              >
                <SelectTrigger className={FILTER_SELECT} aria-label="Plant">
                  <SelectValue placeholder="All">
                    {(v: string) => (v === ALL_FILTER ? "All" : sapPlantLabel(v))}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_FILTER}>All</SelectItem>
                  {PLANTS.map((code) => (
                    <SelectItem key={code} value={code}>
                      {sapPlantLabel(code)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase">
                Recommendation
              </span>
              <Select
                value={type}
                onValueChange={(v) => {
                  setType((v ?? "all") as SnapshotType)
                  setPage(1)
                }}
              >
                <SelectTrigger className={FILTER_SELECT} aria-label="Recommendation">
                  <SelectValue placeholder="All">
                    {(v: string) => SNAPSHOT_TYPES.find((t) => t.value === v)?.label ?? "All"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {SNAPSHOT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="min-w-[240px] flex-1 text-[11px] leading-relaxed text-muted-foreground">
              The Inventory Planning Overview&apos;s figures from the {snapshot.source}, captured{" "}
              {formatIsoDateDMY(snapshot.captured_at)}. Stockout risk is as of{" "}
              {scope?.figures.stockout_as_of ? formatIsoDateDMY(scope.figures.stockout_as_of) : "the last usage build"}
              ; every figure is the newest recommendation of each material-plant.
            </p>
          </div>

          {!scope ? (
            <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
              These figures were not captured for this selection.
            </div>
          ) : (
            <>
              {/* --- KPI row: the Overview's four cards ---------------------------------------------- */}
              <InventoryPortfolioKpis
                recommendations={[]}
                adoptedOverride={
                  adoption ? { count: adoption.adoptedCount, total: adoption.totalEvaluated } : null
                }
                adoptedUnavailable={adoption ? undefined : "not captured in this snapshot"}
                stockoutRiskOverride={{
                  count: scope.figures.stockout_at_risk,
                  total: scope.figures.stockout_evaluated,
                  insufficient: scope.figures.stockout_insufficient_data,
                  asOf: scope.figures.stockout_as_of,
                }}
                excessInventoryOverride={{
                  count: scope.figures.excess_count,
                  total: scope.figures.total,
                  opportunity: scope.figures.excess_opportunity,
                }}
                workingCapitalOverride={{ amount: scope.figures.net_rop_value_impact, currency: snapshot.currency }}
              />

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                <ChartCard
                  title="Stockout Risk Distribution"
                  subtitle="Fast and slow moving material-plants, by stock on hand against lead-time need."
                  span={6}
                >
                  <StockoutRiskDistribution
                    figures={{
                      atRisk: scope.figures.stockout_at_risk,
                      evaluated: scope.figures.stockout_evaluated,
                      insufficient: scope.figures.stockout_insufficient_data,
                      asOf: scope.figures.stockout_as_of,
                    }}
                  />
                </ChartCard>
                <ChartCard
                  title="Stockout risk by plant"
                  subtitle="Fast and slow moving material-plants short of their lead-time need."
                  span={6}
                >
                  <StockoutPositionCard state={{ positions, loading: false, error: null }} />
                </ChartCard>
                <ChartCard
                  title="Excess inventory by plant"
                  subtitle="Material-plants above their recommended maximum stock."
                  span={6}
                >
                  <ExcessPositionCard state={{ positions, loading: false, error: null }} />
                </ChartCard>
                <ChartCard
                  title="SAP adoption"
                  subtitle="Recommendations with a change to adopt, checked against SAP change history."
                  span={6}
                >
                  <AdoptionRateCard
                    summary={adoption}
                    plant={ALL_FILTER}
                    onPlantChange={() => {}}
                    showPlantPicker={false}
                    emptyMessage="Adoption was not captured in this snapshot."
                  />
                </ChartCard>

                <ChartCard
                  title="Current SAP vs I07 recommendation"
                  subtitle={
                    scope.stock_levels_count !== null
                      ? `Mean across the ${formatCount(scope.stock_levels_count)} recommendations with a change to adopt -- the same ones as the Adopted card.`
                      : "Mean across the recommendations with a change to adopt."
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
                        {stockLevels.map((level) => {
                          const flat = level.delta !== null && Math.abs(level.delta) < 0.05
                          return (
                            <TableRow key={level.key}>
                              <TableCell>
                                {level.label} <span className="text-xs text-muted-foreground">· {level.hint}</span>
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {level.current === null ? (
                                  <span className="text-muted-foreground">Not available</span>
                                ) : (
                                  level.current.toFixed(1)
                                )}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {level.recommended === null ? (
                                  <span className="text-muted-foreground">Not available</span>
                                ) : (
                                  level.recommended.toFixed(1)
                                )}
                              </TableCell>
                              <TableCell
                                className={cn(
                                  "text-right tabular-nums",
                                  level.delta === null || flat
                                    ? "text-muted-foreground"
                                    : level.delta > 0
                                      ? "text-warning"
                                      : "text-success",
                                )}
                              >
                                {level.delta === null ? "—" : flat ? "→" : `${level.delta > 0 ? "↑ +" : "↓ "}${level.delta.toFixed(1)}`}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </ChartCard>

                <ChartCard
                  title="Recommendations with a change to adopt"
                  subtitle={
                    materials && scope.materials_total !== null
                      ? `The newest ${formatCount(materials.length)} of ${formatCount(scope.materials_total)}.`
                      : "The newest recommendations with something to adopt."
                  }
                  span={12}
                >
                  {materials === null ? (
                    <p className="py-6 text-center text-xs text-muted-foreground">
                      The recommendations list was not captured in this snapshot.
                    </p>
                  ) : (
                    <>
                      <div className="overflow-x-auto rounded-lg border border-border">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/40 hover:bg-muted/40">
                              <TableHead>Material</TableHead>
                              <TableHead>Plant</TableHead>
                              <TableHead>Crit.</TableHead>
                              <TableHead>Demand pattern</TableHead>
                              <TableHead className="text-right">Reorder point</TableHead>
                              <TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {pageRows.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={6} className="py-6 text-muted-foreground">
                                  No recommendations with a change to adopt for this selection.
                                </TableCell>
                              </TableRow>
                            ) : (
                              pageRows.map((r, i) => (
                                <TableRow key={`${r.matnr}-${r.plant}-${i}`}>
                                  <TableCell>
                                    <div className="font-medium text-foreground">{r.desc}</div>
                                    <div className="text-xs tabular-nums text-muted-foreground">{r.matnr}</div>
                                  </TableCell>
                                  <TableCell className="text-muted-foreground">{sapPlantLabel(r.plant)}</TableCell>
                                  <TableCell>
                                    <span
                                      className={cn("text-xs font-medium", CRITICALITY_TEXT[r.crit] ?? "text-muted-foreground")}
                                    >
                                      {r.crit}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-muted-foreground">{r.pattern}</TableCell>
                                  <TableCell className="text-right font-mono text-[13px] tabular-nums">
                                    {r.rop_cur === null ? "—" : formatCount(r.rop_cur)} →{" "}
                                    {r.rop_rec === null ? "—" : formatCount(r.rop_rec)}
                                  </TableCell>
                                  <TableCell>
                                    <span
                                      className={cn("text-xs font-medium", STATUS_TEXT[r.status] ?? "text-muted-foreground")}
                                    >
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
                          {pagedFooterText({ loading: false, page, pageSize: PAGE_SIZE, total: materials.length })}
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
                            disabled={!canGoNext(false, page, PAGE_SIZE, materials.length)}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </ChartCard>
              </div>
            </>
          )}
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
