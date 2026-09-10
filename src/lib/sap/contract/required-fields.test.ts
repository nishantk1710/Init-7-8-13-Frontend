import { describe, expect, it } from "vitest"
import { SAP_CONTRACT } from "./generated-contract"
import { REQUIRED_FIELDS } from "./required-fields"

describe("every field an initiative depends on exists in the measured contract", () => {
  it.each(REQUIRED_FIELDS)("$initiative / $entitySet", ({ entitySet, fields, why }) => {
    const set = SAP_CONTRACT[entitySet]
    expect(set, `${entitySet} is not exposed at all. Needed because: ${why}`).toBeDefined()

    const available = new Set(set.properties.map((p) => p.name))
    const missing = fields.filter((f) => !available.has(f))
    expect(missing, `${entitySet} is missing ${missing.join(", ")}. Needed because: ${why}`).toEqual([])
  })

  it("names only entity sets that exist, so a typo cannot pass as a satisfied requirement", () => {
    for (const requirement of REQUIRED_FIELDS) {
      expect(Object.keys(SAP_CONTRACT)).toContain(requirement.entitySet)
    }
  })

  it("covers all three initiatives", () => {
    const initiatives = new Set(REQUIRED_FIELDS.map((r) => r.initiative))
    expect([...initiatives].sort()).toEqual(["I07", "I08", "I13"])
  })
})
