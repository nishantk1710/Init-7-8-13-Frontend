"use client"

import { useMemo, useState } from "react"
import { ArrowDown, ArrowUp, Minus } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ChartCard } from "@/components/shared/chart-card"
import { FilterBar } from "@/components/shared/filter-bar"
import { Input } from "@/components/ui/input"
import { MaterialIdentity } from "@/components/shared/material-identity"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { StatusBadge } from "@/components/shared/status-badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getPlantById, PLANTS } from "@/lib/shared-data/plants"
import { cn, formatCount } from "@/lib/utils"
import { CircuitExposureChart } from "@/features/initiative-7/components/circuit-exposure-chart"
import { ForecastVsActualChart } from "@/features/initiative-7/components/forecast-vs-actual-chart"
import { InventoryHealthCard } from "@/features/initiative-7/components/inventory-health-card"
import { InventoryPortfolioKpis } from "@/features/initiative-7/components/inventory-portfolio-kpis"
import { RecommendationStatusChart } from "@/features/initiative-7/components/recommendation-status-chart"
import { TrendLineChart } from "@/features/initiative-7/components/trend-line-chart"
import { RECOMMENDATIONS } from "@/features/initiative-7/data/recommendations"
import { STOCKOUT_RISK_TREND } from "@/features/initiative-7/data/monitoring-series"
import { formatSignedZAR } from "@/features/initiative-7/utils/inventory-calc"
import type { Recommendation, StockParameters } from "@/features/initiative-7/types/inventory"

// Every figure on this page derives from the same local RECOMMENDATIONS mock
// dataset the rest of Initiative 7 already uses — no SAP/backend calls, no
// live selectors. This is a demo/mockup composition, not the production
// reporting page: it shows every section fully populated rather than the
// "Not configured" states the real report renders until the underlying
// policies (excess-inventory threshold, holding-cost rate, SAP adoption
// staging) are actually confirmed.

const STOCK_ROWS: { key: keyof StockParameters; label: string; hint: string }[] = [
  { key: "safetyStock", label: "Safety stock", hint: "demand buffer" },
  { key: "rop", label: "Reorder point", hint: "when to raise a PO" },
  { key: "maxStock", label: "Maximum stock", hint: "ceiling to hold" },
]

function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

function StockLevelRow({
  label,
  hint,
  current,
  recommended,
}: {
  label: string
  hint: string
  current: number
  recommended: number
}) {
  const delta = recommended - current
  const DeltaIcon = delta > 0 ? ArrowUp : delta < 0 ? ArrowDown : Minus
  const tone = delta > 0 ? "text-warning" : delta < 0 ? "text-success" : "text-muted-foreground"

  return (
    <TableRow>
      <TableCell>
        <span className="font-medium text-foreground">{label}</span>{" "}
        <span className="text-xs text-muted-foreground">· {hint}</span>
      </TableCell>
      <TableCell className="text-right tabular-nums">{current.toFixed(1)}</TableCell>
      <TableCell className="text-right tabular-nums">{recommended.toFixed(1)}</TableCell>
      <TableCell className={cn("text-right tabular-nums font-medium", tone)}>
        <span className="inline-flex items-center gap-1 justify-end">
          <DeltaIcon className="size-3.5 shrink-0" />
          {delta === 0 ? "no change" : `${delta > 0 ? "+" : ""}${delta.toFixed(1)}`}
        </span>
      </TableCell>
    </TableRow>
  )
}

const ALL_PLANTS = "all"
const PAGE_SIZE = 5

/** Current-vs-recommended stock levels — Stock level / Current / Recommended
 * / Change only. The material search + plant select narrow which
 * recommendations the mean is computed over (defaults to the full in-scope
 * set), rather than adding Material/Plant as table columns. */
function StockLevelComparisonTable({ recommendations }: { recommendations: Recommendation[] }) {
  const [materialQuery, setMaterialQuery] = useState("")
  const [plant, setPlant] = useState<string>(ALL_PLANTS)

  const filtered = useMemo(() => {
    const query = materialQuery.trim().toLowerCase()
    return recommendations.filter((r) => {
      if (plant !== ALL_PLANTS && r.plantId !== plant) return false
      if (query) {
        const haystack = `${r.material.materialId} ${r.material.description}`.toLowerCase()
        if (!haystack.includes(query)) return false
      }
      return true
    })
  }, [recommendations, materialQuery, plant])

  return (
    <div className="flex flex-col gap-3">
      <FilterBar>
        <Input
          placeholder="Filter by material…"
          value={materialQuery}
          onChange={(e) => setMaterialQuery(e.target.value)}
          className="h-8 w-full sm:w-56"
        />
        <Select value={plant} onValueChange={(v) => setPlant(v ?? ALL_PLANTS)}>
          <SelectTrigger className="h-8 w-full sm:w-44">
            <SelectValue placeholder="Plant">
              {(v: string) => (v === ALL_PLANTS ? "All plants" : (getPlantById(v)?.name ?? v))}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_PLANTS}>All plants</SelectItem>
            {PLANTS.map((p) => (
              <SelectItem key={p.plantId} value={p.plantId}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterBar>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No material-plants match this filter.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
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
              {STOCK_ROWS.map((row) => (
                <StockLevelRow
                  key={row.key}
                  label={row.label}
                  hint={row.hint}
                  current={mean(filtered.map((r) => r.current[row.key]))}
                  recommended={mean(filtered.map((r) => r.recommended[row.key]))}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

function TopReorderChangesTable({ recommendations }: { recommendations: Recommendation[] }) {
  const ranked = useMemo(
    () =>
      [...recommendations].sort(
        (a, b) => Math.abs(b.recommended.rop - b.current.rop) - Math.abs(a.recommended.rop - a.current.rop)
      ),
    [recommendations]
  )

  const [page, setPage] = useState(0)
  const pageCount = Math.max(1, Math.ceil(ranked.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount - 1)
  const pageRows = ranked.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE)
  const rangeStart = ranked.length === 0 ? 0 : currentPage * PAGE_SIZE + 1
  const rangeEnd = Math.min(ranked.length, currentPage * PAGE_SIZE + PAGE_SIZE)

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Material</TableHead>
              <TableHead>Plant</TableHead>
              <TableHead>Circuit</TableHead>
              <TableHead>Crit.</TableHead>
              <TableHead>Demand pattern</TableHead>
              <TableHead className="text-center">Recommended ROP</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <MaterialIdentity material={r.material} />
                </TableCell>
                <TableCell className="text-muted-foreground">{getPlantById(r.plantId)?.name ?? r.plantId}</TableCell>
                <TableCell className="text-muted-foreground">{r.circuit}</TableCell>
                <TableCell>
                  <Badge variant="outline">{r.criticality.toUpperCase()}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{r.demandPattern}</TableCell>
                <TableCell className="text-center tabular-nums">
                  {r.current.rop} → {r.recommended.rop}
                </TableCell>
                <TableCell>
                  <StatusBadge
                    tone={
                      r.status === "Approved" || r.status === "Implemented"
                        ? "success"
                        : r.status === "Rejected"
                          ? "danger"
                          : r.status === "In Approval" || r.status === "Returned"
                            ? "warning"
                            : "default"
                    }
                  >
                    {r.status}
                  </StatusBadge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">
          Showing {rangeStart}–{rangeEnd} of {formatCount(ranked.length)}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={currentPage === 0}
          >
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {currentPage + 1} of {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={currentPage >= pageCount - 1}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}

const CRITICALITY_TIERS: {
  label: string
  count: number
  hint: string
  toneClass: string
}[] = [
  { label: "CRITICAL", count: 142, hint: "Line-stopping if unavailable", toneClass: "border-destructive/25 bg-destructive/5 text-destructive" },
  { label: "IMPACT", count: 389, hint: "Some operational impact", toneClass: "border-warning/25 bg-warning/5 text-warning" },
  { label: "INSURANCE", count: 96, hint: "Held for insurance/cover", toneClass: "border-primary/25 bg-primary/5 text-primary" },
  { label: "NORMAL", count: 1847, hint: "Standard replenishment", toneClass: "border-border bg-muted/20 text-foreground" },
  { label: "OBSOLETE", count: 211, hint: "Marked for retirement", toneClass: "border-border bg-muted/10 text-muted-foreground" },
]

/** ZMM065 material-criticality tier breakdown — a report-specific rollup, not
 * the per-recommendation `Criticality` risk weighting used elsewhere in I07.
 * Dummy counts for this demo; the real report would source these from the
 * ZMM065 extract once the normalise layer exists (see CLAUDE.md). */
function MaterialCriticalityPanel() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {CRITICALITY_TIERS.map((tier) => (
        <div key={tier.label} className={cn("rounded-xl border p-3.5", tier.toneClass)}>
          <div className="text-[11px] font-semibold tracking-[0.5px] uppercase">{tier.label}</div>
          <div className="mt-1 text-2xl font-bold tabular-nums">{formatCount(tier.count)}</div>
          <div className="mt-0.5 text-[11px] opacity-80">{tier.hint}</div>
        </div>
      ))}
    </div>
  )
}

const ADOPTION_ROWS: { label: string; count: number; tone: "success" | "warning" | "danger" }[] = [
  { label: "Adopted", count: 65, tone: "success" },
  { label: "Partial", count: 18, tone: "warning" },
  { label: "Not adopted", count: 13, tone: "danger" },
]

const ADOPTION_TONE_CLASS: Record<string, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
}

function SapAdoptionPanel() {
  const total = ADOPTION_ROWS.reduce((sum, r) => sum + r.count, 0)
  const adoptedPct = Math.round((ADOPTION_ROWS[0].count / total) * 100)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <div className="flex h-[110px] w-[110px] shrink-0 items-center justify-center rounded-full border-[10px] border-success/20">
          <div className="text-center">
            <div className="text-2xl font-bold tabular-nums text-success">{adoptedPct}%</div>
            <div className="text-[11px] text-muted-foreground">adopted</div>
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-2">
          {ADOPTION_ROWS.map((row) => (
            <div key={row.label} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 font-medium text-foreground">
                <span className={cn("size-2.5 shrink-0 rounded-full", ADOPTION_TONE_CLASS[row.tone])} />
                {row.label}
              </span>
              <span className="tabular-nums text-muted-foreground">{row.count}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-dashed border-border pt-3 text-[11px] text-muted-foreground">
        Measured against CDHDR/CDPOS change documents — a match within 14 days of approval counts as adopted.
        Of {total} implemented recommendations this quarter, {ADOPTION_ROWS[0].count} show a matching SAP change
        document, {ADOPTION_ROWS[1].count} are partial (only some fields changed), and {ADOPTION_ROWS[2].count} show
        no matching change document.
      </div>
    </div>
  )
}

/** Demo/mockup Quarterly Reports workspace — every section fully populated
 * from the local RECOMMENDATIONS mock dataset, styled to match the rest of
 * Initiative 7. See file header for why this exists alongside the real,
 * live-data-driven quarterly report. */
export function QuarterlyReportsDemoWorkspace() {
  const recommendations = RECOMMENDATIONS

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-foreground">Q2 2026</span>
          <StatusBadge tone="success">Completed</StatusBadge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            Refresh
          </Button>
          <Button size="sm">Download detail Excel</Button>
        </div>
      </div>

      <InventoryPortfolioKpis recommendations={recommendations} />

      <ChartCard title="Material criticality" subtitle="In-scope materials by ZMM065 tier.">
        <MaterialCriticalityPanel />
      </ChartCard>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <ChartCard title="Stockout risk distribution" span={4}>
          <InventoryHealthCard recommendations={recommendations} />
        </ChartCard>
        <ChartCard
          title="Recommendation status"
          subtitle="Where each change sits in the approval flow."
          span={8}
        >
          <RecommendationStatusChart recommendations={recommendations} />
        </ChartCard>

        <ChartCard
          title="Current SAP vs I07 recommendation"
          subtitle="Mean across in-scope material-plants generated this quarter."
          span={12}
        >
          <StockLevelComparisonTable recommendations={recommendations} />
        </ChartCard>

        <ChartCard
          title="Materials — top reorder changes"
          subtitle={`Showing ${Math.min(5, recommendations.length)} of ${formatCount(recommendations.length)}. Full list in the Excel export.`}
          span={12}
        >
          <TopReorderChangesTable recommendations={recommendations} />
        </ChartCard>

        <ChartCard
          title="Critical circuit exposure"
          subtitle="Recommendations per circuit, split by stockout-risk exposure."
          span={7}
        >
          <CircuitExposureChart recommendations={recommendations} />
        </ChartCard>

        <ChartCard title="Stockout risk trend" subtitle="Materials at high/critical risk, by month." span={5}>
          <TrendLineChart data={STOCKOUT_RISK_TREND} color="var(--destructive)" />
        </ChartCard>

        <ChartCard
          title="Forecast vs Actual Demand"
          span={7}
          footnote={`Actual = consumption for the ${recommendations.length} material(s) in view. Forecast = one-step-ahead exponential smoothing on that same series, so each point uses only prior months.`}
        >
          <ForecastVsActualChart recommendations={recommendations} />
        </ChartCard>

        <ChartCard title="SAP adoption" subtitle="Whether approved recommendations were applied in SAP." span={5}>
          <SapAdoptionPanel />
        </ChartCard>
      </div>

      <div className="text-[11px] text-muted-foreground">
        Net working-capital impact this quarter: {formatSignedZAR(recommendations.reduce((sum, r) => sum + r.workingCapitalImpact, 0))}
      </div>
    </div>
  )
}
