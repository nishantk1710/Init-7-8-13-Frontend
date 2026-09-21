import { readFileSync } from "node:fs"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { isInScope, isMaterialInScope, SCOPES, toODataFilter } from "./index"
import { OAR_MRP_TYPES } from "./config"
import type { FieldRow } from "./types"

describe("isInScope — the configured oar scope", () => {
  it("selects maintained ND/PD material-plant rows", () => {
    expect(isInScope("oar", {}, { Dismm: "ND" })).toBe("in-scope")
    expect(isInScope("oar", {}, { Dismm: "PD" })).toBe("in-scope")
  })

  it("excludes planned stock", () => {
    expect(isInScope("oar", {}, { Dismm: "VB" })).toBe("not-in-scope")
  })

  it("MSTAE plays no part in the OAR rule -- confirmed 2026-09-18, only Dismm matters", () => {
    // The MSTAE/material-status exclusion carried over from an earlier draft
    // has been dropped; a material with Mstae="01" (obsolete) is still
    // in-scope if its Dismm is ND/PD, matching the backend's
    // app/initiatives/i7/policy/oar.py::current_oar_policy.
    expect(isInScope("oar", { Mstae: "01" }, { Dismm: "ND" })).toBe("in-scope")
  })

  it("reports cannot-determine for an unmaintained MRP Type rather than guessing 'not OAR'", () => {
    // 47% of live MaterialPlantSet rows look like this — see phase_summary.md Phase 0.
    expect(isInScope("oar", {}, { Dismm: "" })).toBe("cannot-determine")
    expect(isInScope("oar", {}, {})).toBe("cannot-determine")
  })

  it("treats MRP Types nobody has ruled on as out of scope, not in it", () => {
    // V1/M0/RP/VI/VH/V2 all exist live; none is in the configured OAR set.
    for (const code of ["V1", "M0", "RP", "VI", "VH", "V2"]) {
      expect(isInScope("oar", {}, { Dismm: code })).toBe("not-in-scope")
    }
  })

  it("rejects an unknown scope name loudly", () => {
    expect(() => isInScope("nope", {}, {})).toThrow(/Unknown scope/)
  })
})

describe("isMaterialInScope — roll-up policy", () => {
  beforeAll(() => {
    SCOPES.__test_any = { ...SCOPES.oar, name: "__test_any", rollup: "any-plant" }
    SCOPES.__test_all = { ...SCOPES.oar, name: "__test_all", rollup: "all-plants" }
  })

  afterAll(() => {
    delete SCOPES.__test_any
    delete SCOPES.__test_all
  })

  const material: FieldRow = {}
  const oarPlant: FieldRow = { Werks: "1000", Dismm: "PD" }
  const plannedPlant: FieldRow = { Werks: "4000", Dismm: "VB" }
  const unmaintainedPlant: FieldRow = { Werks: "2000", Dismm: "" }

  it("per-plant-only refuses the material-level question instead of inventing an answer (§1.6(a))", () => {
    expect(() => isMaterialInScope("oar", material, [oarPlant, plannedPlant])).toThrow(/per-plant-only/)
  })

  it("any-plant: OAR in one plant, planned in another -> in-scope", () => {
    expect(isMaterialInScope("__test_any", material, [oarPlant, plannedPlant])).toBe("in-scope")
  })

  it("all-plants: OAR in one plant, planned in another -> not-in-scope", () => {
    expect(isMaterialInScope("__test_all", material, [oarPlant, plannedPlant])).toBe("not-in-scope")
  })

  it("any-plant: a definite yes outranks an unmaintained plant", () => {
    expect(isMaterialInScope("__test_any", material, [oarPlant, unmaintainedPlant])).toBe("in-scope")
  })

  it("any-plant: no yes anywhere but an unmaintained plant -> cannot-determine", () => {
    expect(isMaterialInScope("__test_any", material, [plannedPlant, unmaintainedPlant])).toBe("cannot-determine")
  })

  it("all-plants: a definite no outranks an unmaintained plant", () => {
    expect(isMaterialInScope("__test_all", material, [plannedPlant, unmaintainedPlant])).toBe("not-in-scope")
  })

  it("all-plants: all yes except an unmaintained plant -> cannot-determine", () => {
    expect(isMaterialInScope("__test_all", material, [oarPlant, unmaintainedPlant])).toBe("cannot-determine")
  })

  it("a material with no plant rows at all is cannot-determine, not a rollup identity value", () => {
    expect(isMaterialInScope("__test_any", material, [])).toBe("cannot-determine")
    expect(isMaterialInScope("__test_all", material, [])).toBe("cannot-determine")
  })
})

describe("against the generated synthetic fixture", () => {
  // Every CSV cell is a string, so this is narrower than FieldRow on purpose —
  // it lets the keys below be used as Map keys without casting.
  function parseCsv(path: string): Record<string, string>[] {
    const lines = readFileSync(path, "utf-8").trim().split(/\r?\n/)
    const header = lines[0].split(",")
    return lines.slice(1).map((line) => {
      const cells = line.split(",")
      return Object.fromEntries(header.map((h, i) => [h, cells[i] ?? ""]))
    })
  }

  const materials = parseCsv("./data-generator/generated/sap/MaterialSet.csv")
  const plants = parseCsv("./data-generator/generated/sap/MaterialPlantSet.csv")
  const byMatnr = new Map(materials.map((m) => [m.Matnr!, m]))

  const rows = plants.map((plant) => ({ plant, material: byMatnr.get(plant.Matnr!) ?? {} }))
  const inScope = rows.filter(({ material, plant }) => isInScope("oar", material, plant) === "in-scope")
  const naive = rows.filter(({ plant }) => (OAR_MRP_TYPES as readonly string[]).includes(plant.Dismm ?? ""))

  // Behaviour, not hard-coded counts — these survive the next regeneration of the fixture.
  it("every selected row genuinely satisfies the configured rule (Dismm alone)", () => {
    for (const { plant } of inScope) {
      expect(OAR_MRP_TYPES as readonly string[]).toContain(plant.Dismm)
    }
  })

  it("the configured rule is exactly the naive MRP-type-only rule -- MSTAE plays no part", () => {
    // Confirmed 2026-09-18: Dismm in {ND, PD} is the whole rule, so this scope
    // and the naive MRP-type check select the identical row set.
    expect(inScope.length).toBe(naive.length)
    const naiveKeys = new Set(naive.map(({ plant }) => `${plant.Matnr}|${plant.Werks}`))
    for (const { plant } of inScope) {
      expect(naiveKeys.has(`${plant.Matnr}|${plant.Werks}`)).toBe(true)
    }
  })

  it("the fixture contains materials whose scope differs between plants — the §1.6(a) case", () => {
    const verdictsByMaterial = new Map<string, Set<string>>()
    for (const { material, plant } of rows) {
      const verdicts = verdictsByMaterial.get(plant.Matnr!) ?? new Set<string>()
      verdicts.add(isInScope("oar", material, plant))
      verdictsByMaterial.set(plant.Matnr!, verdicts)
    }
    const split = [...verdictsByMaterial.values()].filter((v) => v.size > 1)
    expect(split.length).toBeGreaterThan(0)
  })

  it("the pushdown filter's entity slice matches what the predicate uses on that entity", () => {
    // Full row-for-row equivalence through a real query engine lands with the
    // fake gateway (W2.6a); here we assert the filter names exactly the values
    // the config says are in scope, so the two can never drift apart silently.
    const filter = toODataFilter("oar", "MaterialPlantSet")!
    for (const value of OAR_MRP_TYPES) {
      expect(filter).toContain(`Dismm eq '${value}'`)
    }
    const quotedValues = filter.match(/'[^']*'/g) ?? []
    expect(quotedValues).toHaveLength(OAR_MRP_TYPES.length)
  })
})
