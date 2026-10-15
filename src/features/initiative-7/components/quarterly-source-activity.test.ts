// The Quarterly Report's source-activity section, as a reader sees it.
//
// Rendered to static markup with react-dom/server (this project's vitest runs without a DOM). The promises
// worth pinning: the three months of the quarter are all there, a confirmed zero reads "0" while a month the
// data does not cover reads a dash (never 0), and the notes about output dates and quantities are shown.

import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { QuarterlySourceActivity } from "./quarterly-source-activity"
import type { ApiSourceActivityMonth, ApiSourceActivitySection } from "@/features/initiative-7/types/api"
import { countOrDash, sourceMonthLabel, sourceStatusTone, SOURCE_STATUS_LABEL } from "@/features/initiative-7/utils/source-activity"

export function sourceActivityFixture(overrides: Partial<ApiSourceActivitySection> = {}): ApiSourceActivitySection {
  const months: ApiSourceActivityMonth[] = [
    {
      month: "2026-07-01", status: "AVAILABLE", material_plants_with_movements: 2, material_plants_with_demand: 2,
      materials_with_movements: 2, issue_transactions: 5, reversal_transactions: 0,
    },
    {
      month: "2026-08-01", status: "NO_ACTIVITY", material_plants_with_movements: 0, material_plants_with_demand: 0,
      materials_with_movements: 0, issue_transactions: 0, reversal_transactions: 0,
    },
    {
      month: "2026-09-01", status: "NOT_COVERED", material_plants_with_movements: null, material_plants_with_demand: null,
      materials_with_movements: null, issue_transactions: null, reversal_transactions: null,
    },
  ]
  return {
    months,
    totals: {
      material_plants_with_movements: 2, material_plants_with_demand_in_any_month: 2, materials_with_movements: 2,
      issue_transactions: 5, reversal_transactions: 0, months_available: 1, months_no_activity: 1, months_not_covered: 1,
    },
    staged_data_first_month: "2025-01-01",
    staged_data_last_month: "2026-08-01",
    quantity_status: "NOT_AVAILABLE",
    quantity_note: "Consumption quantities are not reported for the staged source data yet.",
    latest_recommendation_generated_at: "2026-10-14T09:00:00Z",
    recommendations_generated_in_period: 0,
    output_note: "No recommendations were generated inside this period. The latest were generated on 2026-10-14.",
    ...overrides,
  }
}

const render = (section: ApiSourceActivitySection) =>
  renderToStaticMarkup(createElement(QuarterlySourceActivity, { section }))

/** The markup of one month's table row. */
function row(markup: string, label: string): string {
  const match = markup.match(new RegExp(`${label}[\\s\\S]*?</tr>`))
  if (!match) throw new Error(`no row for ${label}`)
  return match[0]
}

describe("the three months of the quarter", () => {
  const markup = render(sourceActivityFixture())

  it("are all listed by name", () => {
    for (const month of ["July 2026", "August 2026", "September 2026"]) expect(markup).toContain(month)
  })

  it("say, per month, whether the data is present, a confirmed zero, or not in the data", () => {
    expect(markup).toContain("Data present")
    expect(markup).toContain("No activity (confirmed)")
    expect(markup).toContain("Not in the data")
  })

  it("show a confirmed zero as 0 and a month the data does not cover as dashes, never zeros", () => {
    const august = row(markup, "August 2026")
    expect(august).toContain(">0<")
    const september = row(markup, "September 2026")
    expect(september).toContain("—")
    expect(september).not.toContain(">0<")
  })

  it("shows the counts of a month that has data", () => {
    const july = row(markup, "July 2026")
    expect(july).toContain(">2<")
    expect(july).toContain(">5<")
  })
})

describe("the notes", () => {
  it("separates the source months from the output dates, so a snapshot is not mistaken for this period", () => {
    const markup = render(sourceActivityFixture())
    expect(markup).toContain("No recommendations were generated inside this period")
    expect(markup).toContain("The latest were generated on 2026-10-14")
  })

  it("says why no consumption quantity is shown", () => {
    expect(render(sourceActivityFixture())).toContain("Consumption quantities are not reported")
  })

  it("never prints a quantity column", () => {
    const markup = render(sourceActivityFixture())
    expect(markup).not.toMatch(/Quantity<\/th>/i)
  })
})

describe("a quarter with no source data at all", () => {
  it("shows dashes in every month and no invented zero", () => {
    const section = sourceActivityFixture({
      months: ["2026-07-01", "2026-08-01", "2026-09-01"].map((month) => ({
        month, status: "NO_SOURCE_DATA" as const, material_plants_with_movements: null, material_plants_with_demand: null,
        materials_with_movements: null, issue_transactions: null, reversal_transactions: null,
      })),
      totals: {
        material_plants_with_movements: 0, material_plants_with_demand_in_any_month: 0, materials_with_movements: 0,
        issue_transactions: 0, reversal_transactions: 0, months_available: 0, months_no_activity: 0, months_not_covered: 3,
      },
      staged_data_first_month: null,
      staged_data_last_month: null,
    })
    const markup = render(section)
    expect(markup).toContain("No source data")
    for (const month of ["July 2026", "August 2026", "September 2026"]) {
      expect(row(markup, month)).toContain("—")
      expect(row(markup, month)).not.toContain(">0<")
    }
    expect(markup).toContain("0 of 3 months with data")
  })
})

describe("the formatting helpers", () => {
  it("labels months and leaves a non-date alone", () => {
    expect(sourceMonthLabel("2026-07-01")).toBe("July 2026")
    expect(sourceMonthLabel("2027-01-01")).toBe("January 2027")
    expect(sourceMonthLabel("not-a-date")).toBe("not-a-date")
  })

  it("keeps 0 as 0 and turns only a missing value into a dash", () => {
    expect(countOrDash(0)).toBe("0")
    expect(countOrDash(null)).toBe("—")
    expect(countOrDash(undefined)).toBe("—")
    expect(countOrDash(12345)).toBe("12,345")
  })

  it("treats data and a confirmed zero as settled and the rest as needing attention", () => {
    expect(sourceStatusTone("AVAILABLE")).toBe("success")
    expect(sourceStatusTone("NO_ACTIVITY")).toBe("default")
    expect(sourceStatusTone("NOT_COVERED")).toBe("warning")
    expect(sourceStatusTone("NO_SOURCE_DATA")).toBe("warning")
    expect(Object.keys(SOURCE_STATUS_LABEL)).toHaveLength(4)
  })
})
