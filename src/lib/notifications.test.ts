import { readFileSync } from "node:fs"
import { join } from "node:path"

import { afterEach, describe, expect, it, vi } from "vitest"

import type { ApiInboxItem } from "@/lib/api/notifications"
import {
  INBOX_FILTERS,
  actionLabelOf,
  dayKeyOf,
  greetingFor,
  inDateRange,
  formatNotificationTime,
  formatRelativeTime,
  groupByDate,
  materialOf,
  moduleOf,
  notificationTypeLabel,
  parseFilter,
  referenceOf,
  safeActionPath,
  severityOf,
  TYPE_FILTER_OPTIONS,
  typeFamilyOf,
  unreadBadge,
  withRead,
} from "@/lib/notifications"

function item(overrides: Partial<ApiInboxItem> = {}): ApiInboxItem {
  return {
    id: "n1",
    title: "Approval Required – Material Recommendation",
    description: "A new inventory recommendation for Plant 1300 is waiting for your approval.\nMaterial: 5000092261",
    eventType: "APPROVAL_REQUIRED",
    entityType: "RECOMMENDATION",
    entityId: "REC-1",
    plant: "1300",
    actionPath: "/inventory-planning/recommendations/REC-1?review=1",
    isRead: false,
    createdAt: "2026-11-02T09:00:00Z",
    readAt: null,
    ...overrides,
  }
}

describe("the inbox filters", () => {
  it("offers All, Unread and Read", () => {
    expect(INBOX_FILTERS.map((f) => f.label)).toEqual(["All", "Unread", "Read"])
  })

  it("reads an unknown filter as All", () => {
    expect(parseFilter("unread")).toBe("unread")
    expect(parseFilter("read")).toBe("read")
    expect(parseFilter("everything")).toBe("all")
    expect(parseFilter(undefined)).toBe("all")
  })
})

describe("the unread badge", () => {
  it("is absent when everything is read and the count otherwise", () => {
    expect(unreadBadge(0)).toBeUndefined()
    expect(unreadBadge(3)).toBe(3)
  })
})

describe("clicking a notification only ever stays inside the app", () => {
  it("follows a path inside the app, query string and all", () => {
    expect(safeActionPath("/inventory-planning/recommendations/REC-1?review=1")).toBe(
      "/inventory-planning/recommendations/REC-1?review=1",
    )
  })

  it.each(["https://evil.example.com", "//evil.example.com", "javascript:alert(1)", "approvals", "", null, undefined])(
    "refuses %s",
    (path) => {
      expect(safeActionPath(path as string | null | undefined)).toBeNull()
    },
  )
})

describe("what a row shows", () => {
  it("labels the type in business words, never a module name", () => {
    expect(notificationTypeLabel("APPROVAL_REQUIRED")).toBe("Approval required")
    expect(notificationTypeLabel("EXCEPTION_ESCALATED")).toBe("Escalation required")
    expect(notificationTypeLabel("EXCEPTION_RESPONSE_REQUIRED")).toBe("Confirm exception")
    expect(notificationTypeLabel("SOMETHING_NEW")).toBe("Notification")
    expect(notificationTypeLabel("PR_RECEIVED")).toBe("Purchase requisition")
    expect(notificationTypeLabel("PR_RECEIVED_DETAILS")).toBe("Purchase requisition")
    const everyLabel = ["APPROVAL_REQUIRED", "APPROVAL_REMINDER", "EXCEPTION_ACTION_REQUIRED", "EXCEPTION_RESPONSE_REQUIRED"].map(
      notificationTypeLabel,
    )
    for (const label of everyLabel) expect(label).not.toMatch(/\bI\s?0?(7|8|13)\b/i)
  })

  it("shows the material as the reference, else the item id", () => {
    expect(materialOf(item().description)).toBe("5000092261")
    expect(referenceOf(item())).toBe("5000092261")
    expect(referenceOf(item({ description: "Something happened", entityId: "EX-42" }))).toBe("EX-42")
    expect(referenceOf(item({ description: "Material: -", entityId: null }))).toBeNull()
  })

  it("formats the date and time, and tolerates a bad one", () => {
    expect(formatNotificationTime("2026-11-02T09:00:00Z")).toMatch(/2 Nov 2026/)
    expect(formatNotificationTime("not a date")).toBe("")
  })
})

describe("how urgent, where from, and when", () => {
  const now = new Date(2026, 10, 3, 12, 0, 0)

  it("ranks escalations and rejections above reminders, and completions as calm", () => {
    expect(severityOf("APPROVAL_ESCALATED")).toBe("critical")
    expect(severityOf("APPROVAL_REJECTED")).toBe("critical")
    expect(severityOf("APPROVAL_REMINDER")).toBe("warning")
    expect(severityOf("APPROVAL_COMPLETED")).toBe("success")
    expect(severityOf("APPROVAL_REQUIRED")).toBe("info")
    expect(severityOf("SOMETHING_NEW")).toBe("info")
  })

  it("sorts every event into the family the Type filter offers", () => {
    expect(typeFamilyOf("PR_RECEIVED")).toBe("pr")
    expect(typeFamilyOf("PR_RECEIVED_DETAILS")).toBe("pr")
    expect(typeFamilyOf("APPROVAL_REQUIRED")).toBe("approval")
    expect(typeFamilyOf("EXCEPTION_ESCALATED")).toBe("exception")
    expect(typeFamilyOf("RESERVATION_LINKED")).toBe("reservation")
    expect(typeFamilyOf("SOMETHING_NEW")).toBe("other")
  })

  it("offers purchase requisitions first among the Type choices", () => {
    expect(TYPE_FILTER_OPTIONS[0]).toEqual({ value: "pr", label: "Purchase requisitions" })
    expect(TYPE_FILTER_OPTIONS.map((option) => option.value)).not.toContain("other")
  })

  it("matches a notification to a day or a range of days, by local date", () => {
    const at = new Date(2026, 10, 2, 23, 30).toISOString()
    expect(dayKeyOf(at)).toBe("2026-11-02")
    expect(dayKeyOf("not a date")).toBe("")
    expect(inDateRange(at, "", "")).toBe(true)
    expect(inDateRange(at, "2026-11-02", "2026-11-02")).toBe(true)
    expect(inDateRange(at, "2026-11-03", "")).toBe(false)
    expect(inDateRange(at, "", "2026-11-01")).toBe(false)
    expect(inDateRange(at, "2026-10-30", "2026-11-03")).toBe(true)
    expect(inDateRange("not a date", "2026-11-02", "")).toBe(false)
  })

  it("greets the person by first name, tolerating usernames and no name", () => {
    expect(greetingFor("Khushi Patil")).toBe("Dear Khushi,")
    expect(greetingFor("lynn.boyce")).toBe("Dear Lynn,")
    expect(greetingFor("simone")).toBe("Dear Simone,")
    expect(greetingFor("paul@example.com")).toBe("Dear Paul,")
    expect(greetingFor("")).toBe("Dear colleague,")
    expect(greetingFor(null)).toBe("Dear colleague,")
  })

  it("labels the button as the email does", () => {
    expect(actionLabelOf("APPROVAL_REQUIRED")).toBe("Open Review Workspace")
    expect(actionLabelOf("APPROVAL_ESCALATED")).toBe("Open Review Workspace")
    expect(actionLabelOf("EXCEPTION_ACTION_REQUIRED")).toBe("Open Exception")
    expect(actionLabelOf("GENERAL")).toBe("Open")
    expect(actionLabelOf("RESERVATION_LINKED")).toBe("Open Request")
    expect(actionLabelOf("RESERVATION_LINK_REMINDER")).toBe("Open Request")
  })

  it("names a request's reservation notices", () => {
    const linked = item({ eventType: "RESERVATION_LINKED", actionPath: "/assistant/requests/RSA1MT7EKP" })
    expect(notificationTypeLabel("RESERVATION_LINKED")).toBe("Reservation linked")
    expect(notificationTypeLabel("RESERVATION_LINK_REMINDER")).toBe("Reservation not linked")
    expect(severityOf("RESERVATION_LINKED")).toBe("success")
    expect(severityOf("RESERVATION_LINK_REMINDER")).toBe("warning")
    expect(moduleOf(linked)).toBe("Reservation assistant")
  })

  it("names the module in words from the page it opens", () => {
    expect(moduleOf(item())).toBe("Inventory Planning")
    expect(moduleOf(item({ actionPath: "/oar-utilization/watch" }))).toBe("OAR Utilization")
    expect(moduleOf(item({ actionPath: "/oar-utilization/aging-exceptions?material=4000002200&plant=1300" }))).toBe("OAR Utilization")
    // Exception notifications are OAR's now; Repairable Spares sends none and has no module name here.
    expect(moduleOf(item({ actionPath: null, eventType: "EXCEPTION_ESCALATED" }))).toBe("OAR Utilization")
    expect(moduleOf(item({ actionPath: "/repairable-spares/exceptions", eventType: "APPROVAL_REQUIRED" }))).toBeNull()
    expect(moduleOf(item({ actionPath: null }))).toBeNull()
    for (const label of ["/inventory-planning", "/oar-utilization"].map((actionPath) => moduleOf(item({ actionPath })))) {
      expect(label).not.toMatch(/\bI\s?0?(7|8|13)\b/i)
    }
  })

  it("groups a newest-first list under Today, Yesterday and Earlier", () => {
    const at = (d: number, h = 9) => new Date(2026, 10, d, h).toISOString()
    const groups = groupByDate([{ createdAt: at(3, 8) }, { createdAt: at(2) }, { createdAt: at(1) }, { createdAt: at(1, 7) }], now)
    expect(groups.map((g) => [g.group, g.items.length])).toEqual([
      ["Today", 1],
      ["Yesterday", 1],
      ["Earlier", 2],
    ])
  })

  it("shows how long ago, then the date once it is over a day old", () => {
    expect(formatRelativeTime(new Date(2026, 10, 3, 11, 59, 40).toISOString(), now)).toBe("Just now")
    expect(formatRelativeTime(new Date(2026, 10, 3, 11, 55).toISOString(), now)).toBe("5m ago")
    expect(formatRelativeTime(new Date(2026, 10, 3, 9).toISOString(), now)).toBe("3h ago")
    expect(formatRelativeTime(new Date(2026, 9, 28, 9).toISOString(), now)).toMatch(/28 Oct 2026/)
    expect(formatRelativeTime("not a date", now)).toBe("")
  })
})

describe("marking read on the screen", () => {
  it("marks only the one notification, and only if it was unread", () => {
    const before = [item({ id: "a" }), item({ id: "b" }), item({ id: "c", isRead: true, readAt: "2026-11-01T00:00:00Z" })]

    const after = withRead(before, "a", "2026-11-02T10:00:00Z")

    expect(after.map((n) => n.isRead)).toEqual([true, false, true])
    expect(after[0].readAt).toBe("2026-11-02T10:00:00Z")
    expect(withRead(before, "c", "2026-11-02T10:00:00Z")[2].readAt).toBe("2026-11-01T00:00:00Z")
    expect(before[0].isRead).toBe(false) // the original list is untouched
  })
})

describe("Notifications sit under More", () => {
  const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8")

  it("is one of the quick actions the sidebar's More group is built from", () => {
    const constants = source("src/lib/constants.ts")
    expect(constants).toMatch(/label: "Notifications", icon: "bell", href: "\/notifications"/)
    expect(constants).toContain("bell: Bell")
    // More = QUICK_ACTIONS minus Home
    expect(source("src/components/layout/sidebar.tsx")).toMatch(/title: "More"[\s\S]*QUICK_ACTIONS\.filter/)
  })

  it("shows the unread count as the badge on that link and no other", () => {
    expect(source("src/components/layout/sidebar.tsx")).toMatch(
      /action\.href === NOTIFICATIONS_PATH \? unreadBadge\(unreadNotifications\) : action\.badge/,
    )
  })

  it("has a route and a loading screen", () => {
    expect(source("src/app/(live)/notifications/page.tsx")).toContain("NotificationsPage")
    expect(source("src/app/(live)/notifications/loading.tsx")).toContain("<PageLoader")
  })
})

describe("the inbox API calls", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  async function lastCall(run: () => Promise<unknown>, body: unknown = {}) {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)
    await run()
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit | undefined]
    return { url, method: init?.method ?? "GET" }
  }

  it("asks for a filter and a page only when they are not the defaults", async () => {
    const { getInbox } = await import("@/lib/api/notifications")
    expect((await lastCall(() => getInbox())).url).toMatch(/\/notifications$/)
    expect((await lastCall(() => getInbox({ status: "unread", page: 2, pageSize: 20 }))).url).toMatch(
      /\/notifications\?status=unread&page=2&pageSize=20$/,
    )
  })

  it("marks one or all as read with a POST, and never sends a user id", async () => {
    const { markAllNotificationsRead, markNotificationRead } = await import("@/lib/api/notifications")
    const one = await lastCall(() => markNotificationRead("abc/123"))
    expect(one.method).toBe("POST")
    expect(one.url).toMatch(/\/notifications\/abc%2F123\/read$/)
    const all = await lastCall(() => markAllNotificationsRead())
    expect(all.method).toBe("POST")
    expect(all.url).toMatch(/\/notifications\/read-all$/)
  })
})
