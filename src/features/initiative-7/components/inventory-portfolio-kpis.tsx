import type { ReactNode } from "react"
import { AlertTriangle, Clock, Layers, Wallet } from "lucide-react"

import { cn, formatCount } from "@/lib/utils"
import { RECOMMENDATIONS } from "@/features/initiative-7/data/recommendations"
import type { Recommendation } from "@/features/initiative-7/types/inventory"
import {
  countAtStockoutRisk,
  countAwaitingApproval,
  countExcessCandidates,
  netWorkingCapitalImpact,
} from "@/features/initiative-7/utils/inventory-calc"

type Tone = "info" | "success" | "warning" | "danger"

const VALUE_TONE: Record<Tone, string> = {
  info: "text-primary",
  success: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
}

const ICON_TONE: Record<Tone, string> = {
  info: "bg-primary/15 text-primary",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  danger: "bg-destructive/10 text-destructive",
}

function pct(part: number, whole: number): string {
  if (whole === 0) return "0.0"
  const value = (part / whole) * 100
  // A real, non-zero share can round to "0.0" at one decimal place once the
  // portfolio is large enough (e.g. 39 / 113,465 = 0.03%) -- misleadingly
  // reading as "none" when the count above it is not. Show two decimals
  // only in that narrow band, so a genuine zero still reads as "0.0" and an
  // ordinary share (>= 0.1%) keeps the original one-decimal display.
  if (value > 0 && value < 0.1) return value.toFixed(2)
  return value.toFixed(1)
}

/** Compact signed ZAR in millions, e.g. -1048500 -> "−R 1.05M". */
function formatCompactSignedZAR(amount: number): string {
  const sign = amount < 0 ? "−" : amount > 0 ? "+" : ""
  const millions = Math.abs(amount) / 1_000_000
  return `${sign}R ${millions.toFixed(2)}M`
}

/**
 * One portfolio KPI tile — title + icon badge on top, then the headline value
 * with an inline unit label sharing its baseline, then a caption line below.
 * The caption is coloured to match the value's tone unless `captionMuted` is
 * set, for a plain descriptive caption rather than a share-of-portfolio percentage.
 */
function PortfolioKpiCard({
  title,
  icon,
  tone,
  value,
  suffix,
  caption,
  captionMuted,
}: {
  title: string
  icon: ReactNode
  tone: Tone
  value: string | number
  suffix?: string
  caption?: string
  captionMuted?: boolean
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="truncate text-sm font-medium text-foreground">{title}</span>
        <span
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-full",
            ICON_TONE[tone]
          )}
        >
          {icon}
        </span>
      </div>
      <div className="flex min-w-0 items-baseline gap-1.5">
        <span className={cn("truncate text-2xl font-bold tabular-nums", VALUE_TONE[tone])}>
          {value}
        </span>
        {suffix && <span className="shrink-0 text-xs text-muted-foreground">{suffix}</span>}
      </div>
      {caption && (
        <span
          className={cn(
            "truncate text-[11px] font-medium",
            captionMuted ? "font-normal text-muted-foreground" : VALUE_TONE[tone]
          )}
        >
          {caption}
        </span>
      )}
    </div>
  )
}

/**
 * Portfolio-level KPI row for the Initiative 7 Overview page — the four KPIs
 * that matter for a planner scanning the page: where disruption is likely
 * (stockout risk), where capital is trapped unnecessarily (excess inventory),
 * the financial consequence of the open recommendations (working-capital
 * impact), and how many still need a decision (pending approval). Every
 * figure derives from whichever recommendation set is passed in — the full
 * catalog by default, or the dashboard's current filter selection.
 */
export function InventoryPortfolioKpis({
  recommendations = RECOMMENDATIONS,
  pendingApprovalOverride,
  stockoutRiskOverride,
  excessInventoryOverride,
}: {
  recommendations?: Recommendation[]
  /** Part 35 -- portfolio-wide { count, total } for "Pending Approval",
   * from GET /recommendations/summary. In live mode, `recommendations` is at
   * most one fetched page, so counting/percenting from it directly would
   * read "100% of recommendations" from a page that happens to be mostly
   * blocked materials, not a real portfolio share (see
   * use-live-recommendation-summary.ts). Only this one KPI has a real
   * backend aggregate to fall back to; the other three still derive from
   * `recommendations` as before -- unchanged, not addressed here. */
  pendingApprovalOverride?: { count: number; total: number }
  /** Portfolio-wide { count, total } for "Critical Stockout Risk", from
   * GET /recommendations/summary's critical_stockout_risk_count -- the same
   * one-fetched-page-is-not-the-portfolio problem pendingApprovalOverride
   * documents above applies here too: current on-hand stock vs.
   * recommended_rop is computed in SQL over every recommendation, not just
   * the ~200 rows the live table happens to have fetched. */
  stockoutRiskOverride?: { count: number; total: number }
  /** Portfolio-wide { count, total, opportunity } for "Excess Inventory
   * Candidates", from GET /recommendations/summary's
   * excess_inventory_candidates_count / excess_inventory_opportunity.
   * `opportunity` is `null` (never a fabricated 0) when no in-scope row has
   * unit_price, current_max_stock and recommended_max_stock all populated --
   * see RecommendationSummaryStats.excess_inventory_opportunity's docstring
   * on the backend. */
  excessInventoryOverride?: { count: number; total: number; opportunity: number | null }
}) {
  const total = recommendations.length
  const stockoutRisk = stockoutRiskOverride?.count ?? countAtStockoutRisk(recommendations)
  const stockoutRiskTotal = stockoutRiskOverride?.total ?? total
  const excess = excessInventoryOverride?.count ?? countExcessCandidates(recommendations)
  const excessTotal = excessInventoryOverride?.total ?? total
  const awaiting = pendingApprovalOverride?.count ?? countAwaitingApproval(recommendations)
  const awaitingTotal = pendingApprovalOverride?.total ?? total
  // Working Capital Impact is unchanged in this pass -- still derived from
  // `recommendations` (the fetched page), same caveat pendingApprovalOverride's
  // docstring notes for the other un-overridden KPIs. Wiring
  // net_safety_stock_value_impact here is a separate, not-yet-requested change.
  const netImpact = netWorkingCapitalImpact(recommendations)

  return (
    <div className="grid grid-cols-1 gap-3 xs:grid-cols-2 lg:grid-cols-4">
      <PortfolioKpiCard
        title="Critical Stockout Risk"
        icon={<AlertTriangle className="size-3.5" />}
        tone="danger"
        value={formatCount(stockoutRisk)}
        suffix="Materials"
        caption={`${pct(stockoutRisk, stockoutRiskTotal)}% of in-scope`}
      />
      <PortfolioKpiCard
        title="Excess Inventory Candidates"
        icon={<Layers className="size-3.5" />}
        tone="info"
        value={formatCount(excess)}
        suffix="Materials"
        caption={`${pct(excess, excessTotal)}% of in-scope`}
      />
      <PortfolioKpiCard
        title="Working Capital Impact"
        icon={<Wallet className="size-3.5" />}
        tone="success"
        value={formatCompactSignedZAR(netImpact)}
        caption={netImpact >= 0 ? "Net release" : "Net additional investment"}
      />
      <PortfolioKpiCard
        title="Pending Approval"
        icon={<Clock className="size-3.5" />}
        tone="warning"
        value={formatCount(awaiting)}
        suffix="Recommendations"
        caption={`${pct(awaiting, awaitingTotal)}% of recommendations`}
      />
    </div>
  )
}
