import { describe, expect, it } from "vitest"
import { toODataFilter } from "./odata-filter"
import { FIELD_ENTITY_SET } from "./config"
import type { ScopeRule } from "./types"

describe("toODataFilter — single conditions", () => {
  it("eq", () => {
    expect(toODataFilter({ field: "Mstae", op: "eq", value: "01" }, "MaterialSet")).toBe("Mstae eq '01'")
  })

  it("ne", () => {
    expect(toODataFilter({ field: "Mstae", op: "ne", value: "01" }, "MaterialSet")).toBe("Mstae ne '01'")
  })

  it("startsWith uses OData v2 function syntax", () => {
    expect(toODataFilter({ field: "Matkl", op: "startsWith", value: "80" }, "MaterialSet")).toBe(
      "startswith(Matkl,'80')"
    )
  })

  it("in with several values or-joins them — the real §1.6(b) scope filter", () => {
    const rule: ScopeRule = { field: "Dismm", op: "in", values: ["ND", "PD"] }
    expect(toODataFilter(rule, "MaterialPlantSet")).toBe("(Dismm eq 'ND' or Dismm eq 'PD')")
  })

  it("in with one value needs no or-wrapping content beyond the single eq", () => {
    const rule: ScopeRule = { field: "Dismm", op: "in", values: ["ND"] }
    expect(toODataFilter(rule, "MaterialPlantSet")).toBe("(Dismm eq 'ND')")
  })

  it("notIn with one value pushes down as ne", () => {
    const rule: ScopeRule = { field: "Dismm", op: "notIn", values: ["VB"] }
    expect(toODataFilter(rule, "MaterialPlantSet")).toBe("Dismm ne 'VB'")
  })

  it("notIn with 0 values is vacuous (matches everything) -> no filter needed", () => {
    const rule: ScopeRule = { field: "Dismm", op: "notIn", values: [] }
    expect(toODataFilter(rule, "MaterialPlantSet")).toBeUndefined()
  })

  it("notIn with 2+ values is NOT pushed down — this SAP gateway silently ignores and-chained ne (see phase_summary.md Phase 0)", () => {
    const rule: ScopeRule = { field: "Dismm", op: "notIn", values: ["VB", "ND"] }
    expect(toODataFilter(rule, "MaterialPlantSet")).toBeUndefined()
  })

  it("a single-quote in a literal is escaped by doubling, per OData v2", () => {
    const rule: ScopeRule = { field: "Matkl", op: "eq", value: "O'BRIEN" }
    expect(toODataFilter(rule, "MaterialSet")).toBe("Matkl eq 'O''BRIEN'")
  })

  it("a condition on a field belonging to a different entity set is vacuous -> no filter needed there", () => {
    const rule: ScopeRule = { field: "Dismm", op: "eq", value: "PD" }
    expect(toODataFilter(rule, "MaterialSet")).toBeUndefined()
  })
})

describe("toODataFilter — and/or combinations", () => {
  const oarLike: ScopeRule = {
    and: [
      { field: "Dismm", op: "in", values: ["ND", "PD"] },
      { field: "Mstae", op: "ne", value: "01" },
    ],
  }

  it("the two-entity AND splits cleanly, one clause per entity set", () => {
    expect(toODataFilter(oarLike, "MaterialPlantSet")).toBe("(Dismm eq 'ND' or Dismm eq 'PD')")
    expect(toODataFilter(oarLike, "MaterialSet")).toBe("Mstae ne '01'")
  })

  it("an AND with an unrepresentable branch drops it (safe: only widens, predicate.ts narrows back)", () => {
    const rule: ScopeRule = {
      and: [
        { field: "Dismm", op: "notIn", values: ["VB", "ND"] }, // unrepresentable
        { field: "Mstae", op: "ne", value: "01" },
      ],
    }
    expect(toODataFilter(rule, "MaterialSet")).toBe("Mstae ne '01'")
  })

  it("an OR spanning two entity sets cannot be safely pushed down to either one", () => {
    const rule: ScopeRule = {
      or: [
        { field: "Dismm", op: "eq", value: "PD" },
        { field: "Mstae", op: "eq", value: "01" },
      ],
    }
    expect(toODataFilter(rule, "MaterialPlantSet")).toBeUndefined()
    expect(toODataFilter(rule, "MaterialSet")).toBeUndefined()
  })

  it("an OR entirely within one entity set pushes down fine", () => {
    const rule: ScopeRule = {
      or: [
        { field: "Dismm", op: "eq", value: "PD" },
        { field: "Dismm", op: "eq", value: "ND" },
      ],
    }
    expect(toODataFilter(rule, "MaterialPlantSet")).toBe("(Dismm eq 'PD' or Dismm eq 'ND')")
  })

  it("empty and[] (the 'all' scope) needs no filter at all", () => {
    expect(toODataFilter({ and: [] }, "MaterialPlantSet")).toBeUndefined()
  })
})

describe("FIELD_ENTITY_SET stays in sync with the scopes that reference it", () => {
  it("every field this test exercises is mapped to a real entity set", () => {
    expect(FIELD_ENTITY_SET.Dismm).toBe("MaterialPlantSet")
    expect(FIELD_ENTITY_SET.Mstae).toBe("MaterialSet")
    expect(FIELD_ENTITY_SET.Matkl).toBe("MaterialSet")
  })
})
