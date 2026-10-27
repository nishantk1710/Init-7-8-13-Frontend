/**
 * FR-11's notification log, for the Repair Exceptions screen's "Notification
 * log" view (27-Oct-2026).
 *
 * FR-11 asks for notifications "through the exception queue and email". The
 * backend logs one notification per exception, the first time the checks find
 * it actionable, for the types `I8_NOTIFICATION_TYPES` names. Email is not
 * sent yet: the log is the list it will send, and the screen says so.
 *
 * The endpoint is optional. A backend older than the log answers 404, and the
 * screen then says the log is not available rather than showing "0 logged":
 * an empty log and a missing one mean different things.
 *
 * The only place the wire shape is read.
 */

import { EXCEPTIONS_PATH } from "@/features/initiative-8/data/live-exceptions"
import { single, type RawSearchParams } from "@/features/initiative-8/data/url-params"
import { exceptionTypeLabel } from "@/features/initiative-8/utils/status"
import { ApiError } from "@/lib/api/client"
import { getNotifications, type ApiNotification } from "@/lib/api/i8"
import { DEFAULT_PAGE_SIZE, parsePage } from "@/lib/pagination"

/** `?view=` value that opens the log instead of the queue. */
export const NOTIFICATION_VIEW = "log"

/** Shown above the log, while email is not wired. */
export const NOTIFICATION_EMAIL_NOTE = "Email is not sent yet -- this is the list it will send."

/** Shown in place of the log when the backend has none. */
export const NOTIFICATION_UNAVAILABLE = "The notification log is not available on this backend."

export type NotificationRow = {
  id: string
  exceptionId: string
  type: string
  typeLabel: string
  title: string
  material: string
  /** Null when the exception has no plant -- shown as a dash, not guessed. */
  plant: string | null
  /** ISO date-time. */
  loggedAt: string
  emailed: boolean
}

export function toNotificationRow(item: ApiNotification): NotificationRow {
  return {
    id: item.id,
    exceptionId: item.exceptionId,
    type: item.type,
    typeLabel: exceptionTypeLabel(item.type),
    title: item.title,
    material: item.materialId,
    plant: item.plant ?? null,
    loggedAt: item.loggedAt,
    emailed: item.emailed === true,
  }
}

export type NotificationFilters = { type?: string }

export function parseNotificationParams(raw: RawSearchParams): { filters: NotificationFilters; page: number } {
  return { filters: { type: single(raw.type) }, page: parsePage(raw.page) ?? 1 }
}

/** True when the URL asks for the log rather than the queue. */
export function isNotificationView(raw: RawSearchParams): boolean {
  return single(raw.view) === NOTIFICATION_VIEW
}

/** One page of the log, keeping its type filter. Page 1 drops `page`. */
export function notificationsHref(filters: NotificationFilters, page = 1): string {
  const params = new URLSearchParams({ view: NOTIFICATION_VIEW })
  if (filters.type) params.set("type", filters.type)
  if (page > 1) params.set("page", String(page))
  return `${EXCEPTIONS_PATH}?${params.toString()}`
}

/** The queue's own item link: `?id=` opens that exception's drawer. */
export function exceptionItemHref(exceptionId: string): string {
  return `${EXCEPTIONS_PATH}?${new URLSearchParams({ id: exceptionId }).toString()}`
}

export type NotificationsPage =
  | { available: true; rows: NotificationRow[]; total: number; types: string[] }
  | { available: false }

/**
 * One page of the log. A 404 is "no log on this backend" and comes back as
 * `available: false`; any other failure throws, so the screen can say the
 * request failed rather than that nothing was logged.
 */
export async function loadNotificationsPage(
  filters: NotificationFilters,
  page: number,
  fetchPage: typeof getNotifications = getNotifications,
): Promise<NotificationsPage> {
  try {
    const body = await fetchPage({ page, pageSize: DEFAULT_PAGE_SIZE, type: filters.type })
    return {
      available: true,
      rows: (body.items ?? []).map(toNotificationRow),
      total: body.total ?? 0,
      types: body.types ?? [],
    }
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return { available: false }
    throw error
  }
}
