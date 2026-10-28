import { describe, expect, it } from "vitest"

import { entryFromParams, requestHref } from "@/lib/assistant/request/entry"

describe("starting a request from a link", () => {
  it("reads the BAdI contract as line 1", () => {
    const entry = entryFromParams({
      material: " 4000002200 ",
      plant: "1300",
      department: "10100",
      requestedFor: "J Pietersen",
      origin: "BADI",
    })
    expect(entry).toEqual({
      materialId: "4000002200",
      plant: "1300",
      department: "10100",
      requestedFor: "J Pietersen",
      origin: "BADI",
    })
  })

  it("needs a material and a plant, and reads anything else as the platform", () => {
    expect(entryFromParams({ material: "4000002200" })).toBeNull()
    expect(entryFromParams({ material: ["1", "2"], plant: "1300" })).toBeNull()
    expect(entryFromParams({ material: "4000002200", plant: "1300", origin: "SAP" })?.origin).toBe("PLATFORM")
  })

  it("forwards the same parameters to the request screen", () => {
    const entry = entryFromParams({ material: "4000002200", plant: "1300", origin: "BADI" })
    expect(requestHref(entry)).toBe("/assistant/requests/new?material=4000002200&plant=1300&origin=BADI")
    expect(requestHref(null)).toBe("/assistant/requests/new")
  })
})
