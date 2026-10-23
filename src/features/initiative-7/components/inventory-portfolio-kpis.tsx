import type { ReactNode } from "react"
import { AlertTriangle, CheckCircle2, Layers, Wallet } from "lucide-react"

import { ChartLoader } from "@/components/shared/chart-loader"
import { cn, commonCurrency, currencyPrefix, formatCount, formatIsoDateDMY } from "@/lib/utils"
import { OverviewInfo } from "@/features/initiative-7/components/overview-info-popup"
import type { OverviewInfoId } from "@/features/initiative-7/data/overview-info"
import type { Recommendation } from "@/features/initiative-7/types/inventory"
import {
  countAtStockoutRisk,
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

// The Overview's cards take the Repairable Spares Overview's look: a plain card with a 3px accent bar
// down its left edge in the card's own tone, and the tone carried by the icon chip rather than a wash
// over the whole card. The pointer only lifts them a little, and a press dips them back down. Written
// out in full so Tailwind can see every class.
const CARD_BAR: Record<Tone, string> = {
  info: "before:bg-primary",
  success: "before:bg-success",
  warning: "before:bg-warning",
  danger: "before:bg-destructive",
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

/** Compact signed amount in millions, e.g. -1048500 -> "−R 1.05M", in the
 * recommendations' own currency (see formatMoney / currencyPrefix). */
function formatCompactSigned(amount: number, currency?: string | null): string {
  const sign = amount < 0 ? "−" : amount > 0 ? "+" : ""
  const millions = Math.abs(amount) / 1_000_000
  return `${sign}${currencyPrefix(currency)}${millions.toFixed(2)}M`
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
  note,
  loading = false,
  infoId,
}: {
  title: string
  icon: ReactNode
  tone: Tone
  value: string | number
  suffix?: string
  caption?: string
  captionMuted?: boolean
  /** A second, always-muted line under the caption -- e.g. the date a figure is as of. */
  note?: string
  /** The figure is being fetched: a spinning circle stands where the value and its lines will be, so a card is never
   * "Not available" (or showing the previous filter's number) for the moments a new figure takes to arrive. */
  loading?: boolean
  /** Puts the (i) icon beside the title, explaining how the figure is calculated. */
  infoId?: OverviewInfoId
}) {
  // Only where the card explains itself (the Overview): the quarterly reports reuse these cards and
  // keep the plain card below.
  if (infoId) {
    return (
      <div
        className={cn(
          "group/card relative flex min-w-0 flex-col gap-1 rounded-xl border border-border bg-card px-5 py-4 shadow-xs",
          "before:absolute before:inset-y-4 before:-left-px before:w-[3px] before:rounded-r-full",
          CARD_BAR[tone],
          "transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.99] active:shadow-xs motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100"
        )}
        aria-busy={loading || undefined}
      >
        <span className="flex min-w-0 items-center gap-2.5 text-sm font-medium text-muted-foreground">
          <span
            className={cn(
              "grid size-[30px] shrink-0 place-items-center rounded-lg transition-transform duration-150 group-hover/card:scale-105 motion-reduce:transition-none",
              ICON_TONE[tone]
            )}
          >
            {icon}
          </span>
          <span className="truncate">{title}</span>
          <OverviewInfo id={infoId} />
        </span>
        {loading ? (
          // As tall as a card's value and its two lines, so the card does not change size when the figure arrives.
          <ChartLoader label={`Loading ${title}`} className="h-[76px]" />
        ) : (
          <>
            <div className="mt-1.5 flex min-w-0 items-baseline gap-1.5">
              <span className="truncate text-[30px] leading-tight font-semibold tracking-tight text-foreground tabular-nums">
                {value}
              </span>
              {suffix && <span className="shrink-0 text-[13px] text-muted-foreground">{suffix}</span>}
            </div>
            {caption && <span className="truncate text-[13.5px] text-muted-foreground">{caption}</span>}
            {note && <span className="truncate text-xs text-muted-foreground">{note}</span>}
          </>
        )}
      </div>
    )
  }

  return (
    <div className="flex min-w-0 flex-col gap-1.5 rounded-xl border border-border bg-card p-4" aria-busy={loading || undefined}>
      <div className="flex items-start justify-between gap-2">
        <span className="truncate text-sm font-medium text-foreground">{title}</span>
        <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full", ICON_TONE[tone])}>
          {icon}
        </span>
      </div>
      {loading ? (
        // As tall as a card's value and its two lines, so the card does not change size when the figure arrives.
        <ChartLoader label={`Loading ${title}`} className="h-[76px]" />
      ) : (
        <>
          <div className="flex min-w-0 items-baseline gap-1.5">
            <span className={cn("truncate text-2xl font-bold tabular-nums", VALUE_TONE[tone])}>{value}</span>
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
          {note && <span className="truncate text-[11px] text-muted-foreground">{note}</span>}
        </>
      )}
    </div>
  )
}

/**
 * Portfolio-level KPI row for the Initiative 7 Overview page — the four KPIs
 * that matter for a planner scanning the page: where disruption is likely
 * (stockout risk), where capital is trapped unnecessarily (excess inventory),
 * the financial consequence of the open recommendations (working-capital
 * impact), and how many of the recommendations were adopted in SAP. Every
 * figure derives from whichever recommendation set is passed in — the full
 * catalog by default, or the dashboard's current filter selection.
 */
export function InventoryPortfolioKpis({
  recommendations,
  adoptedOverride,
  adoptedUnavailable,
  stockoutRiskOverride,
  stockoutRiskUnavailable,
  excessInventoryOverride,
  workingCapitalOverride,
  loading,
  showInfo = false,
}: {
  /** Adds the (i) icon to each card. Off by default: the quarterly reports reuse these cards. */
  showInfo?: boolean
  recommendations: Recommendation[]
  /** Portfolio-wide { count, total } for "Adopted recommendation", from GET
   * /recommendations/adoption/summary: `count` are the recommendations SAP's change history shows
   * adopted, `total` the recommendations with something to adopt (an OAR one eligible for the
   * Min-Max conversion, or a stock item with a changed ROP / safety stock / max stock) -- the same
   * set the Recommendations page lists. In live mode `recommendations` is at most one fetched page,
   * so a count taken from it would not be the portfolio's. Without it (the scenario dataset) the
   * card counts the rows it was given that are Implemented. `null` says the figure could not be
   * had: the card reads "Not available" rather than 0. */
  adoptedOverride?: { count: number; total: number } | null
  /** Why the adoption figure is not there yet (still loading, ...): the card says "Not available"
   * with this as its caption instead of counting whichever rows it was given. */
  adoptedUnavailable?: string
  /** Portfolio-wide figures for "High Stockout Risk", from GET /recommendations/summary's
   * critical_stockout_risk_count -- the same one-fetched-page-is-not-the-portfolio problem
   * pendingApprovalOverride documents above applies here too: it is computed in SQL over every
   * recommendation, not just the ~200 rows the live table happens to have fetched.
   *
   * `count` are the Fast / Slow material-plants whose stock on hand is below average daily
   * consumption x lead time; `total` is how many could be judged (the denominator -- Insufficient
   * Data is left out of it); `insufficient` is how many could not be judged; `asOf` is the ISO date
   * the consumption and bands were read as of. `asOf: null` means the usage has not been built, and
   * the card says "Not available" rather than showing 0. */
  stockoutRiskOverride?: { count: number; total: number; insufficient?: number; asOf?: string | null }
  /** Why the portfolio figure above is not available (still loading, could not be loaded, ...).
   * The card then says "Not available" with this as its caption, instead of counting whichever
   * recommendations were fetched -- a page of rows is not the portfolio, and that count reads as
   * the real figure. Live mode passes it whenever it has no backend summary to pass above. */
  stockoutRiskUnavailable?: string
  /** Portfolio-wide { count, total, opportunity } for "Excess Inventory
   * Candidates", from GET /recommendations/summary's
   * excess_inventory_candidates_count / excess_inventory_opportunity.
   * `opportunity` is `null` (never a fabricated 0) when no in-scope row has
   * unit_price, current_max_stock and recommended_max_stock all populated --
   * see RecommendationSummaryStats.excess_inventory_opportunity's docstring
   * on the backend. */
  excessInventoryOverride?: { count: number; total: number; opportunity: number | null }
  /** Portfolio-wide net working-capital impact, from GET /recommendations/summary's
   * net_rop_value_impact (unit price x current - recommended reorder point): positive releases
   * working capital, negative ties more up. `amount` is `null` (never a fabricated 0) when no
   * recommendation has a unit price, a current and a recommended reorder point together -- shown as
   * "Not available". Without this, the KPI sums only the rows that happen to be on
   * the fetched page, which is a handful of the newest rows and not the portfolio. */
  workingCapitalOverride?: { amount: number | null; currency: string | null; estimated?: boolean }
  /** Which cards are waiting for their figure. A card that is loading shows a loader, whatever else it was given. */
  loading?: Partial<Record<"stockout" | "excess" | "workingCapital" | "adopted", boolean>>
}) {
  const total = recommendations.length
  const stockoutRisk = stockoutRiskOverride?.count ?? countAtStockoutRisk(recommendations)
  const stockoutRiskTotal = stockoutRiskOverride?.total ?? total
  // From the backend: `asOf` is the date the figures were read as of (null = the usage behind them has
  // not been built). Absent on the scenario dataset, which still counts the rows it was given.
  const stockoutAsOf = stockoutRiskOverride?.asOf
  const stockoutNotComputed =
    stockoutRiskUnavailable !== undefined || (stockoutRiskOverride !== undefined && stockoutAsOf === null)
  const stockoutNotComputedCaption = stockoutRiskUnavailable ?? "needs the stockout usage build"
  const stockoutInsufficient = stockoutRiskOverride?.insufficient ?? 0
  const stockoutNote = stockoutAsOf
    ? [
        `As of ${formatIsoDateDMY(stockoutAsOf)}`,
        stockoutInsufficient > 0 ? `${formatCount(stockoutInsufficient)} need data` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : undefined
  const excess = excessInventoryOverride?.count ?? countExcessCandidates(recommendations)
  const excessTotal = excessInventoryOverride?.total ?? total
  const adoptedNotAvailable = adoptedOverride === null || adoptedUnavailable !== undefined
  const adopted = adoptedOverride?.count ?? recommendations.filter((r) => r.status === "Implemented").length
  const adoptedTotal = adoptedOverride?.total ?? total
  // From the backend's portfolio total when given; otherwise (the scenario
  // dataset) from the recommendations passed in.
  const netImpact = workingCapitalOverride
    ? workingCapitalOverride.amount
    : netWorkingCapitalImpact(recommendations)
  const impactCurrency = workingCapitalOverride
    ? workingCapitalOverride.currency
    : commonCurrency(recommendations.map((r) => r.currency))

  return (
    <div className="grid grid-cols-1 gap-3 xs:grid-cols-2 lg:grid-cols-4">
      <PortfolioKpiCard
        title="High Stockout Risk"
        loading={loading?.stockout}
        infoId={showInfo ? "stockoutRisk" : undefined}
        icon={<AlertTriangle className="size-3.5" />}
        tone="danger"
        value={stockoutNotComputed ? "Not available" : formatCount(stockoutRisk)}
        suffix={stockoutNotComputed ? undefined : "Materials"}
        caption={
          stockoutNotComputed
            ? stockoutNotComputedCaption
            : `${pct(stockoutRisk, stockoutRiskTotal)}% of ${stockoutAsOf ? "evaluated" : "in-scope"}`
        }
        captionMuted={stockoutNotComputed}
        note={stockoutRiskUnavailable === undefined ? stockoutNote : undefined}
      />
      <PortfolioKpiCard
        title="Excess Inventory Candidates"
        loading={loading?.excess}
        infoId={showInfo ? "excessInventory" : undefined}
        icon={<Layers className="size-3.5" />}
        tone="info"
        value={formatCount(excess)}
        suffix="Materials"
        caption={`${pct(excess, excessTotal)}% of in-scope`}
      />
      <PortfolioKpiCard
        title="Working Capital Impact"
        loading={loading?.workingCapital}
        infoId={showInfo ? "workingCapital" : undefined}
        icon={<Wallet className="size-3.5" />}
        tone="success"
        value={netImpact === null ? "Not available" : formatCompactSigned(netImpact, impactCurrency)}
        caption={
          netImpact === null
            ? "needs a unit price and a calculated reorder point"
            : `${netImpact >= 0 ? "Net release" : "Net additional investment"}${workingCapitalOverride?.estimated ? " · estimate" : ""}`
        }
        captionMuted={netImpact === null}
      />
      <PortfolioKpiCard
        title="Adopted recommendation"
        loading={loading?.adopted}
        infoId={showInfo ? "adoptedRecommendation" : undefined}
        icon={<CheckCircle2 className="size-3.5" />}
        tone="warning"
        value={adoptedNotAvailable ? "Not available" : formatCount(adopted)}
        suffix={adoptedNotAvailable ? undefined : `of ${formatCount(adoptedTotal)} recommendations`}
        caption={
          adoptedNotAvailable
            ? (adoptedUnavailable ?? "adoption counts could not be loaded")
            : `${pct(adopted, adoptedTotal)}% adopted`
        }
        captionMuted={adoptedNotAvailable}
      />
    </div>
  )
}
