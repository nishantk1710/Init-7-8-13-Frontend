// Clicking a Min-Max to OAR row opens why it is recommended and its consumption chart.
//
// The chart's data is a pure function, tested directly. The components cannot be rendered in this suite's node
// environment, so what the table, the panel and the chart promise is checked from their source, as the other
// Min-Max to OAR tests do.

import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

import { chartPoints } from "@/features/initiative-7/components/min-max-to-oar-chart"
import { REVERSE_REASONS, type ApiReverseConsumption } from "@/features/initiative-7/types/reverse-conversion"

const SRC = join(__dirname, "..", "..", "..")
const read = (relative: string) => readFileSync(join(SRC, relative), "utf8")
const I7 = "features/initiative-7"

function months(start: [number, number], count: number, quantities: Record<string, string> = {}): ApiReverseConsumption["months"] {
  return Array.from({ length: count }, (_, i) => {
    const index = start[0] * 12 + (start[1] - 1) + i
    const month = `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`
    return { month, net_issued_quantity: quantities[month] ?? "0", issue_count: quantities[month] ? 1 : 0, reversal_count: 0 }
  })
}

const consumption = (quantities: Record<string, string> = {}): ApiReverseConsumption => ({
  material: "1000051",
  plant: "1500",
  anchor_month: "2026-10",
  latest_window_start: "2025-11",
  months: months([2024, 11], 24, quantities),
})

describe("the chart's data", () => {
  it("is one point per month, oldest first, 24 of them", () => {
    const points = chartPoints(consumption())
    expect(points).toHaveLength(24)
    expect(points[0].month).toBe("2024-11")
    expect(points[23].month).toBe("2026-10")
  })

  it("marks exactly the latest 12 months, the window the rule counts", () => {
    const points = chartPoints(consumption())
    expect(points.filter((p) => p.latest)).toHaveLength(12)
    expect(points.find((p) => p.latest)?.month).toBe("2025-11")
    expect(points.slice(0, 12).every((p) => !p.latest)).toBe(true)
  })

  it("reads decimal strings as numbers, keeps gaps as zero, and never draws a negative bar", () => {
    const points = chartPoints(consumption({ "2026-03": "4.500", "2026-05": "-2" }))
    expect(points.find((p) => p.month === "2026-03")).toMatchObject({ quantity: 4.5, issues: 1 })
    expect(points.find((p) => p.month === "2026-04")?.quantity).toBe(0)
    expect(points.find((p) => p.month === "2026-05")?.quantity).toBe(0)
  })

  it("labels a month with a short name and year", () => {
    expect(chartPoints(consumption())[0].label).toBe("Nov '24")
  })
})

describe("the table", () => {
  const table = read(`${I7}/components/min-max-to-oar-table.tsx`)

  it("opens a row's detail when it is clicked, and closes it when it is clicked again", () => {
    expect(table).toContain("onClick={() => setOpenKey(isOpen ? null : key)}")
    expect(table).toContain("aria-expanded={isOpen}")
    expect(table).toContain("<MinMaxToOarDetail row={row} anchorMonth={anchorMonth} />")
  })

  it("opens like the OAR and Stock item table: a chevron column, then a full-width open row", () => {
    expect(table).toContain('<TableHead className="w-8" />')
    expect(table).toContain("<ChevronDown")
    expect(table).toContain("<ChevronRight")
    expect(table).toContain("<TableCell colSpan={COLUMN_COUNT - 1}")
    expect(table).toContain("bg-muted/30 py-4 whitespace-normal")
  })

  it("keeps one row open at a time", () => {
    expect(table).toContain("const [openKey, setOpenKey] = useState<string | null>(null)")
  })

  it("has no Category column, and has an OAR conversion (Eligible / Not eligible) column and a Confidence column", () => {
    expect(table).not.toContain("<TableHead>Category</TableHead>")
    expect(table).toContain("OAR conversion</TableHead>")
    expect(table).toContain('row.conversion_eligibility === "eligible" ? "Eligible" : "Not eligible"')
    expect(table).toContain("<ArrowRightLeft")
    expect(table.indexOf("OAR conversion</TableHead>")).toBeLessThan(table.indexOf('title="How sure the rule'))
  })

  it("the Reason column states the reason in the planner's words", () => {
    expect(table).toContain("{row.reason_label}")
    expect(table).toContain("{row.explanation}")
  })
})

describe("the panel", () => {
  const detail = read(`${I7}/components/min-max-to-oar-detail.tsx`)

  it("is laid out like the OAR and Stock item rows: two columns, the consumption history on the left", () => {
    expect(detail).toContain('className="grid grid-cols-1 gap-4 lg:grid-cols-2"')
    expect(detail).toContain("Consumption history (last 24 months)")
    expect(detail).toContain("<ConsumptionChart consumption={data} />")
    expect(detail.indexOf("Consumption history")).toBeLessThan(detail.indexOf("Move from Min-Max to OAR ordering"))
  })

  it("has a Reason section with the reason and its explanation, and how sure the rule is, as the OAR row does", () => {
    expect(detail).toContain("Move from Min-Max to OAR ordering")
    expect(detail).toContain(">Reason</dt>")
    expect(detail).toContain("{row.reason_label}")
    expect(detail).toContain("{row.explanation}")
    expect(detail).toContain("confidence</StatusBadge>")
    expect(detail.indexOf("Issues, last 12 months")).toBeLessThan(detail.indexOf(">Reason</dt>"))
  })

  it("uses the OAR row's own card, heading and fact styles", () => {
    expect(detail).toContain("rounded-lg border border-border bg-background p-3")
    expect(detail).toContain("text-xs font-medium tracking-[0.5px] text-muted-foreground uppercase")
    expect(detail).toContain("border-t border-border pt-3")
  })

  it("asks for the consumption only for the row that is open, to the list's own anchor", () => {
    expect(detail).toContain("useReverseConsumption(row.material, row.plant, anchorMonth)")
  })

  it("says whether the material can move to OAR or stays on Min-Max", () => {
    expect(detail).toContain('"Can move to OAR" : "Stays on Min-Max"')
  })

  it("says it is only a suggestion and writes nothing to SAP", () => {
    expect(detail).toContain("A suggestion only")
    expect(detail).not.toMatch(/apiPost|method:\s*"(POST|PUT|PATCH|DELETE)"/)
  })
})

describe("the chart", () => {
  const chart = read(`${I7}/components/min-max-to-oar-chart.tsx`)

  it("uses CSS-variable colours only", () => {
    expect(chart).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(chart).toContain('"var(--chart-1)"')
  })

  it("explains what the two colours are", () => {
    expect(chart).toContain("Latest 12 months (what the rule counts)")
    expect(chart).toContain("The 12 months before")
  })
})

describe("the reasons on screen", () => {
  it("say why a material is converted, in the planner's words", () => {
    const labels = REVERSE_REASONS.map((r) => r.label)
    expect(labels).toContain("Zero issues in 24 months and never moved")
    expect(labels).toContain("Zero issues in 24 months but moved before")
    expect(labels).toContain("Lead time unknown or above 90 days")
    expect(labels).toContain("Zero issues in latest 12 complete months but used previously")
    expect(labels).toContain("Obsolete")
  })

  it("offer only the reasons of Convert to OAR, the only rows this view lists", () => {
    expect(REVERSE_REASONS.map((r) => r.code)).toEqual([
      "sparse_recurring_demand",
      "unknown_criticality",
      "lead_time",
      "lapsed",
      "borderline_frequency",
      "stale_last_movement",
      "lifetime_criterion",
      "inconsistent_movement",
      "never_moved",
      "zero_use_24m",
      "obsolete_criticality",
    ])
  })
})
