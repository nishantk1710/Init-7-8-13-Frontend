import { describe, expect, it } from "vitest"

import { DASHBOARD_INFO, EXAMPLE_AS_OF, type DashboardInfoId } from "@/features/initiative-13/data/dashboard-info"

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** "10 Mar 2026" -> UTC midnight, in ms. */
function parse(text: string): number {
  const [day, month, year] = text.split(" ")
  return Date.UTC(Number(year), MONTHS.indexOf(month), Number(day))
}

function daysBetween(from: string, to: string): number {
  return Math.round((parse(to) - parse(from)) / 86_400_000)
}

function input(id: DashboardInfoId, label: string): string {
  const found = DASHBOARD_INFO[id].example.inputs.find((i) => i.label === label)
  if (!found) throw new Error(`${id} has no input "${label}"`)
  return found.value
}

const count = (value: string) => Number(value.replace(/,/g, ""))

describe("DASHBOARD_INFO", () => {
  it("has a title, summary, rule, steps and an example for every entry", () => {
    for (const spec of Object.values(DASHBOARD_INFO)) {
      expect(spec.title).not.toBe("")
      expect(spec.summary).not.toBe("")
      expect(spec.rule.length).toBeGreaterThan(0)
      expect(spec.steps.length).toBeGreaterThan(0)
      expect(spec.example.inputs.length).toBeGreaterThan(0)
      expect(spec.example.result).not.toBe("")
    }
  })

  it("fast-moving: the example's days are right and within 365", () => {
    const days = daysBetween(input("fastMoving", "Last goods issue"), EXAMPLE_AS_OF)
    expect(days).toBe(count(input("fastMoving", "Days since last issue")))
    expect(days).toBeLessThanOrEqual(365)
  })

  it("slow-moving: the example's days are right and between 366 and 730", () => {
    const days = daysBetween(input("slowMoving", "Last goods issue"), EXAMPLE_AS_OF)
    expect(days).toBe(count(input("slowMoving", "Days since last issue")))
    expect(days).toBeGreaterThan(365)
    expect(days).toBeLessThanOrEqual(730)
  })

  it("non-moving: the example's days are right and over 730", () => {
    const days = daysBetween(input("nonMoving", "Material A: last goods issue"), EXAMPLE_AS_OF)
    expect(days).toBe(count(input("nonMoving", "Material A: days since last issue")))
    expect(days).toBeGreaterThan(730)
    expect(daysBetween(input("nonMoversTab", "Last goods issue"), EXAMPLE_AS_OF)).toBe(
      count(input("nonMoversTab", "Days since last issue"))
    )
  })

  it("GR not issued: the example's receipt is 30 days old or more", () => {
    const days = count(input("grNotIssued", "Line 2: days since receipt"))
    expect(daysBetween("1 Sep 2026", EXAMPLE_AS_OF)).toBe(days)
    expect(days).toBeGreaterThanOrEqual(30)
  })

  it("plan overdue: due is window end + 14 days, and the overdue days add up", () => {
    const end = input("planOverdue", "Usage window ends")
    const due = input("planOverdue", "Due date (+14 days)")
    expect(daysBetween(end, due)).toBe(14)
    expect(DASHBOARD_INFO.planOverdue.example.result).toContain(`${daysBetween(due, EXAMPLE_AS_OF)} days overdue`)
  })
})
