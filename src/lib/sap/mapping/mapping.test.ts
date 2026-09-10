import { describe, expect, it } from "vitest"
import { SAP_CONTRACT } from "../contract/generated-contract"
import { buildGapReport, summarise } from "./gap-report"
import { RECOMMENDATION_SOURCES, mapRecommendation } from "./initiative-7"
import { REPAIR_CHAIN_SOURCES, mapRepairChain } from "./initiative-8"
import { LEDGER_LINE_SOURCES, mapLedgerLine } from "./initiative-13"
import { loadPlatform } from "./platform-source"
import type { FieldSource } from "./field-source"

const allSources: [string, FieldSource][] = [
  ...Object.entries(RECOMMENDATION_SOURCES),
  ...Object.entries(REPAIR_CHAIN_SOURCES),
  ...Object.entries(LEDGER_LINE_SOURCES),
] as [string, FieldSource][]

describe("declared SAP sources are real", () => {
  // Catches the Value_old-vs-ValueOld class of error at the mapping layer, and
  // catches a mapper still pointing at a field SAP has since removed.
  it.each(allSources.filter(([, s]) => s.from === "sap" || s.from === "blocked"))(
    "%s names an entity set that exists",
    (_field, source) => {
      const entitySet = (source as { entitySet: string }).entitySet
      expect(SAP_CONTRACT[entitySet], `${entitySet} is not in the contract`).toBeDefined()
    }
  )

  it("every named property exists on its entity set", () => {
    const problems: string[] = []
    for (const [field, source] of allSources) {
      if (source.from !== "sap" && source.from !== "blocked") continue
      const property = (source as { property?: string }).property
      if (!property) continue
      const contract = SAP_CONTRACT[source.entitySet]
      const available = new Set(contract.properties.map((p) => p.name))
      // A few declarations name several properties at once, e.g. "Minbe/Eisbe/Mabst".
      for (const name of property.split("/")) {
        if (!available.has(name)) problems.push(`${field}: ${source.entitySet}.${name} does not exist`)
      }
    }
    expect(problems).toEqual([])
  })
})

describe("declared platform sources are real", () => {
  it("every named platform column exists in its CSV", () => {
    const problems: string[] = []
    for (const [field, source] of allSources) {
      if (source.from !== "platform") continue
      const rows = loadPlatform(source.file as Parameters<typeof loadPlatform>[0])
      const available = new Set(Object.keys(rows[0] ?? {}))
      for (const name of source.column.split("/")) {
        if (!available.has(name)) problems.push(`${field}: ${source.file}.${name} does not exist`)
      }
    }
    expect(problems).toEqual([])
  })
})

describe("the gap report", () => {
  const rows = buildGapReport()

  it("covers every field of all three view models", () => {
    expect(rows).toHaveLength(
      Object.keys(RECOMMENDATION_SOURCES).length +
        Object.keys(REPAIR_CHAIN_SOURCES).length +
        Object.keys(LEDGER_LINE_SOURCES).length
    )
  })

  it("finds real gaps — this SHOULD be non-zero, and shrinking it is the work", () => {
    const summary = summarise(rows)
    expect(summary.gap).toBeGreaterThan(0)
    expect(summary.blocked).toBeGreaterThan(0)
  })

  it("every gap carries an explanation, not just a label", () => {
    for (const row of rows.filter((r) => r.source === "gap")) {
      expect(row.detail.length, `${row.initiative}.${row.field} has no explanation`).toBeGreaterThan(40)
    }
  })
})

describe("mappers produce the view models the UI already expects", () => {
  it("maps a recommendation from platform + SAP rows", () => {
    const recommendations = loadPlatform("inventory_recommendations")
    const row = recommendations[0]
    const mapped = mapRecommendation(row, {
      recommendations,
      materials: new Map([[row.Matnr, { Matnr: row.Matnr, Mstae: "" }]]),
      materialPlants: new Map([[`${row.Matnr}|${row.Werks}`, { Minbe: 36.087, Eisbe: 6.202, Mabst: 152.999, Plifz: 58 }]]),
      descriptions: new Map([[row.Matnr, "Gearbox Bearing 55KW SKF"]]),
      approvals: [],
    })

    expect(mapped.id).toBe(row.recommendation_id)
    expect(mapped.material.description).toBe("Gearbox Bearing 55KW SKF")
    // Current values come from SAP, recommended from the platform.
    expect(mapped.current.rop).toBe(36.087)
    expect(mapped.recommended.rop).toBe(Number(row.recommended_rop))
    expect(mapped.leadTimeDays).toBe(58)
  })

  it("leaves blocked fields empty rather than inventing them", () => {
    const recommendations = loadPlatform("inventory_recommendations")
    const mapped = mapRecommendation(recommendations[0], {
      recommendations,
      materials: new Map(),
      materialPlants: new Map(),
      descriptions: new Map(),
      approvals: [],
    })
    // MaterialValuationSet returns zero rows live, so there is no price to show.
    expect(mapped.unitPrice).toBe(0)
    expect(mapped.consumptionHistory).toEqual([])
    // And the ML metadata nothing produces stays visibly empty.
    expect(mapped.championChallenger.champion.name).toBe("")
    expect(mapped.factors).toEqual([])
  })

  it("maps a repair chain, joining the vendor name through SAP", () => {
    const cases = loadPlatform("repair_cases")
    const row = cases[0]
    const mapped = mapRepairChain(
      row,
      {
        cases,
        attestations: loadPlatform("repair_attestations"),
        materialPlants: new Map([[`${row.Matnr}|${row.Werks}`, { Minbe: 12, Plifz: 30 }]]),
        descriptions: new Map([[row.Matnr, "Motor 90KW"]]),
        purchaseOrders: new Map([[row.repair_po, { Lifnr: "0000100234" }]]),
        vendors: new Map([["0000100234", { Name1: "Springbok Rewind Services" }]]),
        purchaseOrderItems: new Map([[`${row.repair_po}|${row.repair_po_item}`, { Netwr: "18450.00" }]]),
        stockOnHand: new Map([[`${row.Matnr}|${row.Werks}`, 4]]),
      },
      new Date("2026-09-08")
    )

    expect(mapped.id).toBe(row.case_id)
    expect(mapped.vendor).toBe("Springbok Rewind Services")
    // Netwr is Edm.String — parsed, not coerced by shape.
    expect(mapped.repairCost).toBe(18450)
    expect(mapped.stockOnHand).toBe(4)
    expect(mapped.reorderPoint).toBe(12)
  })

  it("maps a ledger line, standing in for the plan's own figures when no reservation is joined", () => {
    const platform = {
      plans: loadPlatform("consumption_plans"),
      utilisation: new Map(
        loadPlatform("utilisation_status").map((r) => [`${r.Rsnum}|${r.Rspos}`, r])
      ),
      exceptions: loadPlatform("exceptions"),
      descriptions: new Map<string, string>(),
    }
    const plan = platform.plans[0]
    const mapped = mapLedgerLine(plan, platform, new Date("2026-09-08"))

    expect(mapped.id).toBe(plan.plan_id)
    expect(mapped.reservation.documentNumber).toBe(plan.Rsnum)
    // No `reservations` map was passed at all, so the plan's own quantity
    // stands in — the same fallback used when a specific plan's key just
    // isn't present in a map that was passed. ReservationItemSet itself has
    // been live since the 09-Sep 2026 sweep (§1.3).
    expect(mapped.qtyRequested).toBe(Number(plan.planned_quantity))
    expect(mapped.qtyIssued).toBe(0)
  })

  it("prefers the real reservation when SAP finally has one", () => {
    const platform = {
      plans: loadPlatform("consumption_plans"),
      utilisation: new Map<string, ReturnType<typeof loadPlatform>[number]>(),
      exceptions: [],
      descriptions: new Map<string, string>(),
      reservations: new Map(),
    }
    const plan = platform.plans[0]
    platform.reservations.set(`${plan.Rsnum}|${plan.Rspos}`, {
      Bdmng: 7,
      Enmng: 3,
      Meins: "EA",
      Bdter: new Date("2026-04-01"),
    })

    const mapped = mapLedgerLine(plan, platform, new Date("2026-09-08"))
    expect(mapped.qtyRequested).toBe(7)
    expect(mapped.qtyIssued).toBe(3)
    expect(mapped.plannedConsumptionDate).toBe("2026-04-01")
  })
})
