import { describe, expect, it } from "vitest"

import type { DeclarationRecord } from "@/features/initiative-8/types/repair"
import {
  NO_DECLARATION_FILTERS,
  declarationLinkOf,
  declarationRowsToCsv,
  filterDeclarations,
  summariseDeclarations,
} from "@/features/initiative-8/utils/declaration-log"

function record(overrides: Partial<DeclarationRecord> = {}): DeclarationRecord {
  return {
    id: "ATT-1",
    material: {
      materialId: "8000005632",
      materialCode: "8000005632",
      description: "Thickener Rake Seal Kit",
    },
    plant: { plantId: "1300", name: "Black Mountain Mining" },
    quantity: 1,
    condition: "Repairable",
    faultCategory: "SEAL_LEAK",
    conditionDescription: "Seal weeping at the gland.",
    declaredBy: "tester",
    declaredAt: "2026-10-09T08:00:00Z",
    repairLineIds: [],
    ...overrides,
  }
}

describe("declarationLinkOf", () => {
  it("reads a repairable part with no repair line as awaiting its PO", () => {
    expect(declarationLinkOf(record())).toBe("AWAITING_PO")
  })

  it("reads a repairable part a repair line picked up as matched", () => {
    expect(declarationLinkOf(record({ repairLineIds: ["4500001234-00010"] }))).toBe("MATCHED")
  })

  it("reads a part not worth repairing, with no repair line, as not for repair", () => {
    for (const condition of ["Beyond Economical Repair", "Scrap"] as const) {
      expect(declarationLinkOf(record({ condition }))).toBe("NOT_FOR_REPAIR")
    }
  })

  it("reads a part not worth repairing that a repair line took as sent anyway", () => {
    expect(
      declarationLinkOf(record({ condition: "Scrap", repairLineIds: ["4500001234-00010"] })),
    ).toBe("SENT_ANYWAY")
  })

  it("reads a replaced declaration as amended, whatever it said", () => {
    expect(
      declarationLinkOf(record({ supersededBy: "ATT-2", repairLineIds: ["4500001234-00010"] })),
    ).toBe("AMENDED")
  })
})

describe("filterDeclarations", () => {
  const records = [
    record({ id: "A" }),
    record({
      id: "B",
      plant: { plantId: "1500", name: "Gamsberg" },
      condition: "Scrap",
      material: { materialId: "8000006001", materialCode: "8000006001", description: "Pump Impeller" },
    }),
  ]

  it("matches everything with no filter set", () => {
    expect(filterDeclarations(records, NO_DECLARATION_FILTERS)).toHaveLength(2)
  })

  it("filters by plant, condition and repair line status", () => {
    expect(filterDeclarations(records, { ...NO_DECLARATION_FILTERS, plant: "1500" })).toEqual([records[1]])
    expect(filterDeclarations(records, { ...NO_DECLARATION_FILTERS, condition: "Repairable" })).toEqual([
      records[0],
    ])
    expect(filterDeclarations(records, { ...NO_DECLARATION_FILTERS, link: "NOT_FOR_REPAIR" })).toEqual([
      records[1],
    ])
  })

  it("searches material number and description, ignoring case", () => {
    expect(filterDeclarations(records, { ...NO_DECLARATION_FILTERS, search: "impeller" })).toEqual([records[1]])
    expect(filterDeclarations(records, { ...NO_DECLARATION_FILTERS, search: " 5632 " })).toEqual([records[0]])
  })
})

describe("summariseDeclarations", () => {
  it("counts current declarations only, and splits them by where they stand", () => {
    const summary = summariseDeclarations([
      record({ id: "A" }),
      record({ id: "B", repairLineIds: ["4500-10"] }),
      record({ id: "C", condition: "Scrap" }),
      record({ id: "D", condition: "Beyond Economical Repair", repairLineIds: ["4600-10"] }),
      record({ id: "E", supersededBy: "A" }),
    ])

    expect(summary).toEqual({
      current: 4,
      repairable: 2,
      notRepairable: 2,
      awaitingPo: 1,
      notForRepair: 1,
      sentAnyway: 1,
    })
  })
})

describe("declarationRowsToCsv", () => {
  it("exports blanks for absent values, never a placeholder", () => {
    const [row] = declarationRowsToCsv([record()])
    expect(row[10]).toBe("") // serial number
    expect(row[11]).toBe("") // evidence
    expect(row[12]).toBe("Awaiting repair PO")
    expect(row[13]).toBe("") // repair lines
  })
})
