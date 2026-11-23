import { describe, expect, it } from "vitest"

import { parameterRows } from "@/features/initiative-7/components/parameter-comparison"

describe("the recommended inventory boxes", () => {
  it("show only Reorder Point and Maximum Stock when no safety stock was recommended", () => {
    expect(parameterRows({ rop: 120, safetyStock: null, maxStock: 255 }).map((row) => row.key)).toEqual(["rop", "maxStock"])
  })

  it("show the Safety Stock box for a recommendation that carries one, including a real 0", () => {
    expect(parameterRows({ rop: 120, safetyStock: 89, maxStock: 255 }).map((row) => row.key)).toEqual(["rop", "safetyStock", "maxStock"])
    expect(parameterRows({ rop: 120, safetyStock: 0, maxStock: 255 }).map((row) => row.key)).toEqual(["rop", "safetyStock", "maxStock"])
  })
})
