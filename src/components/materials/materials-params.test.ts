import { describe, expect, it } from "vitest"

import { materialsHref, parseMaterialsFilters } from "@/components/materials/materials-params"

describe("parseMaterialsFilters", () => {
  it("reads every filter", () => {
    expect(parseMaterialsFilters({ search: " bearing ", plant: "1500", classification: "OAR", page: "3" })).toEqual({
      search: "bearing",
      plant: "1500",
      classification: "OAR",
      page: 3,
    })
  })

  it("drops what it does not recognise and starts on page 1", () => {
    expect(parseMaterialsFilters({ classification: "oar", page: "0", search: "", plant: ["1300", "1500"] })).toEqual({
      search: undefined,
      plant: undefined,
      classification: undefined,
      page: 1,
    })
  })
})

describe("materialsHref", () => {
  it("leaves page 1 and unset filters out", () => {
    expect(materialsHref({ page: 1 })).toBe("/materials")
    expect(materialsHref({ search: "ball", classification: "NON_OAR", page: 2 })).toBe(
      "/materials?search=ball&classification=NON_OAR&page=2"
    )
  })

  it("round-trips through the parser", () => {
    const filters = { search: "hex bolt", plant: "1300", classification: "OAR" as const, page: 4 }
    const query = Object.fromEntries(new URLSearchParams(materialsHref(filters).split("?")[1]))
    expect(parseMaterialsFilters(query)).toEqual(filters)
  })
})
