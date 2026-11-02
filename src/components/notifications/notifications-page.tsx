"use client"

import { Bell, CheckCheck } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"

import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { ProfileMenu } from "@/components/shared/profile-menu"
import { TablePagination } from "@/components/shared/table-pagination"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  getInbox,
  markAllNotificationsRead,
  markNotificationRead,
  type ApiInboxItem,
  type ApiInboxPage,
  type InboxFilter,
} from "@/lib/api/notifications"
import {
  INBOX_FILTERS,
  INBOX_PAGE_SIZE,
  UNREAD_CHANGED_EVENT,
  formatNotificationTime,
  notificationTypeLabel,
  parseFilter,
  referenceOf,
  safeActionPath,
  withRead,
} from "@/lib/notifications"
import { cn } from "@/lib/utils"

const EMPTY_TEXT: Record<InboxFilter, { title: string; description: string }> = {
  all: { title: "No notifications yet", description: "When something needs your attention it will appear here." },
  unread: { title: "You're all caught up", description: "There are no unread notifications." },
  read: { title: "No read notifications", description: "Notifications you have read will appear here." },
}

function announceChange() {
  window.dispatchEvent(new Event(UNREAD_CHANGED_EVENT))
}

/**
 * The one notification inbox, under More. Shows only the signed-in user's own
 * notifications (the backend decides that), whichever module raised them.
 */
export function NotificationsPage() {
  const router = useRouter()
  const [filter, setFilter] = useState<InboxFilter>("all")
  const [page, setPage] = useState(1)
  // What was last fetched, and for which request. "Loading" is then just "the latest
  // request has not answered yet", so nothing sets state synchronously in the effect.
  const [loaded, setLoaded] = useState<{ key: string; page: ApiInboxPage } | null>(null)
  const [failed, setFailed] = useState<{ key: string; message: string } | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const requestKey = `${filter}|${page}|${reloadKey}`

  useEffect(() => {
    let cancelled = false
    getInbox({ status: filter, page, pageSize: INBOX_PAGE_SIZE })
      .then((result) => {
        if (cancelled) return
        setLoaded({ key: requestKey, page: result })
        setFailed(null)
        setActionError(null)
      })
      .catch((failure: unknown) => {
        if (cancelled) return
        setFailed({
          key: requestKey,
          message: failure instanceof Error ? failure.message : "The notifications could not be loaded.",
        })
      })
    return () => {
      cancelled = true
    }
  }, [filter, page, requestKey])

  const data = loaded?.page ?? null
  const loading = loaded?.key !== requestKey && failed?.key !== requestKey
  const error = actionError ?? (failed?.key === requestKey ? failed.message : null)

  const markRead = useCallback(async (item: ApiInboxItem) => {
    if (item.isRead) return
    try {
      const updated = await markNotificationRead(item.id)
      setLoaded((current) =>
        current
          ? {
              ...current,
              page: {
                ...current.page,
                unreadCount: Math.max(0, current.page.unreadCount - 1),
                items: withRead(current.page.items, item.id, updated.readAt ?? new Date().toISOString()),
              },
            }
          : current
      )
      announceChange()
    } catch (failure) {
      setActionError(failure instanceof Error ? failure.message : "Could not mark the notification as read.")
    }
  }, [])

  const open = useCallback(
    async (item: ApiInboxItem) => {
      await markRead(item)
      const path = safeActionPath(item.actionPath)
      if (path) router.push(path)
    },
    [markRead, router]
  )

  const markAllRead = useCallback(async () => {
    try {
      await markAllNotificationsRead()
      announceChange()
      setReloadKey((key) => key + 1)
    } catch (failure) {
      setActionError(failure instanceof Error ? failure.message : "Could not mark the notifications as read.")
    }
  }, [])

  const unread = data?.unreadCount ?? 0
  const items = data?.items ?? []

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-4xl flex-col gap-4">
        <PageHeader
          title="Notifications"
          description={unread > 0 ? `${unread} unread` : "Everything you need to act on, across all modules."}
          actions={
            <>
              <Button variant="outline" size="sm" onClick={markAllRead} disabled={unread === 0}>
                <CheckCheck />
                Mark all as read
              </Button>
              <ProfileMenu />
            </>
          }
        />

        <Tabs
          value={filter}
          onValueChange={(value) => {
            setFilter(parseFilter(value))
            setPage(1)
          }}
        >
          <TabsList>
            {INBOX_FILTERS.map((option) => (
              <TabsTrigger key={option.value} value={option.value}>
                {option.label}
                {option.value === "unread" && unread > 0 ? ` (${unread})` : ""}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {error && (
          <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {!data && loading ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Loading notifications…</p>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Bell className="size-4" />}
            title={EMPTY_TEXT[filter].title}
            description={EMPTY_TEXT[filter].description}
          />
        ) : (
          <ul className={cn("flex flex-col gap-2", loading && "opacity-60")}>
            {items.map((item) => (
              <NotificationRow key={item.id} item={item} onOpen={open} onMarkRead={markRead} />
            ))}
          </ul>
        )}

        {data && (
          <TablePagination
            page={data.page}
            pageSize={data.pageSize}
            total={data.total}
            count={items.length}
            noun="notifications"
            onPageChange={setPage}
            loading={loading}
          />
        )}
      </div>
    </div>
  )
}

function NotificationRow({
  item,
  onOpen,
  onMarkRead,
}: {
  item: ApiInboxItem
  onOpen: (item: ApiInboxItem) => void
  onMarkRead: (item: ApiInboxItem) => void
}) {
  const reference = referenceOf(item)
  const opensAPage = safeActionPath(item.actionPath) !== null
  return (
    <li
      className={cn(
        "flex items-start gap-3 rounded-xl border p-4",
        item.isRead ? "border-border bg-card" : "border-primary/30 bg-primary/5"
      )}
    >
      <span
        aria-label={item.isRead ? "Read" : "Unread"}
        className={cn("mt-1.5 size-2 shrink-0 rounded-full", item.isRead ? "bg-transparent" : "bg-primary")}
      />
      <button
        type="button"
        onClick={() => onOpen(item)}
        className="min-w-0 flex-1 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        title={opensAPage ? "Open" : undefined}
      >
        <div className={cn("text-sm text-foreground", !item.isRead && "font-semibold")}>{item.title}</div>
        <p className="mt-1 line-clamp-2 whitespace-pre-line text-xs text-muted-foreground">{item.description}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <Badge variant="outline">{notificationTypeLabel(item.eventType)}</Badge>
          {reference && <span>Ref {reference}</span>}
          {item.plant && <span>Plant {item.plant}</span>}
          <span>{formatNotificationTime(item.createdAt)}</span>
        </div>
      </button>
      {!item.isRead && (
        <Button variant="ghost" size="xs" onClick={() => onMarkRead(item)}>
          Mark as read
        </Button>
      )}
    </li>
  )
}
