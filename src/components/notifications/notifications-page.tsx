"use client"

import { Bell, CheckCheck, CircleCheck, Clock, Info, TriangleAlert, type LucideIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"

import { ClearFiltersButton } from "@/components/shared/clear-filters-button"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { PageLoader } from "@/components/shared/page-loader"
import { ProfileMenu } from "@/components/shared/profile-menu"
import { TablePagination } from "@/components/shared/table-pagination"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useCurrentUser } from "@/hooks/use-current-user"
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
  DATE_SEARCH_LIMIT,
  EMAIL_SIGN_OFF,
  UNREAD_CHANGED_EVENT,
  actionLabelOf,
  greetingFor,
  formatNotificationTime,
  formatRelativeTime,
  groupByDate,
  inDateRange,
  moduleOf,
  notificationTypeLabel,
  parseFilter,
  safeActionPath,
  severityOf,
  withRead,
  type NotificationSeverity,
} from "@/lib/notifications"
import { cn } from "@/lib/utils"

const EMPTY_TEXT: Record<InboxFilter, { title: string; description: string }> = {
  all: { title: "No notifications yet", description: "When something needs your attention it will appear here." },
  unread: { title: "You're all caught up", description: "There are no unread notifications." },
  read: { title: "No read notifications", description: "Notifications you have read will appear here." },
}

const MODULE_OPTIONS = ["Inventory Planning", "OAR Utilization"]

const PRIORITY_OPTIONS: { value: NotificationSeverity; label: string }[] = [
  { value: "critical", label: "Escalated / rejected" },
  { value: "warning", label: "Needs attention" },
  { value: "info", label: "New" },
  { value: "success", label: "Completed" },
]

/** How often the open inbox quietly asks for anything new. */
const REFRESH_MS = 60_000

const SEVERITY_STYLE: Record<NotificationSeverity, { icon: LucideIcon; tint: string }> = {
  critical: { icon: TriangleAlert, tint: "text-destructive" },
  warning: { icon: Clock, tint: "text-amber-600 dark:text-amber-400" },
  success: { icon: CircleCheck, tint: "text-emerald-600 dark:text-emerald-400" },
  info: { icon: Info, tint: "text-action" },
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
  const user = useCurrentUser()
  const [filter, setFilter] = useState<InboxFilter>("all")
  const [page, setPage] = useState(1)
  // What was last fetched, and for which request. "Loading" is then just "the latest
  // request has not answered yet", so nothing sets state synchronously in the effect.
  const [loaded, setLoaded] = useState<{ key: string; page: ApiInboxPage } | null>(null)
  const [failed, setFailed] = useState<{ key: string; message: string } | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  // Module and priority narrow the page already fetched; only Status is asked of the backend.
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [moduleFilter, setModuleFilter] = useState("all")
  const [priorityFilter, setPriorityFilter] = useState("all")

  // Day range, as `YYYY-MM-DD` from a date input. The backend cannot narrow by day, so while one is set the
  // newest DATE_SEARCH_LIMIT notifications are fetched in one go and narrowed here.
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const dateActive = dateFrom !== "" || dateTo !== ""

  const requestKey = `${filter}|${page}|${reloadKey}|${dateActive}`

  useEffect(() => {
    let cancelled = false
    getInbox({
      status: filter,
      page: dateActive ? 1 : page,
      pageSize: dateActive ? DATE_SEARCH_LIMIT : INBOX_PAGE_SIZE,
    })
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
  }, [filter, page, dateActive, requestKey])

  // A new notification should show up without a reload: refetch while the tab is in view.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") setReloadKey((key) => key + 1)
    }, REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [])

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
  const items = (data?.items ?? []).filter(
    (item) =>
      (moduleFilter === "all" || moduleOf(item) === moduleFilter) &&
      (priorityFilter === "all" || severityOf(item.eventType) === priorityFilter) &&
      inDateRange(item.createdAt, dateFrom, dateTo)
  )
  const selected = items.find((item) => item.id === selectedId) ?? null
  // Opening a message in the reading pane counts as reading it.
  const select = (item: ApiInboxItem) => {
    setSelectedId(item.id)
    void markRead(item)
  }
  const activeFilters = (filter !== "all" ? 1 : 0) + (moduleFilter !== "all" ? 1 : 0) + (priorityFilter !== "all" ? 1 : 0) +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0)
  const clearFilters = () => {
    setDateFrom("")
    setDateTo("")
    setFilter("all")
    setPage(1)
    setModuleFilter("all")
    setPriorityFilter("all")
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
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

        {/* The same bold bordered filter bar as Recommendations and the assistant session log. */}
        <section
          aria-label="Filter notifications"
          className="flex flex-wrap items-end gap-3 rounded-lg border-2 border-action/40 bg-card p-4 shadow-lg [&>div]:min-w-[132px] [&>div]:flex-1 [&_[data-slot=filter-label]]:font-bold [&_[data-slot=filter-label]]:text-foreground [&_[data-slot=select-trigger]]:font-semibold"
        >
          <FilterSelect
            label="Status"
            value={filter}
            onChange={(value) => {
              setFilter(parseFilter(value))
              setPage(1)
            }}
            options={INBOX_FILTERS.map((option) => ({
              value: option.value,
              label: option.value === "unread" && unread > 0 ? `${option.label} (${unread})` : option.label,
            }))}
          />
          <FilterSelect
            label="Module"
            value={moduleFilter}
            onChange={setModuleFilter}
            options={[{ value: "all", label: "All" }, ...MODULE_OPTIONS.map((name) => ({ value: name, label: name }))]}
          />
          <FilterSelect
            label="Priority"
            value={priorityFilter}
            onChange={setPriorityFilter}
            options={[{ value: "all", label: "All" }, ...PRIORITY_OPTIONS]}
          />
          <FilterDate label="From" value={dateFrom} max={dateTo || undefined} onChange={setDateFrom} />
          <FilterDate label="To" value={dateTo} min={dateFrom || undefined} onChange={setDateTo} />
          <ClearFiltersButton activeCount={activeFilters} onClear={clearFilters} />
        </section>

        {error && (
          <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {!data && loading ? (
          <PageLoader label="Loading your notifications" className="h-64 w-full" />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Bell className="size-4" />}
            title={EMPTY_TEXT[filter].title}
            description={EMPTY_TEXT[filter].description}
          />
        ) : (
          // Two panes like a mail client: the list to scan on the left, the selected message to read on the right.
          <div
            className={cn(
              "grid min-h-[28rem] gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]",
              loading && "opacity-60"
            )}
          >
            <div className="flex max-h-[70vh] flex-col overflow-y-auto rounded-xl border bg-card">
              {groupByDate(items).map(({ group, items: groupItems }) => (
                <section key={group} aria-label={group}>
                  <h2 className="sticky top-0 z-10 border-b bg-muted px-4 py-1.5 text-[11px] font-bold tracking-[0.5px] text-muted-foreground uppercase">
                    {group}
                  </h2>
                  <ul className="divide-y">
                    {groupItems.map((item) => (
                      <NotificationRow
                        key={item.id}
                        item={item}
                        selected={item.id === selected?.id}
                        onSelect={select}
                      />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
            <NotificationDetail item={selected} recipientName={user?.name} onOpen={open} onMarkRead={markRead} />
          </div>
        )}

        {dateActive && data && (
          <p className="text-xs text-muted-foreground">
            {items.length} {items.length === 1 ? "notification" : "notifications"} in this date range
            {data.total > data.items.length ? ` (searched the latest ${data.items.length} of ${data.total})` : ""}.
          </p>
        )}

        {data && !dateActive && (
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

function FilterDate({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  value: string
  min?: string
  max?: string
  onChange: (value: string) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <span data-slot="filter-label" className="text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase">
        {label}
      </span>
      <Input
        type="date"
        aria-label={label}
        className="h-8 font-semibold"
        value={value}
        min={min}
        max={max}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div className="flex flex-col gap-1">
      <span data-slot="filter-label" className="text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase">
        {label}
      </span>
      <Select value={value} onValueChange={(v) => onChange(v ?? "all")}>
        <SelectTrigger className="h-8 w-full" aria-label={label}>
          <SelectValue placeholder="All">
            {(v: string) => options.find((option) => option.value === v)?.label ?? "All"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function NotificationRow({
  item,
  selected,
  onSelect,
}: {
  item: ApiInboxItem
  selected: boolean
  onSelect: (item: ApiInboxItem) => void
}) {
  const moduleName = moduleOf(item)
  const severity = SEVERITY_STYLE[severityOf(item.eventType)]
  const SeverityIcon = severity.icon
  return (
    <li className={selected ? "bg-action/10" : item.isRead ? "bg-card" : "bg-primary/5"}>
      <button
        type="button"
        onClick={() => onSelect(item)}
        aria-current={selected ? "true" : undefined}
        className="flex w-full items-start gap-3 px-3 py-3 text-left outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span
          role="img"
          aria-label={item.isRead ? "Read" : "Unread"}
          className={cn("mt-1.5 size-2 shrink-0 rounded-full", item.isRead ? "bg-transparent" : "bg-primary")}
        />
        <SeverityIcon aria-hidden="true" className={cn("mt-0.5 size-4 shrink-0", severity.tint)} />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className={cn("truncate text-xs text-muted-foreground", !item.isRead && "font-semibold text-foreground")}>
              {moduleName ?? notificationTypeLabel(item.eventType)}
            </span>
            <time
              dateTime={item.createdAt}
              title={formatNotificationTime(item.createdAt)}
              className="shrink-0 text-[11px] text-muted-foreground"
            >
              {formatRelativeTime(item.createdAt)}
            </time>
          </span>
          <span className={cn("mt-0.5 block truncate text-sm text-foreground", !item.isRead && "font-semibold")}>
            {item.title}
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {item.description.replace(/\s+/g, " ")}
          </span>
        </span>
      </button>
    </li>
  )
}

function NotificationDetail({
  item,
  recipientName,
  onOpen,
  onMarkRead,
}: {
  item: ApiInboxItem | null
  recipientName: string | null | undefined
  onOpen: (item: ApiInboxItem) => void
  onMarkRead: (item: ApiInboxItem) => void
}) {
  if (!item) {
    return (
      <div className="hidden items-center justify-center rounded-xl border bg-card p-6 lg:flex">
        <EmptyState
          icon={<Bell className="size-4" />}
          title="Select a notification"
          description="Pick one from the list to read it here."
        />
      </div>
    )
  }
  const moduleName = moduleOf(item)
  const opensAPage = safeActionPath(item.actionPath) !== null
  // Laid out like the email the same notification sends: subject, the text with its line
  // breaks, then one button linking to the page (backend graph_adapter.build_html).
  return (
    <article className="flex flex-col rounded-xl border bg-card">
      <header className="flex flex-col gap-3 border-b p-5">
        <h2 className="text-lg font-semibold text-foreground">{item.title}</h2>
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-action text-sm font-semibold text-white"
          >
            S
          </span>
          <div className="min-w-0 flex-1 text-xs">
            <div className="font-semibold text-foreground">Spares AI</div>
            <div className="text-muted-foreground">to {recipientName || "me"}</div>
          </div>
          <time dateTime={item.createdAt} className="shrink-0 text-xs text-muted-foreground">
            {formatNotificationTime(item.createdAt)}
          </time>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {moduleName && <Badge variant="secondary">{moduleName}</Badge>}
          <Badge variant="outline">{notificationTypeLabel(item.eventType)}</Badge>
          {item.plant && <Badge variant="outline">Plant {item.plant}</Badge>}
        </div>
      </header>

      <div className="flex flex-col gap-5 p-5">
        <p className="text-sm text-foreground">{greetingFor(recipientName)}</p>
        <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">{item.description}</p>

        {opensAPage && (
          <div>
            {/* The email's button: same blue, padding and corners. */}
            <button
              type="button"
              onClick={() => onOpen(item)}
              style={{ background: "#0b5cad", color: "#ffffff", padding: "10px 18px", borderRadius: 4 }}
              className="inline-block text-sm font-medium outline-none hover:opacity-90 focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {actionLabelOf(item.eventType)}
            </button>
          </div>
        )}

        <div className="text-sm text-foreground">
          {EMAIL_SIGN_OFF.map((line, index) => (
            <div key={line} className={index === 1 ? "font-semibold" : undefined}>
              {line}
            </div>
          ))}
        </div>
        <p className="border-t pt-3 text-[11px] text-muted-foreground">
          This is an automated message from Spares AI. Please do not reply to it.
        </p>
      </div>

      {!item.isRead && (
        <footer className="border-t px-5 py-3">
          <Button variant="outline" size="sm" onClick={() => onMarkRead(item)}>
            Mark as read
          </Button>
        </footer>
      )}
    </article>
  )
}
