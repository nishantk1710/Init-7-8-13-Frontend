import { beforeEach, describe, expect, it, vi } from "vitest"

import type { GlobalAction, InitiativeSummary } from "@/lib/domain/contracts"
import type { LiveAuditEvents } from "@/lib/domain/live-feed"

// Each initiative's live selectors are replaced, so these tests exercise only
// what this file owns: how three independent outcomes are composed.
const i7 = vi.hoisted(() => ({ summary: vi.fn(), actions: vi.fn(), audit: vi.fn() }))
const i8 = vi.hoisted(() => ({ summary: vi.fn(), actions: vi.fn(), audit: vi.fn() }))
const i13 = vi.hoisted(() => ({ summary: vi.fn(), actions: vi.fn(), audit: vi.fn() }))

vi.mock("@/features/initiative-7/selectors/live", () => ({
  getInitiative7LiveSummary: i7.summary,
  getInitiative7LiveActions: i7.actions,
  getInitiative7LiveAuditEvents: i7.audit,
}))
vi.mock("@/features/initiative-8/selectors/live", () => ({
  getInitiative8LiveSummary: i8.summary,
  getInitiative8LiveActions: i8.actions,
  getInitiative8LiveAuditEvents: i8.audit,
}))
vi.mock("@/features/initiative-13/selectors/live", () => ({
  getInitiative13LiveSummary: i13.summary,
  getInitiative13LiveActions: i13.actions,
  getInitiative13LiveAuditEvents: i13.audit,
}))

import {
  AUDIT_DEPTH_CAP,
  combineAuditEvents,
  failuresOf,
  getLiveAuditPage,
  getLiveSummaries,
} from "@/lib/aggregation"

function summary(id: InitiativeSummary["id"]): InitiativeSummary {
  return { id, label: id, href: "/x", health: "healthy", metrics: [], actions: [] }
}

function event(id: string, timestamp: string, initiative: GlobalAction["initiative"] = "initiative-7") {
  return { id, initiative, entityId: id, eventType: "E", description: "d", timestamp }
}

beforeEach(() => {
  for (const m of [i7, i8, i13]) {
    m.summary.mockReset()
    m.actions.mockReset()
    m.audit.mockReset()
  }
})

describe("getLiveSummaries", () => {
  it("keys every outcome by initiative id", async () => {
    i7.summary.mockResolvedValue(summary("initiative-7"))
    i8.summary.mockResolvedValue(summary("initiative-8"))
    i13.summary.mockResolvedValue(summary("initiative-13"))
    const per = await getLiveSummaries()
    expect(per["initiative-8"]).toEqual({ status: "ready", data: summary("initiative-8") })
  })

  it("lets one module fail without taking the others down", async () => {
    i7.summary.mockResolvedValue(summary("initiative-7"))
    i8.summary.mockRejectedValue(new Error("register did not answer"))
    i13.summary.mockResolvedValue(summary("initiative-13"))

    const per = await getLiveSummaries()

    expect(per["initiative-7"].status).toBe("ready")
    expect(per["initiative-13"].status).toBe("ready")
    expect(per["initiative-8"]).toEqual({ status: "error", message: "register did not answer" })
  })

  it("does not throw even when every module is down", async () => {
    for (const m of [i7, i8, i13]) m.summary.mockRejectedValue(new Error("down"))
    const per = await getLiveSummaries()
    expect(failuresOf(per).map((f) => f.initiative)).toEqual(["initiative-7", "initiative-8", "initiative-13"])
  })
})

describe("combineAuditEvents", () => {
  const ready = (events: LiveAuditEvents["events"], total: number | null = events.length) => ({
    status: "ready" as const,
    data: { events, total },
  })
  const failed = { status: "error" as const, message: "down" }

  it("sorts newest first on the parsed instant, not on the string", () => {
    // 10:00 at +02:00 is 08:00 UTC — earlier than 09:00 UTC, though it sorts later as text.
    const combined = combineAuditEvents({
      "initiative-7": ready([event("late-utc", "2026-09-01T09:00:00Z")]),
      "initiative-8": ready([event("early-offset", "2026-09-01T10:00:00+02:00", "initiative-8")]),
      "initiative-13": ready([]),
    })
    expect(combined.events.map((e) => e.id)).toEqual(["late-utc", "early-offset"])
  })

  it("puts an unparseable timestamp last instead of first", () => {
    const combined = combineAuditEvents({
      "initiative-7": ready([event("junk", "not a date"), event("real", "2026-09-01T09:00:00Z")]),
      "initiative-8": ready([]),
      "initiative-13": ready([]),
    })
    expect(combined.events.map((e) => e.id)).toEqual(["real", "junk"])
  })

  it("has no total when any module could not report one, and names the failure", () => {
    const combined = combineAuditEvents({
      "initiative-7": ready([event("a", "2026-09-01T09:00:00Z")], 40),
      "initiative-8": failed,
      "initiative-13": ready([], 5),
    })
    expect(combined.total).toBeNull()
    expect(combined.failures.map((f) => f.initiative)).toEqual(["initiative-8"])
  })

  it("sums the populations when every module answers", () => {
    const combined = combineAuditEvents({
      "initiative-7": ready([], 40),
      "initiative-8": ready([], 2),
      "initiative-13": ready([], 5),
    })
    expect(combined.total).toBe(47)
  })
})

describe("getLiveAuditPage", () => {
  it("asks each module for enough of its newest events to fill the requested page", async () => {
    for (const m of [i7, i8, i13]) m.audit.mockResolvedValue({ events: [], total: 0 })
    await getLiveAuditPage({ page: 3, pageSize: 25 })
    expect(i7.audit).toHaveBeenCalledWith({ limit: 75, fromTs: undefined, toTs: undefined })
  })

  it("slices the merged, sorted feed to the requested page", async () => {
    const stamp = (n: number) => `2026-09-${String(n).padStart(2, "0")}T00:00:00Z`
    i7.audit.mockResolvedValue({
      events: [event("d10", stamp(10)), event("d8", stamp(8)), event("d6", stamp(6))],
      total: 3,
    })
    i8.audit.mockResolvedValue({ events: [event("d9", stamp(9), "initiative-8")], total: 1 })
    i13.audit.mockResolvedValue({ events: [event("d7", stamp(7), "initiative-13")], total: 1 })

    const page2 = await getLiveAuditPage({ page: 2, pageSize: 2 })

    expect(page2.events.map((e) => e.id)).toEqual(["d8", "d7"])
    expect(page2.total).toBe(5)
    expect(page2.lastPage).toBe(3)
  })

  it("only asks the chosen module, so the others cannot fail the page", async () => {
    i8.audit.mockResolvedValue({ events: [], total: 0 })
    const result = await getLiveAuditPage({ page: 1, pageSize: 25, initiative: "initiative-8" })
    expect(i7.audit).not.toHaveBeenCalled()
    expect(i13.audit).not.toHaveBeenCalled()
    expect(result.failures).toEqual([])
  })

  it("forwards the date bounds", async () => {
    for (const m of [i7, i8, i13]) m.audit.mockResolvedValue({ events: [], total: 0 })
    await getLiveAuditPage({ page: 1, pageSize: 25, fromTs: "2026-09-01T00:00:00Z", toTs: "2026-09-08T00:00:00Z" })
    expect(i13.audit).toHaveBeenCalledWith({
      limit: 25,
      fromTs: "2026-09-01T00:00:00Z",
      toTs: "2026-09-08T00:00:00Z",
    })
  })

  it("clamps a page beyond the reachable depth and says the trail is truncated", async () => {
    i7.audit.mockResolvedValue({ events: [], total: 10_000 })
    i8.audit.mockResolvedValue({ events: [], total: 0 })
    i13.audit.mockResolvedValue({ events: [], total: 0 })
    const result = await getLiveAuditPage({ page: 9_999, pageSize: 25 })
    expect(result.page).toBe(AUDIT_DEPTH_CAP / 25)
    expect(result.truncated).toBe(true)
    expect(i7.audit).toHaveBeenCalledWith(expect.objectContaining({ limit: AUDIT_DEPTH_CAP }))
  })

  it("reports a failed module instead of silently returning a shorter trail", async () => {
    i7.audit.mockResolvedValue({ events: [event("a", "2026-09-01T09:00:00Z")], total: 1 })
    i8.audit.mockRejectedValue(new Error("attestations unreachable"))
    i13.audit.mockResolvedValue({ events: [], total: 0 })
    const result = await getLiveAuditPage({ page: 1, pageSize: 25 })
    expect(result.failures).toEqual([{ initiative: "initiative-8", message: "attestations unreachable" }])
    expect(result.total).toBeNull()
    expect(result.events).toHaveLength(1)
  })
})
