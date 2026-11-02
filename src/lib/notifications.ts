/**
 * Small pure helpers for the notification inbox, kept out of the components so
 * they can be tested without rendering anything.
 */

import type { ApiInboxItem, InboxFilter } from "@/lib/api/notifications"

export const NOTIFICATIONS_PATH = "/notifications"

/** Dispatched after something changes how many notifications are unread, so the sidebar badge refetches. */
export const UNREAD_CHANGED_EVENT = "spares:notifications-changed"

export const INBOX_FILTERS: { value: InboxFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "read", label: "Read" },
]

export const INBOX_PAGE_SIZE = 20

export function parseFilter(value: unknown): InboxFilter {
  return value === "unread" || value === "read" ? value : "all"
}

/**
 * The in-app path to open for a notification, or null.
 *
 * Only a path inside this app is followed: one leading slash, no scheme and no
 * host, so a notification can never send someone to another site.
 */
export function safeActionPath(path: string | null | undefined): string | null {
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.includes("://")) return null
  return path
}

/** The sidebar badge: nothing at all when everything is read. */
export function unreadBadge(unread: number): number | undefined {
  return unread > 0 ? unread : undefined
}

const TYPE_LABELS: Record<string, string> = {
  APPROVAL_REQUIRED: "Approval required",
  APPROVAL_SENT_BACK: "Sent back",
  APPROVAL_REJECTED: "Rejected",
  APPROVAL_ON_HOLD: "On hold",
  APPROVAL_HOLD_RELEASED: "Hold released",
  APPROVAL_ADJUSTED: "Adjusted",
  APPROVAL_COMPLETED: "Approved",
  APPROVAL_REMINDER: "Reminder",
  APPROVAL_ESCALATED: "Escalation required",
  EXCEPTION_ACTION_REQUIRED: "Inventory exception",
  EXCEPTION_RESPONSE_REQUIRED: "Inventory exception",
  EXCEPTION_ESCALATED: "Escalation required",
}

export function notificationTypeLabel(eventType: string): string {
  return TYPE_LABELS[eventType] ?? "Notification"
}

/** The material a notification mentions (`Material: 5000092261`), if its text names one. */
export function materialOf(description: string): string | null {
  const match = /Material:\s*(\S+)/.exec(description)
  return match && match[1] !== "-" ? match[1] : null
}

/** What to show as the related reference: the material when there is one, else the item's id. */
export function referenceOf(item: Pick<ApiInboxItem, "description" | "entityId">): string | null {
  return materialOf(item.description) ?? item.entityId
}

export function formatNotificationTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(date)
}

/** Apply a read mark to a list already on screen, without waiting for a refetch. */
export function withRead(items: ApiInboxItem[], id: string, readAt: string): ApiInboxItem[] {
  return items.map((item) => (item.id === id && !item.isRead ? { ...item, isRead: true, readAt } : item))
}
