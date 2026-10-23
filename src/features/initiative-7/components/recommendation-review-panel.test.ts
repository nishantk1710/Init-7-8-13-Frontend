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

const BASE: Recommendation = {
  id: "rec-test",
  material: { materialId: "000000000000000001", materialCode: "TEST-1", description: "Test material" },
  plantId: "1300",
  circuit: "Unassigned",
  criticality: "Medium",
  demandPattern: "Smooth",
  risk: "low",
  status: "Pending Review",
  current: { rop: 5, safetyStock: 2, maxStock: 12 },
  recommended: { rop: 4, safetyStock: 2, maxStock: 8 },
  avgDailyConsumption: 0.5,
  leadTimeDays: 30,
  leadTimeVarianceDays: 5,
  serviceLevelTarget: 0.95,
  unitPrice: 100,
  annualConsumption: 120,
  workingCapitalImpact: 400,
  consumptionHistory: [
    { period: "Jan", qty: 10 },
    { period: "Feb", qty: 12 },
  ],
  factors: [{ label: "Demand", detail: "Steady" }],
  championChallenger: {
    champion: { name: "Champion", description: "Baseline", accuracyPct: 80 },
    challenger: { name: "Challenger", description: "Alternative", accuracyPct: 85 },
    selected: "champion",
    rationale: "Test",
  },
  workflow: [],
  generatedAt: "2026-01-01T00:00:00Z",
}

function rec(overrides: Partial<Recommendation>): Recommendation {
  return {
    ...BASE,
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

  it("is gone when the series is only zeros — the backend sends a month with no usage as a 0", () => {
    const zeros = Array.from({ length: 12 }, (_, i) => ({ period: `M${i + 1}`, qty: 0 }))
    const markup = render(rec({ consumptionHistory: zeros }))
    expect(markup).not.toContain("Consumption history &amp; forecast")
  })

  it("is gone when the only usage is older than the last 12 months", () => {
    const older = [{ period: "Old", qty: 9 }, ...Array.from({ length: 12 }, (_, i) => ({ period: `M${i + 1}`, qty: 0 }))]
    const markup = render(rec({ consumptionHistory: older }))
    expect(markup).not.toContain("Consumption history &amp; forecast")
  })

  it("is there when any one of the last 12 months has usage", () => {
    const some = Array.from({ length: 12 }, (_, i) => ({ period: `M${i + 1}`, qty: i === 3 ? 2 : 0 }))
    const markup = render(rec({ consumptionHistory: some }))
    expect(markup).toContain("Consumption history &amp; forecast")
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

describe("the Min-Max section's usage facts", () => {
  const section = (oar: Partial<OarConversionInfo>) => render(rec({ oarConversion: { ...OAR, ...oar } }))

  it("shows Times issued and Usage pattern when both are there", () => {
    const markup = section({ consumptionCount12m: 6, demandClass: "INTERMITTENT" })
    expect(markup).toContain("Times issued, last 12 months")
    expect(markup).toContain("Usage pattern")
    expect(markup).toContain("INTERMITTENT")
  })

  it("leaves out a count of 0 and an unknown count", () => {
    expect(section({ consumptionCount12m: 0 })).not.toContain("Times issued, last 12 months")
    expect(section({ consumptionCount12m: null })).not.toContain("Times issued, last 12 months")
  })

  it("leaves out a usage pattern that was never worked out", () => {
    expect(section({ demandClass: "UNCLASSIFIED" })).not.toContain("Usage pattern")
    expect(section({ demandClass: null })).not.toContain("Usage pattern")
  })

  it("drops the whole facts row, and keeps the badge and the Reason, when there is nothing to show", () => {
    const markup = section({ consumptionCount12m: 0, demandClass: "UNCLASSIFIED" })
    expect(markup).not.toContain("Times issued, last 12 months")
    expect(markup).not.toContain("Usage pattern")
    expect(markup).not.toContain("Not enough history")
    expect(markup).toContain("Move from OAR to Min-Max ordering")
    expect(markup).toContain("Used 14 times in the last 12 months.")
  })
})
