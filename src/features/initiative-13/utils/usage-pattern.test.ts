import { describe, expect, it } from "vitest"

import type { MonthlyConsumption } from "@/lib/api/i13"

import { heatLevel, monthLabel, monthNote, readUsage, yearGrid } from "./usage-pattern"

/** `length` months from 2025-01, issued as given (0 where not). */
function series(issued: Record<number, number>, length = 12): MonthlyConsumption[] {
  return Array.from({ length }, (_, i) => ({
    month: `${2025 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`,
    issuedQuantity: issued[i] ?? 0,
    issueCount: issued[i] ? 1 : 0,
    receivedQuantity: 0,
  }))
}

describe("readUsage", () => {
  it("reads no issue at all as never issued", () => {
    const r = readUsage(series({}))
    expect(r.kind).toBe("never")
    expect(r.peakIndex).toBe(-1)
  })

  it("reads six quiet months to the end of the history as gone quiet, naming a dominant month", () => {
    const r = readUsage(series({ 1: 10, 5: 990 }))
    expect(r.kind).toBe("quiet")
    expect(r.quietFor).toBe(6)
    expect(r.hint).toBe("No issue for 6 months")
    expect(r.story).toBe("Last issued in Jun 2025, 6 months before the history ends. One month (Jun 2025) is 99% of everything issued.")
  })

  it("is not gone quiet at five quiet months", () => {
    expect(readUsage(series({ 0: 5, 1: 5, 6: 5 })).kind).toBe("bursts")
  })

  it("reads issues in at least half the months as steady", () => {
    const r = readUsage(series({ 0: 4, 2: 4, 4: 4, 6: 4, 8: 4, 11: 4 }))
    expect(r.kind).toBe("steady")
    expect(r.story).toBe("Issued in 6 of 12 months, about 4 a month when it moves. Last issue Dec 2025.")
  })

  it("reads anything else as in bursts, with the busiest month's share", () => {
    const r = readUsage(series({ 7: 30, 9: 10, 11: 10 }))
    expect(r.kind).toBe("bursts")
    expect(r.peakIndex).toBe(7)
    expect(r.story).toBe("Issued in 3 of 12 months, in runs with gaps between. The busiest month (Aug 2025) took 60%.")
  })
})

describe("monthLabel", () => {
  it("names the month, and passes anything else through", () => {
    expect(monthLabel("2024-07")).toBe("Jul 2024")
    expect(monthLabel("July")).toBe("July")
  })
})

describe("heatLevel", () => {
  it("steps by share of the busiest month", () => {
    expect(heatLevel(0, 100)).toBe(0)
    expect(heatLevel(10, 100)).toBe(1)
    expect(heatLevel(30, 100)).toBe(2)
    expect(heatLevel(60, 100)).toBe(3)
    expect(heatLevel(100, 100)).toBe(4)
  })
})

describe("monthNote", () => {
  it("says what the issued and received figures mean together", () => {
    expect(monthNote({ issuedQuantity: 0, receivedQuantity: 0 })).toBe("Nothing moved this month.")
    expect(monthNote({ issuedQuantity: 0, receivedQuantity: 5 })).toBe("Received, nothing issued.")
    expect(monthNote({ issuedQuantity: 5, receivedQuantity: 0 })).toBe("Issued from stock, nothing received.")
    expect(monthNote({ issuedQuantity: 5, receivedQuantity: 5 })).toBe("Received and issued in the same month.")
  })
})

describe("yearGrid", () => {
  it("lays the history out as calendar years, outside months empty", () => {
    const months = series({}, 14).slice(10) // 2025-11 .. 2026-02
    const grid = yearGrid(months)
    expect(grid.map((y) => y.year)).toEqual(["2025", "2026"])
    expect(grid[0].cells[10]).toEqual({ month: "2025-11", index: 0 })
    expect(grid[0].cells[0].index).toBeNull()
    expect(grid[1].cells[1]).toEqual({ month: "2026-02", index: 3 })
  })
})
