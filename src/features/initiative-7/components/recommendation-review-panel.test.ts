// The expanded recommendation panel:
//   - an OAR material's reasons sit under the Reason line of its "Move from OAR to Min-Max ordering"
//     section, with no separate "Why this recommendation?" block;
//   - a material with no usage history gets no "Consumption history & forecast" card at all;
//   - a Min-Max (non-OAR) material keeps "Why this recommendation?".
//
// Rendered to static markup with react-dom/server: this project's vitest runs without a DOM.

import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { OarConversionLabel, RecommendationReviewPanel } from "./recommendation-review-panel"
import { RECOMMENDATIONS } from "@/features/initiative-7/data/recommendations"
import type { OarConversionInfo, Recommendation } from "@/features/initiative-7/types/inventory"

const OAR: OarConversionInfo = {
  isOar: true,
  conversionEligibility: "ELIGIBLE",
  conversionTrigger: "CONSUMPTION_FREQUENCY",
  conversionDetail: "Used 14 times in the last 12 months.",
  demandClass: "SMOOTH",
  consumptionCount12m: 14,
  consumptionCountThreshold: 12,
  productionImpact: null,
  i13HodApproved: null,
}

function rec(overrides: Partial<Recommendation>): Recommendation {
  return {
    ...RECOMMENDATIONS[0],
    rationale: { text: "- Demand is steady\n- Lead time is short", source: "DETERMINISTIC_FALLBACK" },
    ...overrides,
  }
}

const render = (r: Recommendation) => renderToStaticMarkup(createElement(RecommendationReviewPanel, { rec: r }))

describe("an OAR recommendation", () => {
  const markup = render(rec({ oarConversion: OAR }))

  it("shows its reasons inside the Min-Max conversion section, under Reason", () => {
    expect(markup).toContain("Move from OAR to Min-Max ordering")
    const reason = markup.indexOf("Reason")
    expect(reason).toBeGreaterThan(markup.indexOf("Move from OAR to Min-Max ordering"))
    expect(markup.indexOf("Used 14 times in the last 12 months.")).toBeGreaterThan(reason)
    expect(markup.indexOf("Demand is steady")).toBeGreaterThan(reason)
    expect(markup.indexOf("Lead time is short")).toBeGreaterThan(reason)
  })

  it("has no separate Why this recommendation? block", () => {
    expect(markup).not.toContain("Why this recommendation?")
  })
})

describe("a Min-Max (non-OAR) recommendation", () => {
  it("keeps Why this recommendation? and has no conversion section", () => {
    const markup = render(rec({ oarConversion: undefined }))
    expect(markup).toContain("Why this recommendation?")
    expect(markup).toContain("Demand is steady")
    expect(markup).not.toContain("Move from OAR to Min-Max ordering")
  })
})

describe("the Consumption history & forecast card", () => {
  it("is there when the material has usage history", () => {
    const markup = render(rec({ consumptionHistory: [{ period: "Jan", qty: 4 }] }))
    expect(markup).toContain("Consumption history &amp; forecast")
  })

  it("is gone, with no empty placeholder, when the material has none", () => {
    const markup = render(rec({ consumptionHistory: [] }))
    expect(markup).not.toContain("Consumption history &amp; forecast")
    expect(markup).not.toContain("No usage history to show")
  })
})

describe("OarConversionLabel", () => {
  it("reads Eligible", () => {
    const markup = renderToStaticMarkup(createElement(OarConversionLabel, { eligibility: "ELIGIBLE" }))
    expect(markup).toContain("Eligible")
    expect(markup).not.toContain("Not eligible")
  })

  it("reads Not eligible", () => {
    expect(renderToStaticMarkup(createElement(OarConversionLabel, { eligibility: "NOT_ELIGIBLE" }))).toContain(
      "Not eligible",
    )
  })

  it("says Not known yet, never a bare label, when the backend sent no verdict", () => {
    for (const none of [null, undefined, "UNKNOWN" as const]) {
      expect(renderToStaticMarkup(createElement(OarConversionLabel, { eligibility: none }))).toContain(
        "Not known yet",
      )
    }
  })
})
