import { describe, expect, it } from "vitest"

import {
  checkCharacter,
  demoIdFrom,
  isDemoSessionId,
  isWellFormed,
  mintDemoSessionId,
} from "@/lib/assistant/demo/ids"

const ALPHABET = /^[0-9A-HJKMNP-TV-Z]+$/

describe("demo session IDs", () => {
  it("compute the same check character as the backend", () => {
    // Expected values printed by app/assistant/ids.py::_check_character.
    expect(checkCharacter("S00000000")).toBe("X")
    expect(checkCharacter("DZZZZZZZZ")).toBe("H")
    expect(demoIdFrom("7K2M4P8Q")).toBe("D7K2M4P8QW")
    expect(demoIdFrom("Q4X9B2T7")).toBe("DQ4X9B2T7T")
  })

  it("are ten Crockford characters starting with D, and well-formed", () => {
    for (let i = 0; i < 200; i += 1) {
      const id = mintDemoSessionId()
      expect(id).toHaveLength(10)
      expect(id.startsWith("D")).toBe(true)
      expect(id).toMatch(ALPHABET)
      expect(isWellFormed(id)).toBe(true)
      expect(isDemoSessionId(id)).toBe(true)
    }
  })

  it("never start with S, so the backend can never accept one", () => {
    expect(isDemoSessionId("S00000000X")).toBe(false)
  })

  it("are unique across a thousand mints", () => {
    const ids = new Set(Array.from({ length: 1000 }, () => mintDemoSessionId()))
    expect(ids.size).toBe(1000)
  })

  it("catch a single mistyped character", () => {
    const id = demoIdFrom("7K2M4P8Q")
    expect(isWellFormed(id.slice(0, 4) + (id[4] === "4" ? "5" : "4") + id.slice(5))).toBe(false)
  })
})
