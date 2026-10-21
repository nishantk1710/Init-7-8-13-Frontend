// What the Overview's "by plant" cards count, in words -- the text behind each card's information
// button. Prose only: every number the cards show still comes from the summary endpoint, and the
// rules described here are the backend's (app.initiatives.i7.stockout_risk, and the excess count in
// GET /recommendations/summary), not recomputed here. Two things are dynamic and are passed in
// rather than written down: the date the stockout figures were read as of, and the All-plants
// figures behind the percentage line. The worked examples use made-up inputs and say so.

import { formatCount, formatIsoDateDMY } from "@/lib/utils"
import { formatShare, type PositionMetric } from "@/features/initiative-7/utils/plant-position"

export interface PositionInfoBlock {
  heading: string
  /** Short paragraphs, in order. */
  text?: string[]
  /** A rule or formula, shown set apart from the prose. */
  formula?: string
}

export interface PositionInfo {
  title: string
  blocks: PositionInfoBlock[]
}

/** The numerator and denominator the card's own All-plants bar is drawn from. `undefined` while the
 * position is loading, `null` when it has none (an error, or the usage not built). */
export type PositionFigures = { count: number; total: number } | null | undefined

export const POSITION_INFO_TITLE: Record<PositionMetric, string> = {
  stockoutRisk: "Stockout risk by plant",
  excess: "Excess inventory by plant",
}

/** Made-up inputs for the worked examples. The results are derived from them below, not typed in, so
 * the example cannot disagree with its own arithmetic. */
export const STOCKOUT_EXAMPLE = { consumption90d: 900, windowDays: 90, leadTimeDays: 20, onHand: 150 } as const
export const EXCESS_EXAMPLE = { currentMax: 500, recommendedMax: 300 } as const

export function stockoutExample() {
  const { consumption90d, windowDays, leadTimeDays, onHand } = STOCKOUT_EXAMPLE
  const dailyUse = consumption90d / windowDays
  const required = dailyUse * leadTimeDays
  return { dailyUse, required, shortfall: required - onHand, atRisk: onHand < required }
}

export function excessExample() {
  const { currentMax, recommendedMax } = EXCESS_EXAMPLE
  return { difference: currentMax - recommendedMax, isExcess: currentMax > recommendedMax }
}

/** The stockout "Data date" text. `undefined` = the position is still loading; `null` = the backend
 * has no date because the usage the figures are built from has not been built. */
export function stockoutDataDate(asOf: string | null | undefined): string {
  if (asOf === undefined) return "Loading the date these figures were read as of."
  if (asOf === null) return "Not available yet: the stockout usage has not been built, so nothing can be checked."
  return `${formatIsoDateDMY(asOf)}. The 90-day consumption window ends on this date, and a material is classed Fast, Slow or Non-moving by how long before it its last issue was. Today's date is not used.`
}

/** "All plants today: 890 at-risk out of 6,200 checked = 14%", from the card's own figures; nothing
 * when there are none to show, never a placeholder count. */
function figuresLine(figures: PositionFigures, noun: { count: string; total: string }): string | null {
  if (!figures) return null
  const share = formatShare(figures.count, figures.total)
  if (share === null) return null
  return `For All plants now: ${formatCount(figures.count)} ${noun.count} out of ${formatCount(figures.total)} ${noun.total} = ${share}.`
}

export function positionInfo(metric: PositionMetric, asOf?: string | null, figures?: PositionFigures): PositionInfo {
  if (metric === "stockoutRisk") {
    const example = stockoutExample()
    const { consumption90d, windowDays, leadTimeDays, onHand } = STOCKOUT_EXAMPLE
    const live = figuresLine(figures, { count: "at-risk materials", total: "checked" })
    return {
      title: POSITION_INFO_TITLE.stockoutRisk,
      blocks: [
        {
          heading: "What does this show?",
          text: ["Materials that may run short before their next supply arrives."],
        },
        {
          heading: "What is counted?",
          text: [
            "Fast- and Slow-moving materials that have enough stock, consumption, and supplier lead-time data to check their risk. Materials without recommendations can also be included.",
          ],
        },
        {
          heading: "How is it calculated?",
          formula: "Required stock = (Consumption in the last 90 days ÷ 90) × Supplier lead time in days",
          text: ["A material is at risk when its available stock is less than this required stock."],
        },
        {
          heading: "Example",
          text: [
            `A material uses ${formatCount(consumption90d)} units in ${windowDays} days, and its supplier takes ${leadTimeDays} days to deliver.`,
            `Average daily use = ${formatCount(consumption90d)} ÷ ${windowDays} = ${example.dailyUse} units. Required stock = ${example.dailyUse} × ${leadTimeDays} = ${example.required} units.`,
            `If available stock is ${onHand} units, the material is at risk because it has ${example.shortfall} fewer units than needed.`,
          ],
        },
        {
          heading: "How is the percentage calculated?",
          formula: "At-risk materials ÷ Materials that could be checked × 100",
          text: [
            "Materials with missing data, and Non-moving materials, are left out of the second figure.",
            ...(live ? [live] : []),
          ],
        },
        { heading: "Data date", text: [stockoutDataDate(asOf)] },
      ],
    }
  }
  const example = excessExample()
  const { currentMax, recommendedMax } = EXCESS_EXAMPLE
  const live = figuresLine(figures, { count: "candidates", total: "recommendations" })
  return {
    title: POSITION_INFO_TITLE.excess,
    blocks: [
      {
        heading: "What does this show?",
        text: ["Materials with more maximum stock than the latest recommendation suggests."],
      },
      {
        heading: "What is counted?",
        text: [
          "The latest eligible recommendation for each material and plant. Smooth-demand materials without an OAR recommendation are excluded.",
        ],
      },
      {
        heading: "How is it calculated?",
        text: ["Excess is counted when both values are available and:"],
        formula: "Current maximum stock > Recommended maximum stock",
      },
      {
        heading: "Example",
        text: [
          `Current maximum stock is ${currentMax} units. Recommended maximum stock is ${recommendedMax} units.`,
          `Potential excess = ${currentMax} − ${recommendedMax} = ${example.difference} units. This material counts as an excess inventory candidate. Even a small positive difference qualifies.`,
        ],
      },
      {
        heading: "How is the percentage calculated?",
        formula: "Excess inventory candidates ÷ All eligible recommendations × 100",
        text: [
          "All eligible recommendations includes those with no maximum stock figures; they can never count as excess.",
          ...(live ? [live] : []),
        ],
      },
      {
        heading: "Data date",
        text: [
          "The current maximum stock is the value saved when the latest recommendation analysis ran. It may differ from the live SAP value.",
        ],
      },
    ],
  }
}
