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
  APPROVAL_SAP_UPDATE_REQUIRED: "Update SAP",
  APPROVAL_SAP_UPDATE_REMINDER: "SAP update pending",
  APPROVAL_SAP_UPDATE_FINAL_REMINDER: "SAP update due",
  APPROVAL_SAP_UPDATE_RESULT: "SAP update result",
  EXCEPTION_ACTION_REQUIRED: "Inventory exception",
  EXCEPTION_RESPONSE_REQUIRED: "Confirm exception",
  EXCEPTION_ESCALATED: "Escalation required",
  PR_RECEIVED: "Purchase requisition",
  PR_RECEIVED_DETAILS: "Purchase requisition",
  RESERVATION_LINKED: "Reservation linked",
  RESERVATION_LINK_REMINDER: "Reservation not linked",
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

/**
 * The button label the email carries for this event (backend `templates.py`), so the
 * in-app message reads the same as the mail. An unknown type gets the general "Open".
 */
export function actionLabelOf(eventType: string): string {
  if (eventType.startsWith("APPROVAL_")) return "Open Review Workspace"
  if (eventType.startsWith("EXCEPTION_")) return "Open Exception"
  if (eventType.startsWith("RESERVATION_")) return "Open Request"
  return "Open"
}

/** "Dear Khushi," -- the first word of the person's name, or a plain "Dear colleague," when there is none. */
export function greetingFor(name: string | null | undefined): string {
  const first = (name ?? "").trim().split(/\s+/)[0] ?? ""
  // A bare username such as "lynn.boyce" or an e-mail is not a name: take its first part, capitalised.
  const word = first.split(/[@._-]/)[0] ?? ""
  return word ? `Dear ${word.charAt(0).toUpperCase()}${word.slice(1)},` : "Dear colleague,"
}

export const EMAIL_SIGN_OFF = ["Regards,", "Spares AI team", "Vedanta Zinc International"] as const

export type NotificationSeverity = "critical" | "warning" | "success" | "info"

const SEVERITY: Record<string, NotificationSeverity> = {
  APPROVAL_ESCALATED: "critical",
  EXCEPTION_ESCALATED: "critical",
  APPROVAL_REJECTED: "critical",
  APPROVAL_REMINDER: "warning",
  APPROVAL_SAP_UPDATE_REQUIRED: "warning",
  APPROVAL_SAP_UPDATE_REMINDER: "warning",
  APPROVAL_SAP_UPDATE_FINAL_REMINDER: "critical",
  RESERVATION_LINK_REMINDER: "warning",
  APPROVAL_ON_HOLD: "warning",
  APPROVAL_SENT_BACK: "warning",
  EXCEPTION_ACTION_REQUIRED: "warning",
  EXCEPTION_RESPONSE_REQUIRED: "warning",
  APPROVAL_COMPLETED: "success",
  RESERVATION_LINKED: "success",
  APPROVAL_HOLD_RELEASED: "success",
}

/** How urgent a notification looks: escalations and rejections stand out, completions are calm. */
export function severityOf(eventType: string): NotificationSeverity {
  return SEVERITY[eventType] ?? "info"
}

export type NotificationTypeFamily = "pr" | "approval" | "exception" | "reservation" | "other"

/** The inbox's Type filter: each family of events someone may want on its own, PRs first. */
export const TYPE_FILTER_OPTIONS: { value: NotificationTypeFamily; label: string }[] = [
  { value: "pr", label: "Purchase requisitions" },
  { value: "approval", label: "Approvals" },
  { value: "exception", label: "Exceptions" },
  { value: "reservation", label: "Reservations" },
]

/** The family an event belongs to, by the prefix the backend names its events with. */
export function typeFamilyOf(eventType: string): NotificationTypeFamily {
  if (eventType.startsWith("PR_")) return "pr"
  if (eventType.startsWith("APPROVAL_")) return "approval"
  if (eventType.startsWith("EXCEPTION_")) return "exception"
  if (eventType.startsWith("RESERVATION_")) return "reservation"
  return "other"
}

const MODULE_PREFIXES: { prefix: string; label: string }[] = [
  { prefix: "/inventory-planning", label: "Inventory Planning" },
  { prefix: "/oar-utilization", label: "OAR Utilization" },
  { prefix: "/assistant", label: "Reservation assistant" },
]

/** The module a notification belongs to, by the page it opens; null when it opens none of them. */
export function moduleOf(item: Pick<ApiInboxItem, "actionPath" | "eventType">): string | null {
  const path = safeActionPath(item.actionPath)
  const byPath = path ? MODULE_PREFIXES.find((m) => path === m.prefix || path.startsWith(`${m.prefix}/`) || path.startsWith(`${m.prefix}?`)) : undefined
  if (byPath) return byPath.label
  // Exception notifications now come from OAR Utilization only (Repairable Spares no longer sends any).
  return item.eventType.startsWith("EXCEPTION_") ? "OAR Utilization" : null
}

export type DateGroup = "Today" | "Yesterday" | "Earlier"

export function dateGroupOf(iso: string, now: Date = new Date()): DateGroup {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "Earlier"
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000)
  return days <= 0 ? "Today" : days === 1 ? "Yesterday" : "Earlier"
}

/** Group an already newest-first list under Today / Yesterday / Earlier, keeping its order. */
export function groupByDate<T extends Pick<ApiInboxItem, "createdAt">>(items: T[], now: Date = new Date()): { group: DateGroup; items: T[] }[] {
  const groups: { group: DateGroup; items: T[] }[] = []
  for (const item of items) {
    const group = dateGroupOf(item.createdAt, now)
    const last = groups[groups.length - 1]
    if (last && last.group === group) last.items.push(item)
    else groups.push({ group, items: [item] })
  }
  return groups
}

/** "Just now", "5m ago", "3h ago", then the full date once it is more than a day old. */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000)
  if (minutes < 1) return "Just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return formatNotificationTime(iso)
}

/** The local calendar day of an ISO time, as the `YYYY-MM-DD` a date input gives; "" for a bad time. */
export function dayKeyOf(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Whether a notification falls on or between the chosen days (either end may be empty). */
export function inDateRange(iso: string, from: string, to: string): boolean {
  if (!from && !to) return true
  const day = dayKeyOf(iso)
  if (!day) return false
  return (!from || day >= from) && (!to || day <= to)
}

/** With a date chosen the backend cannot narrow by day, so look through this many of the newest instead of one page. */
export const DATE_SEARCH_LIMIT = 100

/** Apply a read mark to a list already on screen, without waiting for a refetch. */
export function withRead(items: ApiInboxItem[], id: string, readAt: string): ApiInboxItem[] {
  return items.map((item) => (item.id === id && !item.isRead ? { ...item, isRead: true, readAt } : item))
}
