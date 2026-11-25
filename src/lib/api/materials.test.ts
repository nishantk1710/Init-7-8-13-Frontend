import { describe, expect, it } from "vitest"

import { materialsQuery, toMaterialStock } from "@/lib/api/materials"

describe("materialsQuery", () => {
  it("sends only the filters that are set", () => {
    expect(materialsQuery({})).toBe("")
    expect(materialsQuery({ search: "ball bearing", plant: "1300", classification: "NON_OAR", limit: 25, offset: 50 })).toBe(
      "?search=ball+bearing&plant=1300&classification=NON_OAR&limit=25&offset=50"
    )
  })

  it("keeps an offset of 0", () => {
    expect(materialsQuery({ limit: 25, offset: 0 })).toBe("?limit=25&offset=0")
  })
})

describe("toMaterialStock", () => {
  it("maps the backend row", () => {
    expect(
      toMaterialStock({
        material: "1000000001",
        material_description: "BEARING, BALL 6205",
        plant: "1300",
        plant_name: "Black Mountain Mining",
        classification: "OAR",
        stock_on_hand: "15.500",
        unit: "EA",
      })
    ).toEqual({
      material: "1000000001",
      materialDescription: "BEARING, BALL 6205",
      plant: "1300",
      classification: "OAR",
      stockOnHand: "15.500",
      unit: "EA",
    })
  })

  it("reads a missing description, unit or stock as nothing, and anything but OAR as Non-OAR", () => {
    expect(toMaterialStock({ material: "2", plant: "1500", classification: "SOMETHING", material_description: null })).toEqual({
      material: "2",
      materialDescription: null,
      plant: "1500",
      classification: "NON_OAR",
      stockOnHand: "0",
      unit: null,
    })
  })
})
