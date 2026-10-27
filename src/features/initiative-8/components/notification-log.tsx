"use client"

import Link from "next/link"
import { BellRing, ListChecks } from "lucide-react"

import { StickyScrollTable } from "@/components/shared/sticky-scroll-table"
import { TablePagination } from "@/components/shared/table-pagination"
import { buttonVariants } from "@/components/ui/button"
import { TableBody, TableHeader, TableRow } from "@/components/ui/table"
import { ResultsCard, Tabs } from "@/features/initiative-8/components/kit/list"
import { Dot, I08Page } from "@/features/initiative-8/components/kit/page"
import { I08Cell as Cell, I08Head as Head } from "@/features/initiative-8/components/kit/table"
import { useUrlFilters } from "@/features/initiative-8/components/url-filters"
import { EXCEPTIONS_PATH } from "@/features/initiative-8/data/live-exceptions"
import {
  exceptionItemHref,
  NOTIFICATION_EMAIL_NOTE,
  NOTIFICATION_UNAVAILABLE,
  NOTIFICATION_VIEW,
  notificationsHref,
  type NotificationFilters,
  type NotificationsPage,
} from "@/features/initiative-8/data/live-notifications"
import { i08DateTime, plural } from "@/features/initiative-8/utils/format"
import { exceptionTypeLabel } from "@/features/initiative-8/utils/status"

const CRUMBS = [
  { label: "Repairable Spares", href: "/repairable-spares" },
  { label: "Repair Exceptions", href: EXCEPTIONS_PATH },
  { label: "Notification log" },
]

/** The queue's link to its log, in the page's actions slot. */
export function NotificationLogLink() {
  return (
    <Link href={notificationsHref({})} className={buttonVariants({ variant: "outline", size: "lg" })}>
      <BellRing className="size-4" aria-hidden="true" />
      Notification log
    </Link>
  )
}

/**
 * FR-11's notification log (27-Oct-2026): the exceptions logged for email,
 * one per exception, the first time the checks found it actionable. Paged on
 * the server, 25 a page, `?view=log&type=&page=` in the URL like the queue.
 *
 * Email is not sent yet, and the screen says so above the list. When the
 * backend has no log (a 404 from an older one) the screen says that instead
 * of showing a zero; a failed request says it failed.
 */
export function NotificationLogScreen({
  data,
  error,
  filters,
  page,
  pageSize,
}: {
  /** Undefined when the request failed; see `error`. */
  data?: NotificationsPage
  error?: string
  filters: NotificationFilters
  page: number
  pageSize: number
}) {
  const { push, isPending } = useUrlFilters(EXCEPTIONS_PATH)

  const back = (
    <Link href={EXCEPTIONS_PATH} className={buttonVariants({ variant: "outline", size: "lg" })}>
      <ListChecks className="size-4" aria-hidden="true" />
      Exception queue
    </Link>
  )

  if (data === undefined || !data.available) {
    return (
      <I08Page crumbs={CRUMBS} title="Notification log" actions={back}>
        <div
          role={data === undefined ? "alert" : "status"}
          className="mt-6 rounded-xl border border-border bg-card p-5 shadow-xs"
        >
          <p className="text-sm text-foreground">
            {data === undefined ? "The notification log could not be loaded." : NOTIFICATION_UNAVAILABLE}
          </p>
          {error && <p className="mt-1 text-[13px] text-muted-foreground">{error}</p>}
        </div>
      </I08Page>
    )
  }

  const { rows, total, types } = data
  const tabTypes = [...types, ...(filters.type && !types.includes(filters.type) ? [filters.type] : [])]

  return (
    <I08Page
      crumbs={CRUMBS}
      title="Notification log"
      actions={back}
      summary={
        <>
          <span>{plural(total, "exception")} logged</span>
          <Dot />
          <span>{NOTIFICATION_EMAIL_NOTE}</span>
        </>
      }
    >
      {tabTypes.length > 0 && (
        <Tabs
          label="Notification type"
          value={filters.type ?? ""}
          onSelect={(value) => push({ view: NOTIFICATION_VIEW, type: value || undefined })}
          choices={[
            { value: "", label: "All" },
            ...tabTypes.map((type) => ({ value: type, label: exceptionTypeLabel(type) })),
          ]}
        />
      )}
      <ResultsCard pending={isPending}>
        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
            <p className="text-[15px] font-semibold text-foreground">Nothing logged yet</p>
            <p className="max-w-md text-[13.5px] text-muted-foreground">
              An exception is logged the first time the checks find it needs action.
            </p>
          </div>
        ) : (
          <>
            <StickyScrollTable tableClassName="table-fixed min-w-[820px]">
              <colgroup>
                <col style={{ width: "15%" }} />
                <col style={{ width: "20%" }} />
                <col style={{ width: "39%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "12%" }} />
              </colgroup>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <Head>Logged</Head>
                  <Head>Type</Head>
                  <Head>Title</Head>
                  <Head>Material</Head>
                  <Head>Plant</Head>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id} data-i08-row>
                    <Cell>{i08DateTime(row.loggedAt)}</Cell>
                    <Cell wrap>{row.typeLabel}</Cell>
                    <Cell wrap>
                      <Link
                        href={exceptionItemHref(row.exceptionId)}
                        className="text-i08-link hover:underline"
                        title="Open this exception"
                      >
                        {row.title}
                      </Link>
                    </Cell>
                    <Cell>
                      <span className="font-mono text-[13.5px]">{row.material}</span>
                    </Cell>
                    <Cell>{row.plant ?? "—"}</Cell>
                  </TableRow>
                ))}
              </TableBody>
            </StickyScrollTable>
            <div className="border-t border-border px-4 py-2.5">
              <TablePagination
                page={page}
                pageSize={pageSize}
                total={total}
                count={rows.length}
                noun="notifications"
                hrefFor={(p) => notificationsHref(filters, p)}
              />
            </div>
          </>
        )}
      </ResultsCard>
    </I08Page>
  )
}
