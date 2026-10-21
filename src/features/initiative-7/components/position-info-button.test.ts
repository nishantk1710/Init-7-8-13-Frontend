// The information buttons on the two "by plant" cards: what they say, that the worked examples add
// up, that each button stands alone, and that adding them left the cards and ChartCard as they were.
//
// Rendered to static markup (this project's vitest runs without a DOM), so what is read here is the
// closed button's accessibility attributes, the popover's content, and the classes that give it its
// width and glass look. Opening, Escape, click-outside, keeping inside the viewport and focus return
// belong to the Base UI popover and are not re-tested in this environment.

import { describe, expect, it } from "vitest"
import { createElement, type ComponentProps } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { ChartCard } from "@/components/shared/chart-card"
import {
  COVER_ANCHOR_OFFSET,
  POSITION_INFO_POPUP_CLASS,
  PositionInfoButton,
  PositionInfoContent,
} from "./position-info-button"
import { ExcessPositionCard, StockoutPositionCard } from "./plant-position-cards"
import type { PlantPositionsState } from "@/features/initiative-7/hooks/use-plant-positions"
import { allPlantsFigures, type PlantPosition } from "@/features/initiative-7/utils/plant-position"
import {
  EXCESS_EXAMPLE,
  STOCKOUT_EXAMPLE,
  excessExample,
  positionInfo,
  stockoutDataDate,
  stockoutExample,
  type PositionFigures,
} from "@/features/initiative-7/utils/position-info"

const POSITIONS: PlantPosition[] = [
  { scope: "ALL", total: 18752, stockoutRisk: 890, stockoutEvaluated: 6200, stockoutAsOf: "2026-05-31", excess: 2254 },
  { scope: "1300", total: 18000, stockoutRisk: 850, stockoutEvaluated: 6000, stockoutAsOf: "2026-05-31", excess: 2200 },
  { scope: "1500", total: 752, stockoutRisk: 40, stockoutEvaluated: 200, stockoutAsOf: "2026-05-31", excess: 54 },
]
// ChartCard's children are passed as the third argument, as the lint rule asks; the cast stands in
// for them in the props, which createElement's typing would otherwise insist on.
type ChartCardProps = ComponentProps<typeof ChartCard>

const loaded = (positions: PlantPosition[]): PlantPositionsState => ({ positions, loading: false, error: null })

const content = (metric: "stockoutRisk" | "excess", asOf?: string | null, figures?: PositionFigures) =>
  renderToStaticMarkup(createElement(PositionInfoContent, { metric, asOf, figures }))

describe("the button", () => {
  it("is a labelled, closed button for each card, and the two do not share a label", () => {
    const stockout = renderToStaticMarkup(createElement(PositionInfoButton, { metric: "stockoutRisk", asOf: null }))
    const excess = renderToStaticMarkup(createElement(PositionInfoButton, { metric: "excess" }))
    expect(stockout).toContain('aria-label="About Stockout risk by plant"')
    expect(excess).toContain('aria-label="About Excess inventory by plant"')
    for (const markup of [stockout, excess]) {
      expect(markup).toMatch(/^<button\b/)
      expect(markup).toContain('type="button"')
      expect(markup).toContain('aria-expanded="false"')
      expect(markup).toContain('aria-haspopup="dialog"')
    }
    expect(stockout).not.toContain("Excess inventory by plant")
    expect(excess).not.toContain("Stockout risk by plant")
  })

  it("keeps the definition out of the page until it is opened", () => {
    const markup = renderToStaticMarkup(createElement(PositionInfoButton, { metric: "stockoutRisk", asOf: "2026-05-31" }))
    expect(markup).not.toContain("What does this show?")
    expect(markup).not.toContain("31 May 2026")
  })
})

describe("the popover's size and place", () => {
  it("is exactly the card's width and height, and scrolls inside when its text is taller", () => {
    expect(POSITION_INFO_POPUP_CLASS).toContain("w-(--anchor-width)")
    expect(POSITION_INFO_POPUP_CLASS).toContain("h-(--anchor-height)")
    expect(POSITION_INFO_POPUP_CLASS).toContain("overflow-y-auto")
    expect(POSITION_INFO_POPUP_CLASS).toContain("rounded-xl") // the card's own corners
    expect(POSITION_INFO_POPUP_CLASS).not.toMatch(/max-w-|max-h-/) // nothing short of the card's size
  })

  it("opens on the card's top edge by pulling the popup up by the card's own height", () => {
    expect(COVER_ANCHOR_OFFSET({ anchor: { height: 300 } })).toBe(-300)
    expect(COVER_ANCHOR_OFFSET({ anchor: { height: 228 } })).toBe(-228)
  })

  it("is found from the card's own markup: ChartCard marks its root", () => {
    const markup = renderToStaticMarkup(
      createElement(ChartCard, { title: "A chart" } as ChartCardProps, createElement("span", null, "body")),
    )
    expect(markup).toContain('data-slot="chart-card"')
  })
})

describe("the popover's look", () => {
  it("is see-through over a strong blur, with a light border and a soft shadow, and solid where blur is unsupported", () => {
    expect(POSITION_INFO_POPUP_CLASS).toContain("supports-backdrop-filter:bg-popover/45")
    expect(POSITION_INFO_POPUP_CLASS).toContain("supports-backdrop-filter:backdrop-blur-lg")
    expect(POSITION_INFO_POPUP_CLASS).toContain("border-border/50")
    expect(POSITION_INFO_POPUP_CLASS).toContain("shadow-lg")
    expect(POSITION_INFO_POPUP_CLASS).toMatch(/(^| )bg-popover( |$)/) // the opaque fallback
  })

  it("uses theme tokens only, never a fixed colour", () => {
    expect(POSITION_INFO_POPUP_CLASS).not.toMatch(/#[0-9a-f]{3,8}|rgb\(|bg-white|bg-black/i)
  })
})

describe("Stockout risk by plant: the content", () => {
  const markup = content("stockoutRisk", "2026-05-31")

  it("has the headings in order: what it shows, what is counted, how it is calculated, example, percentage, data date", () => {
    const headings = [
      "What does this show?",
      "What is counted?",
      "How is it calculated?",
      "Example",
      "How is the percentage calculated?",
      "Data date",
    ]
    const positions = headings.map((heading) => markup.indexOf(`>${heading}<`))
    expect(positions.every((position) => position >= 0)).toBe(true)
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
  })

  it("says what it shows and what is counted", () => {
    expect(markup).toContain("Materials that may run short before their next supply arrives.")
    expect(markup).toContain("Fast- and Slow-moving materials that have enough stock, consumption, and supplier lead-time data")
    expect(markup).toContain("Materials without recommendations can also be included.")
  })

  it("gives the formula and the at-risk rule", () => {
    expect(markup).toContain("Required stock = (Consumption in the last 90 days ÷ 90) × Supplier lead time in days")
    expect(markup).toContain("A material is at risk when its available stock is less than this required stock.")
  })

  it("gives the percentage formula", () => {
    expect(markup).toContain("At-risk materials ÷ Materials that could be checked × 100")
  })

  it("has a worked example whose arithmetic is right", () => {
    const { dailyUse, required, shortfall, atRisk } = stockoutExample()
    expect([dailyUse, required, shortfall, atRisk]).toEqual([10, 200, 50, true])
    expect(STOCKOUT_EXAMPLE).toEqual({ consumption90d: 900, windowDays: 90, leadTimeDays: 20, onHand: 150 })
    expect(markup).toContain("A material uses 900 units in 90 days, and its supplier takes 20 days to deliver.")
    expect(markup).toContain("Average daily use = 900 ÷ 90 = 10 units. Required stock = 10 × 20 = 200 units.")
    expect(markup).toContain("If available stock is 150 units, the material is at risk because it has 50 fewer units than needed.")
  })

  it("takes the data date from the figures, never from the text, and explains what it governs", () => {
    expect(content("stockoutRisk", "2026-05-31")).toContain("31 May 2026")
    const later = content("stockoutRisk", "2027-01-15")
    expect(later).toContain("15 Jan 2027")
    expect(later).not.toContain("31 May 2026")
    expect(markup).toContain("The 90-day consumption window ends on this date")
    expect(markup).toContain("Fast, Slow or Non-moving")
  })

  it("says so when there is no date, instead of showing one", () => {
    expect(stockoutDataDate(null)).toContain("has not been built")
    expect(stockoutDataDate(undefined)).toContain("Loading")
    expect(content("stockoutRisk", null)).not.toMatch(/\b20\d\d\b/)
  })
})

describe("Excess inventory by plant: the content", () => {
  const markup = content("excess")

  it("has the headings in order", () => {
    const headings = [
      "What does this show?",
      "What is counted?",
      "How is it calculated?",
      "Example",
      "How is the percentage calculated?",
      "Data date",
    ]
    const positions = headings.map((heading) => markup.indexOf(`>${heading}<`))
    expect(positions.every((position) => position >= 0)).toBe(true)
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
  })

  it("says what it shows, what is counted, and the rule", () => {
    expect(markup).toContain("Materials with more maximum stock than the latest recommendation suggests.")
    expect(markup).toContain("The latest eligible recommendation for each material and plant.")
    expect(markup).toContain("Smooth-demand materials without an OAR recommendation are excluded.")
    expect(markup).toContain("Current maximum stock &gt; Recommended maximum stock")
    expect(markup).toContain("both values are available")
  })

  it("has a worked example whose arithmetic is right", () => {
    expect(excessExample()).toEqual({ difference: 200, isExcess: true })
    expect(EXCESS_EXAMPLE).toEqual({ currentMax: 500, recommendedMax: 300 })
    expect(markup).toContain("Current maximum stock is 500 units. Recommended maximum stock is 300 units.")
    expect(markup).toContain("Potential excess = 500 − 300 = 200 units.")
    expect(markup).toContain("Even a small positive difference qualifies.")
  })

  it("gives the percentage formula and says what the total includes", () => {
    expect(markup).toContain("Excess inventory candidates ÷ All eligible recommendations × 100")
    expect(markup).toContain("includes those with no maximum stock figures")
  })

  it("says the current maximum stock is the one saved with the recommendation, not live SAP", () => {
    expect(markup).toContain("the value saved when the latest recommendation analysis ran")
    expect(markup).toContain("It may differ from the live SAP value.")
  })

  it("is unaffected by a stockout date", () => {
    expect(content("excess", "2026-05-31")).toBe(markup)
  })
})

describe("the percentage line uses the card's own figures", () => {
  it("quotes the All-plants numerator, denominator and share from the position, not from the text", () => {
    const figures = allPlantsFigures(loaded(POSITIONS), "stockoutRisk")
    expect(figures).toEqual({ count: 890, total: 6200 })
    expect(content("stockoutRisk", "2026-05-31", figures)).toContain(
      "For All plants now: 890 at-risk materials out of 6,200 checked = 14%.",
    )
    expect(content("excess", null, allPlantsFigures(loaded(POSITIONS), "excess"))).toContain(
      "For All plants now: 2,254 candidates out of 18,752 recommendations = 12%.",
    )
  })

  it("follows the figures when they change", () => {
    const other = POSITIONS.map((position) => ({ ...position, stockoutRisk: 432, stockoutEvaluated: 6360 }))
    expect(content("stockoutRisk", "2026-05-31", allPlantsFigures(loaded(other), "stockoutRisk"))).toContain(
      "432 at-risk materials out of 6,360 checked = 6.8%.",
    )
  })

  it("shows no count at all while loading, on a load error, or when the usage is not built", () => {
    const states: PlantPositionsState[] = [
      { positions: [], loading: true, error: null },
      { positions: [], loading: false, error: new Error("503") },
      loaded(POSITIONS.map((position) => ({ ...position, stockoutAsOf: null, stockoutRisk: 0, stockoutEvaluated: 0 }))),
    ]
    for (const state of states) {
      const figures = allPlantsFigures(state, "stockoutRisk")
      expect(figures === undefined || figures === null).toBe(true)
      expect(content("stockoutRisk", null, figures)).not.toContain("For All plants now")
    }
  })

  it("shows no share when there is nothing to divide", () => {
    expect(content("excess", null, { count: 0, total: 0 })).not.toContain("For All plants now")
  })

  it("carries no counts written into the text", () => {
    for (const metric of ["stockoutRisk", "excess"] as const) {
      const text = JSON.stringify(positionInfo(metric, "2026-05-31"))
      for (const figure of ["890", "6,200", "6200", "18,752", "18752", "2,254", "2254", "432", "6,360"]) {
        expect(text).not.toContain(figure)
      }
    }
  })
})

describe("the content is compact and plain", () => {
  it("has no emoji or decorative symbols, only the operators the formulas need", () => {
    for (const metric of ["stockoutRisk", "excess"] as const) {
      const text = JSON.stringify(positionInfo(metric, "2026-05-31", { count: 1, total: 10 }))
      expect(text).not.toMatch(/\p{Extended_Pictographic}/u)
      expect(text).not.toMatch(/[✓✔✗✘★☆•→←↑↓⚠]/)
    }
  })

  it("stays short enough to keep the popover low", () => {
    for (const metric of ["stockoutRisk", "excess"] as const) {
      const info = positionInfo(metric, "2026-05-31", { count: 1, total: 10 })
      const words = info.blocks
        .flatMap((block) => [...(block.text ?? []), ...(block.formula ? [block.formula] : [])])
        .join(" ")
        .split(/\s+/).length
      expect(info.blocks).toHaveLength(6)
      expect(words).toBeLessThan(230)
    }
  })

  it("sets the formulas apart from the prose", () => {
    expect(content("stockoutRisk", null)).toContain("bg-foreground/5")
    expect(content("excess")).toContain("bg-foreground/5")
  })

  it("keeps body text at full-strength foreground so it reads over a see-through background", () => {
    expect(content("excess")).toContain("text-foreground/80")
    expect(content("excess")).not.toContain("text-muted-foreground")
  })
})

describe("the cards and ChartCard are as they were", () => {
  it("renders ChartCard exactly as before when no action is given", () => {
    const markup = renderToStaticMarkup(
      createElement(ChartCard, { title: "A chart", subtitle: "What it shows", span: 6 } as ChartCardProps, createElement("span", null, "body")),
    )
    expect(markup).toContain('<div class="text-sm font-medium text-foreground">A chart</div>')
    expect(markup).not.toContain("<button")
  })

  it("puts a given action beside the title and nowhere else", () => {
    const markup = renderToStaticMarkup(
      createElement(
        ChartCard,
        { title: "A chart", titleAction: createElement("button", { type: "button" }, "i") } as ChartCardProps,
        createElement("span", null, "body"),
      ),
    )
    expect(markup).toContain("A chart</div><button")
    expect(markup.match(/<button/g)).toHaveLength(1)
    // On the title line, pushed to its right-hand end.
    expect(markup).toContain('class="flex items-center justify-between gap-2"')
  })

  it("leaves the two cards' own text and bars untouched", () => {
    const stockout = renderToStaticMarkup(createElement(StockoutPositionCard, { state: loaded(POSITIONS) }))
    const excess = renderToStaticMarkup(createElement(ExcessPositionCard, { state: loaded(POSITIONS) }))
    expect(stockout).toContain("below the AI Suggested reorder point, as of the latest recommendation analysis.")
    expect(excess).toContain("above the recommended maximum, as of the latest recommendation analysis.")
    expect(stockout).not.toContain("<button")
    expect(excess).not.toContain("<button")
  })
})
