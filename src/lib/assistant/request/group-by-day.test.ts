import { describe, expect, it } from "vitest"

import { groupByDay } from "./group-by-day"

const now = new Date(2026, 9, 26, 16, 0) // 26 Oct 2026, local time
const at = (d: number, h: number) => new Date(2026, 9, d, h, 0).toISOString()

describe("groupByDay", () => {
  it("groups by local day, newest day first, keeping order within a day", () => {
    const items = [
      { id: "a", when: at(26, 15) },
      { id: "b", when: at(23, 15) },
      { id: "c", when: at(26, 14) },
      { id: "d", when: at(25, 9) },
    ]
    const groups = groupByDay(items, (i) => i.when, now)
    expect(groups.map((g) => g.heading)).toEqual(["Today", "Yesterday", "Fri 23 Oct"])
    expect(groups[0].items.map((i) => i.id)).toEqual(["a", "c"])
    expect(groups[2].date).toBe("23 Oct 2026")
  })

  it("puts an unreadable date in its own group, last", () => {
    const groups = groupByDay([{ when: "nope" }, { when: at(26, 1) }], (i) => i.when, now)
    expect(groups.map((g) => g.heading)).toEqual(["Today", "Date not recorded"])
  })
})
