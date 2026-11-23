// The Total OAR card shows positions (material x plant) as the figure and the
// distinct materials among them on the line under it (22-Nov-2026). A material
// OAR at both plants is two positions but one material.

import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { KpiSummary, uniqueMaterialsLine } from "@/features/initiative-13/components/kpi-summary"
import type { I13Summary } from "@/lib/api/i13"

const summary: I13Summary = {
  totalOarPositions: 13543,
  uniqueOarMaterials: 13513,
  fastMovingCount: 1000,
  slowMovingCount: 2000,
  nonMovingCount: 10543,
  grNotIssued30DayCount: 0,
  planBreachCount: 0,
  noPlanCount: 0,
  reclassificationCandidateCount: 0,
  valuationIsMocked: false,
  referencePlanCount: 0,
}

describe("Total OAR card", () => {
  it("shows the positions as the figure and the unique materials under it", () => {
    const html = renderToStaticMarkup(createElement(KpiSummary, { summary }))
    expect(html).toContain("Total OAR positions")
    expect(html).toContain("13,543")
    expect(html).toContain("13,513 unique materials")
    expect(html).not.toContain("Total OAR materials")
  })

  it("says nothing about unique materials when the backend does not send them", () => {
    const html = renderToStaticMarkup(createElement(KpiSummary, { summary: { ...summary, uniqueOarMaterials: null } }))
    expect(html).toContain("13,543")
    expect(html).not.toContain("unique")
  })

  it("words one material in the singular", () => {
    expect(uniqueMaterialsLine(1)).toBe("1 unique material")
    expect(uniqueMaterialsLine(0)).toBe("0 unique materials")
    expect(uniqueMaterialsLine(null)).toBeUndefined()
  })
})
