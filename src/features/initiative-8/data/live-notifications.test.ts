import { describe, expect, it, vi } from "vitest"

import {
  exceptionItemHref,
  isNotificationView,
  loadNotificationsPage,
  notificationsHref,
  parseNotificationParams,
  toNotificationRow,
} from "@/features/initiative-8/data/live-notifications"
import { ApiError } from "@/lib/api/client"
import type { ApiNotification, ApiNotificationsResponse } from "@/lib/api/i8"

function notification(overrides: Partial<ApiNotification> = {}): ApiNotification {
  return {
    id: "NT-1",
    exceptionId: "EX-MISSING_ATTESTATION-4500000677-20",
    type: "MISSING_ATTESTATION",
    severity: "warning",
    title: "Repair line 4500000677-20 has no condition declaration",
    materialId: "8000005632",
    plant: "1300",
    loggedAt: "2026-10-27T08:15:00Z",
    channel: "EMAIL",
    emailed: false,
    ...overrides,
  }
}

function response(overrides: Partial<ApiNotificationsResponse> = {}): ApiNotificationsResponse {
  return { items: [notification()], total: 1, page: 1, pageSize: 25, types: ["MISSING_ATTESTATION"], ...overrides }
}

describe("toNotificationRow", () => {
  it("maps the wire row and labels the type with the queue's own label", () => {
    expect(toNotificationRow(notification())).toEqual({
      id: "NT-1",
      exceptionId: "EX-MISSING_ATTESTATION-4500000677-20",
      type: "MISSING_ATTESTATION",
      typeLabel: "No condition declaration",
      title: "Repair line 4500000677-20 has no condition declaration",
      material: "8000005632",
      plant: "1300",
      loggedAt: "2026-10-27T08:15:00Z",
      emailed: false,
    })
  })

  it("keeps a missing plant as null and an unknown type as its code", () => {
    const row = toNotificationRow(notification({ plant: null, type: "SOMETHING_NEW" }))
    expect(row.plant).toBeNull()
    expect(row.typeLabel).toBe("SOMETHING_NEW")
  })
})

describe("URLs", () => {
  it("reads the view, type and page", () => {
    expect(isNotificationView({ view: "log" })).toBe(true)
    expect(isNotificationView({})).toBe(false)
    expect(isNotificationView({ view: ["log", "log"] })).toBe(false)
    expect(parseNotificationParams({ view: "log", type: "OVERDUE_REPAIR", page: "3" })).toEqual({
      filters: { type: "OVERDUE_REPAIR" },
      page: 3,
    })
    expect(parseNotificationParams({ view: "log" })).toEqual({ filters: { type: undefined }, page: 1 })
  })

  it("builds the log's page links and the queue's item link", () => {
    expect(notificationsHref({})).toBe("/repairable-spares/exceptions?view=log")
    expect(notificationsHref({ type: "OVERDUE_REPAIR" }, 2)).toBe(
      "/repairable-spares/exceptions?view=log&type=OVERDUE_REPAIR&page=2",
    )
    expect(exceptionItemHref("EX-A/1")).toBe("/repairable-spares/exceptions?id=EX-A%2F1")
  })
})

describe("loadNotificationsPage", () => {
  it("asks for 25 rows of the page and type, and maps them", async () => {
    const fetchPage = vi.fn().mockResolvedValue(response({ total: 40 }))
    const page = await loadNotificationsPage({ type: "MISSING_ATTESTATION" }, 2, fetchPage)
    expect(fetchPage).toHaveBeenCalledWith({ page: 2, pageSize: 25, type: "MISSING_ATTESTATION" })
    expect(page).toMatchObject({ available: true, total: 40, types: ["MISSING_ATTESTATION"] })
    expect(page.available && page.rows[0].typeLabel).toBe("No condition declaration")
  })

  it("reads a 404 as no log on this backend, not as an empty log", async () => {
    const fetchPage = vi.fn().mockRejectedValue(new ApiError("Not Found", 404))
    await expect(loadNotificationsPage({}, 1, fetchPage)).resolves.toEqual({ available: false })
  })

  it("lets any other failure through", async () => {
    const fetchPage = vi.fn().mockRejectedValue(new ApiError("Server error", 500))
    await expect(loadNotificationsPage({}, 1, fetchPage)).rejects.toThrow("Server error")
  })
})
