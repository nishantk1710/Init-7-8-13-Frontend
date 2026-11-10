import { describe, expect, it } from "vitest"

import { formatApiDateTime } from "@/lib/api/format"

describe("formatApiDateTime", () => {
  it("shows South African time, not the clock of the machine rendering it", () => {
    // 22:30 UTC is 00:30 the next day in Johannesburg (UTC+2).
    const text = formatApiDateTime("2026-11-09T22:30:00Z")
    expect(text).toMatch(/10 Nov 2026/)
    expect(text).toMatch(/00:30/)
  })

  it("falls back for a missing or unreadable value", () => {
    expect(formatApiDateTime(null)).toBe("—")
    expect(formatApiDateTime("not a date")).toBe("—")
  })
})
