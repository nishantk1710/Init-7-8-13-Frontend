import { describe, expect, it } from "vitest"

import { hasRealCircuit } from "./circuit"

describe("hasRealCircuit", () => {
  it("is false when every row is Unassigned, or there are no rows", () => {
    expect(hasRealCircuit([])).toBe(false)
    expect(hasRealCircuit([{ circuit: "Unassigned" }, { circuit: "Unassigned" }])).toBe(false)
  })

  it("is true as soon as any row has a real circuit", () => {
    expect(hasRealCircuit([{ circuit: "Unassigned" }, { circuit: "Milling" }])).toBe(true)
  })
})
