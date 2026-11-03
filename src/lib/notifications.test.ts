import { readFileSync } from "node:fs"
import { join } from "node:path"

import { afterEach, describe, expect, it, vi } from "vitest"

import type { ApiInboxItem } from "@/lib/api/notifications"
import {
  INBOX_FILTERS,
  formatNotificationTime,
  materialOf,
  notificationTypeLabel,
  parseFilter,
  referenceOf,
  safeActionPath,
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
