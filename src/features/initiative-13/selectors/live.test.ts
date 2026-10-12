import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const api = vi.hoisted(() => ({
  getI13Summary: vi.fn(),
  getI13ActExceptionsList: vi.fn(),
  getI13ReclassificationList: vi.fn(),
  getI13ActEvents: vi.fn(),
}))
vi.mock("@/lib/api/i13", () => api)

import {
  getInitiative13LiveActions,
  getInitiative13LiveAuditEvents,
  getInitiative13LiveSummary,
} from "@/features/initiative-13/selectors/live"

const NOW = new Date("2026-09-20T12:00:00Z")

function exception(id: string, status: string, overrides: Record<string, unknown> = {}) {
  return {
    exceptionId: id,
    exceptionType: "PLAN_BREACH",
    status,
    material: "000000008000000000",
    plant: "1300",
    detectedAt: "2026-09-10T08:00:00Z",
    requesterDueAt: null,
    ...overrides,
  }
}

/** Serve each status bucket from a table; an unlisted status is empty. */
function serveExceptions(buckets: Record<string, { rows: ReturnType<typeof exception>[]; total?: number | null }>) {
  api.getI13ActExceptionsList.mockImplementation(async ({ status }: { status: string }) => {
    const b = buckets[status] ?? { rows: [] }
    return { items: b.rows, total: b.total === undefined ? b.rows.length : b.total, headers: new Headers() }
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  for (const fn of Object.values(api)) fn.mockReset()
})
afterEach(() => vi.useRealTimers())

describe("getInitiative13LiveSummary", () => {
  const summary = (overrides: Record<string, unknown> = {}) => ({
    totalOarPositions: 44394,
    planBreachCount: 12,
    noPlanCount: 30,
    grNotIssued30DayCount: 8,
    reclassificationCandidateCount: 3,
    valuationIsMocked: true,
    ...overrides,
  })

  it("shows the four figures the backend serves, as the card's first four", async () => {
    api.getI13Summary.mockResolvedValue(summary())
    const s = await getInitiative13LiveSummary()
    expect(s.metrics.slice(0, 4).map((m) => [m.label, m.value])).toEqual([
      ["OAR materials", 44394],
      ["Planned Consumption Overdue", 12],
      ["Non-AI Reservations", 30],
      ["GR not issued 30d+", 8],
    ])
  })

  it("says the two unserved figures are not available instead of approximating them", async () => {
    api.getI13Summary.mockResolvedValue(summary())
    const rest = (await getInitiative13LiveSummary()).metrics.slice(4)
    expect(rest.map((m) => [m.label, m.value])).toEqual([
      ["Unutilized OAR value", "Not available"],
      ["Plan compliance", "Not available"],
    ])
  })

  it("never claims critical from the summary alone", async () => {
    api.getI13Summary.mockResolvedValue(summary())
    expect((await getInitiative13LiveSummary()).health).toBe("attention")
  })

  it("is healthy only when nothing at all needs attention", async () => {
    api.getI13Summary.mockResolvedValue(
      summary({ planBreachCount: 0, noPlanCount: 0, grNotIssued30DayCount: 0, reclassificationCandidateCount: 0 })
    )
    expect((await getInitiative13LiveSummary()).health).toBe("healthy")
  })

  it("throws when the backend fails", async () => {
    api.getI13Summary.mockRejectedValue(new Error("down"))
    await expect(getInitiative13LiveSummary()).rejects.toThrow("down")
  })
})

describe("getInitiative13LiveActions", () => {
  it("fetches each open status separately, capped, and no reclassification candidates", async () => {
    serveExceptions({})
    await getInitiative13LiveActions()
    expect(api.getI13ActExceptionsList.mock.calls.map(([p]) => p)).toEqual([
      { status: "OPEN", limit: 100 },
      { status: "AWAITING_REQUESTER", limit: 100 },
      { status: "ESCALATED", limit: 100 },
    ])
    expect(api.getI13ReclassificationList).not.toHaveBeenCalled()
  })

  it("makes an escalated exception critical and an ordinary open one a warning", async () => {
    serveExceptions({
      OPEN: { rows: [exception("E1", "OPEN")] },
      ESCALATED: { rows: [exception("E2", "ESCALATED")] },
    })
    const { actions } = await getInitiative13LiveActions()
    expect(actions.map((a) => [a.entityId, a.severity])).toEqual([
      ["E1", "warning"],
      ["E2", "critical"],
    ])
  })

  it("makes an exception critical once the requester is past their due date", async () => {
    serveExceptions({
      AWAITING_REQUESTER: {
        rows: [
          exception("late", "AWAITING_REQUESTER", { requesterDueAt: "2026-09-18T00:00:00Z" }),
          exception("not-yet", "AWAITING_REQUESTER", { requesterDueAt: "2026-09-25T00:00:00Z" }),
        ],
      },
    })
    const { actions } = await getInitiative13LiveActions()
    expect(actions.map((a) => [a.entityId, a.severity])).toEqual([
      ["late", "critical"],
      ["not-yet", "warning"],
    ])
    expect(actions[0].dueAt).toBe("2026-09-18T00:00:00Z")
  })

  it("treats every open exception as a decision, titled with its VZI label", async () => {
    serveExceptions({ OPEN: { rows: [exception("E1", "OPEN")] } })
    const result = await getInitiative13LiveActions()
    expect(result.decisions).toHaveLength(1)
    expect(result.actions).toEqual(result.decisions)
    expect(result.decisions[0].title).toMatch(/^Planned Overdue — /)
  })

  it("lists an exception once even if it somehow appears in two buckets", async () => {
    serveExceptions({
      OPEN: { rows: [exception("E1", "OPEN")] },
      ESCALATED: { rows: [exception("E1", "ESCALATED")] },
    })
    expect((await getInitiative13LiveActions()).actions).toHaveLength(1)
  })

  it("sums the real populations and says when the list is only a slice", async () => {
    serveExceptions({
      OPEN: { rows: [exception("E1", "OPEN")], total: 42649 },
      ESCALATED: { rows: [], total: 0 },
    })
    const result = await getInitiative13LiveActions()
    expect(result.total).toBe(42649)
    expect(result.capped).toBe(true)
  })

  it("falls back to the rows it has when the backend sent no total, and is not marked capped", async () => {
    serveExceptions({ OPEN: { rows: [exception("E1", "OPEN"), exception("E2", "OPEN")], total: null } })
    const result = await getInitiative13LiveActions()
    expect(result.total).toBe(2)
    expect(result.capped).toBe(false)
  })

  it("gives an unknown exception type a readable title rather than a blank", async () => {
    serveExceptions({ OPEN: { rows: [exception("E1", "OPEN", { exceptionType: "SOMETHING_NEW" })] } })
    expect((await getInitiative13LiveActions()).actions[0].title).toContain("something new")
  })

  it("throws if a source fails rather than returning a partial queue as complete", async () => {
    api.getI13ActExceptionsList.mockRejectedValue(new Error("queue down"))
    await expect(getInitiative13LiveActions()).rejects.toThrow("queue down")
  })
})

describe("getInitiative13LiveAuditEvents", () => {
  const feedEvent = (overrides: Record<string, unknown> = {}) => ({
    eventId: "77",
    exceptionId: "ACT-1",
    eventType: "DETECTED",
    fromStatus: null,
    toStatus: "OPEN",
    actorId: null,
    actorType: "SYSTEM",
    timestamp: "2026-09-10T08:00:00Z",
    metadata: {},
    ...overrides,
  })

  it("forwards the paging and date bounds", async () => {
    api.getI13ActEvents.mockResolvedValue({ items: [], total: 0, headers: new Headers() })
    await getInitiative13LiveAuditEvents({ limit: 25, fromTs: "2026-09-01T00:00:00Z", toTs: "2026-09-08T00:00:00Z" })
    expect(api.getI13ActEvents).toHaveBeenCalledWith({
      limit: 25,
      fromTs: "2026-09-01T00:00:00Z",
      toTs: "2026-09-08T00:00:00Z",
    })
  })

  it("shows a system run as having no actor, so it reads as System", async () => {
    api.getI13ActEvents.mockResolvedValue({ items: [feedEvent()], total: 9, headers: new Headers() })
    const { events, total } = await getInitiative13LiveAuditEvents({ limit: 25 })
    expect(total).toBe(9)
    expect(events[0]).toMatchObject({
      initiative: "initiative-13",
      entityId: "ACT-1",
      eventType: "Exception detected",
      id: "i13-act-event-77",
    })
    expect(events[0].actor).toBeUndefined()
  })

  it("attributes a person's confirmation to them and shows the status move", async () => {
    api.getI13ActEvents.mockResolvedValue({
      items: [
        feedEvent({
          eventType: "REQUESTER_CONFIRMED",
          fromStatus: "AWAITING_REQUESTER",
          toStatus: "CONFIRMED",
          actorId: "VZIREQ01",
          actorType: "USER",
        }),
      ],
      total: 1,
      headers: new Headers(),
    })
    const [e] = (await getInitiative13LiveAuditEvents({ limit: 25 })).events
    expect(e.actor).toBe("VZIREQ01")
    expect(e.eventType).toBe("Reason given")
    expect(e.description).toContain("Assigned to requester → Reason given")
  })

  it("still gives an event a unique id when the backend sends no event id", async () => {
    api.getI13ActEvents.mockResolvedValue({
      items: [feedEvent({ eventId: null }), feedEvent({ eventId: null, timestamp: "2026-09-11T08:00:00Z" })],
      total: 2,
      headers: new Headers(),
    })
    const { events } = await getInitiative13LiveAuditEvents({ limit: 25 })
    expect(new Set(events.map((e) => e.id)).size).toBe(2)
  })
})
