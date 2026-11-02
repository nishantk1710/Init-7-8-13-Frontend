import { describe, expect, it } from "vitest"

import type { DataItem, FormulaField, PortfolioFigures } from "@/features/initiative-7/types/kpi-formulas"
import {
  changedKeys,
  differsFromDefault,
  draftFromFields,
  fieldsFromDraft,
  filterData,
  formatDelta,
  formulaFields,
  groupData,
  impactRows,
  sectionsFor,
  insertName,
} from "./kpi-formulas"

const FIELDS: FormulaField[] = [
  {
    key: "window_days",
    kpi: "stockout",
    label: "Window",
    kind: "setting",
    help: "",
    defaultValue: 90,
    value: 90,
    dataSet: "",
    helpers: [],
    example: "",
    minimum: 7,
    maximum: 730,
    needsRebuild: true,
  },
  {
    key: "at_risk",
    kpi: "stockout",
    label: "At risk when",
    kind: "condition",
    help: "",
    defaultValue: "stock_on_hand < stock_needed",
    value: "stock_on_hand < stock_needed",
    dataSet: "stockout",
    helpers: [],
    example: "stock_on_hand < stock_needed * 1.2",
    minimum: null,
    maximum: null,
    needsRebuild: false,
  },
]

describe("draft", () => {
  it("starts from what is in force, as text", () => {
    expect(draftFromFields(FIELDS)).toEqual({ window_days: "90", at_risk: "stock_on_hand < stock_needed" })
  })

  it("sends a setting as a number and a formula as typed", () => {
    expect(fieldsFromDraft(FIELDS, { window_days: " 60 ", at_risk: " a < b " })).toEqual({
      window_days: 60,
      at_risk: "a < b",
    })
  })

  it("sends a setting that is not a whole number as typed, for the backend to refuse in words", () => {
    expect(fieldsFromDraft(FIELDS, { window_days: "6o", at_risk: "a < b" }).window_days).toBe("6o")
    expect(fieldsFromDraft(FIELDS, { window_days: "", at_risk: "a < b" }).window_days).toBe("")
  })

  it("names what changed, ignoring spaces at the ends", () => {
    const draft = draftFromFields(FIELDS)
    expect(changedKeys(FIELDS, draft)).toEqual([])
    expect(changedKeys(FIELDS, { ...draft, at_risk: "  stock_on_hand < stock_needed " })).toEqual([])
    expect(changedKeys(FIELDS, { ...draft, window_days: "60" })).toEqual(["window_days"])
  })

  it("compares with the built-in default separately from what is in force", () => {
    const inForce = FIELDS.map((f) => (f.key === "window_days" ? { ...f, value: 60 } : f))
    expect(differsFromDefault(inForce, draftFromFields(inForce))).toEqual(["window_days"])
    expect(changedKeys(inForce, draftFromFields(inForce))).toEqual([])
  })
})

describe("insertName", () => {
  it.each([
    ["", "a", "a"],
    ["a <", "b", "a < b"],
    ["a * (", "b", "a * ( b"],
    ["a", "b", "a b"],
  ])("%j + %s", (current, name, expected) => {
    expect(insertName(current, name)).toBe(expected)
  })
})

describe("formatDelta", () => {
  const f = (n: number) => String(n)
  it("signs the change", () => {
    expect(formatDelta(10, 15, f)).toBe("+5")
    expect(formatDelta(15, 10, f)).toBe("−5")
    expect(formatDelta(10, 10, f)).toBe("no change")
  })
  it("has nothing to say when either side is not available", () => {
    expect(formatDelta(null, 3, f)).toBe("—")
    expect(formatDelta(3, null, f)).toBe("—")
  })
})

const DATA: DataItem[] = [
  { name: "unit_price", label: "unit price", description: "The replacement price of one unit.", group: "Price", unit: "money" },
  { name: "lead_time_days", label: "lead time (days)", description: "How long a new order takes to arrive.", group: "Price", unit: "days" },
  { name: "stock_on_hand", label: "stock on hand", description: "Unrestricted-use stock.", group: "Stock position", unit: "quantity" },
]

describe("filterData", () => {
  it("keeps everything for an empty search", () => {
    expect(filterData(DATA, "")).toEqual(DATA)
    expect(filterData(DATA, "   ")).toEqual(DATA)
  })

  it("matches the plain label, the name, the description and the group, in any case", () => {
    expect(filterData(DATA, "PRICE").map((d) => d.name)).toEqual(["unit_price", "lead_time_days"]) // group Price
    expect(filterData(DATA, "lead_time").map((d) => d.name)).toEqual(["lead_time_days"])
    expect(filterData(DATA, "arrive").map((d) => d.name)).toEqual(["lead_time_days"])
  })

  it("needs every word, wherever each one is found", () => {
    expect(filterData(DATA, "price unit").map((d) => d.name)).toEqual(["unit_price"])
    expect(filterData(DATA, "price stock")).toEqual([])
  })

  it("does not split a word on the letter s", () => {
    expect(filterData(DATA, "stock").map((d) => d.name)).toEqual(["stock_on_hand"])
  })
})

describe("groupData", () => {
  it("groups in the order the groups first appear", () => {
    expect(groupData(DATA).map((g) => [g.group, g.items.map((i) => i.name)])).toEqual([
      ["Price", ["unit_price", "lead_time_days"]],
      ["Stock position", ["stock_on_hand"]],
    ])
  })

  it("is empty for nothing", () => {
    expect(groupData([])).toEqual([])
  })
})

describe("formulaFields", () => {
  it("leaves out the plain numbers", () => {
    expect(formulaFields(FIELDS).map((f) => f.key)).toEqual(["at_risk"])
  })
})

describe("sectionsFor (the KPI cards / Charts toggle)", () => {
  const kpis = [
    { key: "stockout" as const, title: "High Stockout Risk", controls: ["High Stockout Risk card", "Stockout Risk Distribution chart", "Stockout risk by plant chart"] },
    { key: "excess" as const, title: "Excess Inventory Candidates", controls: ["Excess Inventory Candidates card", "Excess inventory by plant chart"] },
    { key: "working_capital" as const, title: "Working Capital Impact", controls: ["Working Capital Impact card"] },
    { key: "adoption" as const, title: "SAP Adoption", controls: ["Adopted recommendation card", "SAP adoption chart"] },
  ]

  it("lists one section per card, each naming only its card", () => {
    const cards = sectionsFor("cards", kpis)
    expect(cards.map((s) => s.title)).toEqual(["High Stockout Risk", "Excess Inventory Candidates", "Working Capital Impact", "SAP Adoption"])
    expect(cards.map((s) => s.controls)).toEqual([
      ["High Stockout Risk card"],
      ["Excess Inventory Candidates card"],
      ["Working Capital Impact card"],
      ["Adopted recommendation card"],
    ])
    expect(cards[0]?.infoId).toBe("stockoutRisk")
  })

  it("says in a card's words that its charts follow the same calculation, only when it has charts", () => {
    const cards = sectionsFor("cards", kpis)
    expect(cards[0]?.blurb).toContain("Its charts use the same calculation.")
    expect(cards[2]?.blurb).not.toContain("charts")
  })

  it("lists one section per calculation that has charts, titled by those charts", () => {
    const charts = sectionsFor("charts", kpis)
    expect(charts.map((s) => s.kpi)).toEqual(["stockout", "excess", "adoption"]) // working capital has no chart
    expect(charts[0]?.title).toBe("Stockout Risk Distribution · Stockout risk by plant")
    expect(charts[0]?.controls).toEqual(["Stockout Risk Distribution chart", "Stockout risk by plant chart"])
    expect(charts[0]?.blurb).toBe("These charts use the same calculation as the High Stockout Risk card, so changing it here changes both.")
    expect(charts[1]?.blurb).toContain("This chart uses")
  })

  it("opens each chart's own (i) popup", () => {
    expect(sectionsFor("charts", kpis).map((s) => s.infoId)).toEqual(["stockoutDistribution", "excessByPlant", "sapAdoption"])
  })

  it("lists nothing under Charts for a backend that names no charts", () => {
    expect(sectionsFor("charts", [{ key: "stockout", title: "High Stockout Risk", controls: [] }])).toEqual([])
  })
})

describe("impactRows (the Preview impact panel)", () => {
  const figures = (over: Partial<PortfolioFigures> = {}): PortfolioFigures => ({
    stockoutAtRisk: 2418,
    stockoutEvaluated: 45000,
    stockoutInsufficient: 0,
    excessCount: 100,
    excessOpportunity: 5000,
    workingCapital: -200,
    adoptionRate: 40,
    countedAsAdopted: 10,
    ...over,
  })

  it("shows at-risk and its share of the judged materials, with the change", () => {
    const rows = impactRows("stockout", figures(), figures({ stockoutAtRisk: 2532 }))
    expect(rows[0]).toMatchObject({ label: "Materials at risk", now: "2,418", next: "2,532", deltaText: "+114", tone: "bad" })
    expect(rows[1]?.label).toBe("% of judged materials")
    expect(rows[1]?.now).toBe("5.4%")
    expect(rows[1]?.next).toBe("5.6%")
    expect(rows[1]?.deltaText).toBe("+0.3%")
  })

  it("reads fewer at risk as good news and more cash freed as good news", () => {
    expect(impactRows("stockout", figures(), figures({ stockoutAtRisk: 2000 }))[0]?.tone).toBe("good")
    expect(impactRows("working_capital", figures(), figures({ workingCapital: 500 }))[0]?.tone).toBe("good")
    expect(impactRows("working_capital", figures(), figures({ workingCapital: -900 }))[0]?.tone).toBe("bad")
    expect(impactRows("adoption", figures(), figures({ adoptionRate: 55 }))[0]?.tone).toBe("good")
  })

  it("is neutral when nothing changed", () => {
    for (const kpi of ["stockout", "excess", "working_capital", "adoption"] as const) {
      for (const row of impactRows(kpi, figures(), figures())) {
        expect(row.tone).toBe("neutral")
        expect(row.deltaText).toBe("no change")
      }
    }
  })

  it("never shows a share when nothing could be judged, and never treats missing as zero", () => {
    const none = figures({ stockoutAtRisk: 0, stockoutEvaluated: 0 })
    const share = impactRows("stockout", none, none)[1]
    expect(share).toMatchObject({ now: "Not yet measured", next: "Not yet measured", delta: null, deltaText: "—", tone: "neutral" })
    const money = impactRows("excess", figures({ excessOpportunity: null }), figures())[1]
    expect(money).toMatchObject({ now: "Not available", delta: null, deltaText: "—" })
    expect(impactRows("adoption", figures({ adoptionRate: null }), figures({ adoptionRate: 12.5 }))[0]).toMatchObject({
      now: "Not yet measured",
      next: "12.5%",
    })
  })

  it("has one row for working capital and two for every other calculation", () => {
    expect(impactRows("working_capital", figures(), figures())).toHaveLength(1)
    for (const kpi of ["stockout", "excess", "adoption"] as const) expect(impactRows(kpi, figures(), figures())).toHaveLength(2)
  })
})
