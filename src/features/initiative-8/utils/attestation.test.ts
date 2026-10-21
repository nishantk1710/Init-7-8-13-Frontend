import { describe, expect, it } from "vitest"

import {
  CONDITIONS,
  RECOMMENDATION,
  defaultAttestationQuantity,
  parseAttestationQuantity,
} from "@/features/initiative-8/utils/attestation"

describe("parseAttestationQuantity", () => {
  it("accepts a positive number, whole or not", () => {
    expect(parseAttestationQuantity("2")).toBe(2)
    expect(parseAttestationQuantity(" 1.5 ")).toBe(1.5)
  })

  it("rejects zero, negatives, blanks and text", () => {
    for (const input of ["0", "-1", "", "   ", "abc"]) {
      expect(parseAttestationQuantity(input)).toBeUndefined()
    }
  })
})

describe("defaultAttestationQuantity", () => {
  it("starts from what is still out on the line", () => {
    expect(defaultAttestationQuantity(3)).toBe("3")
  })

  it("starts from 1, never 0, once the unit is back", () => {
    expect(defaultAttestationQuantity(0)).toBe("1")
    expect(parseAttestationQuantity(defaultAttestationQuantity(0))).toBe(1)
  })
})

describe("RECOMMENDATION", () => {
  it("maps every condition the form offers onto the API enum", () => {
    expect(CONDITIONS.map((c) => RECOMMENDATION[c])).toEqual([
      "REPAIRABLE",
      "BEYOND_ECONOMICAL_REPAIR",
      "SCRAP",
    ])
  })
})
