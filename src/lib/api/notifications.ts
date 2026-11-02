/**
 * The shared notification inbox: `GET/POST /api/notifications/*`.
 *
 * One inbox for every module. The backend returns only the signed-in user's own
 * notifications, so nothing here passes a user id.
 */

import { apiFetch, apiPost } from "@/lib/api/client"

export type InboxFilter = "all" | "unread" | "read"

export type ApiInboxItem = {
  id: string
  title: string
  description: string
  /** What kind of notification, e.g. `APPROVAL_REQUIRED`. */
  eventType: string
  entityType: string | null
  entityId: string | null
  plant: string | null
  /** The page it is about, relative to this app (`/inventory-planning/recommendations/REC-1?review=1`). */
  actionPath: string | null
  isRead: boolean
  /** ISO date-time. */
  createdAt: string
  readAt: string | null
}

export type ApiInboxPage = {
  items: ApiInboxItem[]
  total: number
  page: number
  pageSize: number
  unreadCount: number
}

export type InboxQuery = {
  status?: InboxFilter
  page?: number
  pageSize?: number
}

function queryString(query: InboxQuery): string {
  const params = new URLSearchParams()
  if (query.status && query.status !== "all") params.set("status", query.status)
  if (query.page && query.page > 1) params.set("page", String(query.page))
  if (query.pageSize) params.set("pageSize", String(query.pageSize))
  const encoded = params.toString()
  return encoded ? `?${encoded}` : ""
}

/** `GET /api/notifications` -- my notifications, newest first. */
export function getInbox(query: InboxQuery = {}): Promise<ApiInboxPage> {
  return apiFetch(`/notifications${queryString(query)}`)
}

/** `GET /api/notifications/unread-count` */
export function getUnreadCount(): Promise<{ unread: number }> {
  return apiFetch("/notifications/unread-count")
}

/** `POST /api/notifications/{id}/read` */
export function markNotificationRead(id: string): Promise<ApiInboxItem> {
  return apiPost(`/notifications/${encodeURIComponent(id)}/read`)
}

/** `POST /api/notifications/read-all` */
export function markAllNotificationsRead(): Promise<{ updated: number }> {
  return apiPost("/notifications/read-all")
}
