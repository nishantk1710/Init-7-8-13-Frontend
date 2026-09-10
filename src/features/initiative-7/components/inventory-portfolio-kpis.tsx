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
  return whole === 0 ? "0.0" : ((part / whole) * 100).toFixed(1)
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
    <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-foreground">{title}</span>
        <span
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-full",
            ICON_TONE[tone]
          )}
        >
          {icon}
        </span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={cn("text-2xl font-bold tabular-nums", VALUE_TONE[tone])}>
          {value}
        </span>
        {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
      </div>
      {caption && (
        <span
          className={cn(
            "text-[11px] font-medium",
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
}: {
  recommendations?: Recommendation[]
}) {
  const total = recommendations.length
  const stockoutRisk = countAtStockoutRisk(recommendations)
  const excess = countExcessCandidates(recommendations)
  const awaiting = countAwaitingApproval(recommendations)
  const netImpact = netWorkingCapitalImpact(recommendations)

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <PortfolioKpiCard
        title="Critical Stockout Risk"
        icon={<AlertTriangle className="size-3.5" />}
        tone="danger"
        value={formatCount(stockoutRisk)}
        suffix="Materials"
        caption={`${pct(stockoutRisk, total)}% of in-scope`}
      />
      <PortfolioKpiCard
        title="Excess Inventory Candidates"
        icon={<Layers className="size-3.5" />}
        tone="info"
        value={formatCount(excess)}
        suffix="Materials"
        caption={`${pct(excess, total)}% of in-scope`}
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
        caption={`${pct(awaiting, total)}% of recommendations`}
      />
    </div>
  )
}
