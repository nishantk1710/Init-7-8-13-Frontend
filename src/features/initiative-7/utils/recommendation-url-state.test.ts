import { describe, expect, it } from "vitest"

import { convertToOarDecisionHref, convertToOarHref, parseRecommendationLink } from "@/features/initiative-7/utils/recommendation-url-state"

const parse = (query: string) => parseRecommendationLink(new URLSearchParams(query))

describe("parseRecommendationLink", () => {
  it("is null when the link asks for nothing, so the page opens as it always did", () => {
    expect(parse("")).toBeNull()
    expect(parse("reviewMaterial=8000000001")).toBeNull()
  })

  it("reads the view, material and plant of a Convert to OAR link", () => {
    expect(parse("type=min_max_to_oar&material=8000000001&plant=1300")).toEqual({
      type: "min_max_to_oar",
      material: "8000000001",
      plant: "1300",
    })
  })

  it("accepts each of the page's three views and ignores any other", () => {
    expect(parse("type=oar")?.type).toBe("oar")
    expect(parse("type=stock_item")?.type).toBe("stock_item")
    expect(parse("type=bogus&material=M1")).toEqual({ type: null, material: "M1", plant: "" })
  })

  it("ignores a plant that is not a four-digit SAP code, and trims and caps the material", () => {
    expect(parse("type=oar&plant=13%2000")?.plant).toBe("")
    expect(parse("type=oar&plant=PLANT-GBG")?.plant).toBe("")
    expect(parse("material=%20%20REC1%20")?.material).toBe("REC1")
    expect(parse(`material=${"9".repeat(300)}`)?.material).toHaveLength(100)
  })
})

describe("convertToOarDecisionHref", () => {
  it("builds the link to the decision page the Action Center and the Pipeline open", () => {
    expect(convertToOarDecisionHref("REC1", "1300")).toBe("/inventory-planning/convert-to-oar?material=REC1&plant=1300")
  })

  it("encodes a material that is not plain, and the page reads it back as written", () => {
    const query = convertToOarDecisionHref("A B&C", "1500").split("?")[1]
    const params = new URLSearchParams(query)
    expect([params.get("material"), params.get("plant")]).toEqual(["A B&C", "1500"])
  })
})

describe("convertToOarHref", () => {
  it("builds the link the notification and the Action Center share", () => {
    expect(convertToOarHref("REC1", "1300")).toBe("/inventory-planning/recommendations?type=min_max_to_oar&material=REC1&plant=1300")
  })

  it("encodes a material that is not plain, and reads back as the same link", () => {
    const href = convertToOarHref("A B&C", "1500")
    const link = parse(href.split("?")[1])
    expect(link).toEqual({ type: "min_max_to_oar", material: "A B&C", plant: "1500" })
  })
})
