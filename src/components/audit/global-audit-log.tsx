"use client"

import { Fragment, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronDown, ChevronRight, Download } from "lucide-react"
import { toast } from "sonner"

import { auditHref, type AuditFilters } from "@/components/audit/audit-params"
import { EmptyState } from "@/components/shared/empty-state"
import { CappedNotice, INITIATIVE_NAME } from "@/components/shared/load-status"
import { AlertBanner } from "@/components/shared/alert-banner"
import { Avatar } from "@/components/ui/avatar"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatWhen } from "@/lib/api/format"
import type { AuditEvent } from "@/lib/domain/contracts"
import { cn, downloadExcel } from "@/lib/utils"


interface GlobalAuditLogProps {
  /** This page of the trail, newest first. */
  events: AuditEvent[]
  /** The whole filtered population; `null` when a module could not report its size. */
  total: number | null
  page: number
  pageSize: number
  lastPage: number
  /** The population is deeper than paging can reach. */
  truncated: boolean
  filters: AuditFilters
  /** Some module could not be loaded, so an empty trail is not "nothing recorded". */
  incomplete?: boolean
}

/**
 * The audit table. Rendering and navigation only: the server has already
 * filtered, sorted and paged, so every control here writes the URL rather than
 * holding state about the answer.
 *
 * Export covers the page on screen. A full export of an append-only trail
 * measured in tens of thousands of rows is a server job, not something to
 * assemble in a browser from whatever happened to load.
 */
export function GlobalAuditLog({
  events,
  total,
  page,
  pageSize,
  lastPage,
  truncated,
  filters,
  incomplete = false,
}: GlobalAuditLogProps) {
  const router = useRouter()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Changing a filter returns to page 1 — page 4 of a different query means nothing.
  const go = (next: Partial<AuditFilters>) =>
    router.push(auditHref({ ...filters, ...next, page: 1 }))

  const firstShown = events.length === 0 ? 0 : (page - 1) * pageSize + 1
  const lastShown = (page - 1) * pageSize + events.length
  const filtered = Boolean(filters.initiative || filters.from || filters.to)

  async function handleExport() {
    const ok = await downloadExcel(
      "spares-ai-audit-trail.xlsx",
      ["Timestamp", "Initiative", "Record", "Event", "Actor", "Description"],
      events.map((e) => [
        // The ISO value, not the display string, so it lands as a sortable date.
        e.timestamp,
        INITIATIVE_NAME[e.initiative],
        e.entityId,
        e.eventType,
        e.actor ?? "System",
        e.description,
      ])
    )
    if (ok) toast.success(`Exported ${events.length} audit events on this page to Excel`)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* What is on screen against what exists, above the filter like the other pages. Nothing is claimed for an empty
          page: the empty state below says why. */}
      {events.length > 0 &&
        (total === null ? (
          <AlertBanner
            tone="info"
            title={`Showing ${events.length.toLocaleString()} events (total unavailable)`}
          />
        ) : (
          <CappedNotice shown={events.length} total={total} noun="events" description={null} />
        ))}

      {/* The same bold bordered, shadowed track as the other pages' filters, around the date range and Export. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-lg border-2 border-action/40 bg-card p-3 shadow-lg">
        <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          From
          <Input
            key={filters.from ?? "no-from"}
            type="date"
            className="h-9 w-40"
            defaultValue={filters.from ?? ""}
            max={filters.to}
            onChange={(e) => go({ from: e.target.value || undefined })}
          />
        </label>

        <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          To
          <Input
            key={filters.to ?? "no-to"}
            type="date"
            className="h-9 w-40"
            defaultValue={filters.to ?? ""}
            min={filters.from}
            onChange={(e) => go({ to: e.target.value || undefined })}
          />
        </label>

        {/* Clear filters sits just before Export, together at the right. */}
        <div className="ml-auto flex items-center gap-2">
          {filtered && (
            <Link
              href="/audit"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "h-9 border-action bg-action/10 font-semibold text-action shadow-sm hover:bg-action/20 hover:text-action"
              )}
            >
              Clear filters
            </Link>
          )}

          <Button
            variant="outline"
            size="sm"
            className="h-9 border-action bg-action/10 font-semibold text-action shadow-sm hover:bg-action/20 hover:text-action"
            onClick={handleExport}
          >
            <Download className="size-3.5" />
            Export page to Excel
          </Button>
        </div>
      </div>

      {truncated && (
        <AlertBanner tone="info" title="Only the newest events can be paged to">
          Paging reaches the newest few hundred events. Narrow the date range to see older ones.
        </AlertBanner>
      )}

      {/* Keyed on the date range so the trail fades in when it changes -- not on a page change. Dropped for reduced
          motion. */}
      <div
        key={`${filters.from ?? ""}|${filters.to ?? ""}`}
        className="animate-in fade-in slide-in-from-bottom-2 duration-300 [animation-fill-mode:backwards] motion-reduce:animate-none"
      >
      {events.length === 0 ? (
        <EmptyState
          title={
            incomplete
              ? "Nothing to show"
              : filtered
                ? "No events match these filters"
                : "No audit events recorded yet"
          }
          description={
            incomplete
              ? "A module could not be loaded, so this is not a statement that nothing was recorded."
              : filtered
                ? "Try widening the date range or choosing all initiatives."
                : "Events appear here as decisions and workflow actions are recorded."
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Timestamp</TableHead>
              <TableHead>Initiative</TableHead>
              <TableHead>Record</TableHead>
              <TableHead>Event</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Description</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((event) => {
              const isExpanded = expandedId === event.id
              const actor = event.actor ?? "System"
              return (
                <Fragment key={event.id}>
                  <TableRow
                    className="cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : event.id)}
                    aria-expanded={isExpanded}
                  >
                    <TableCell>
                      {isExpanded ? (
                        <ChevronDown className="size-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="size-4 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatWhen(event.timestamp)}
                    </TableCell>
                    <TableCell className="text-foreground">
                      {INITIATIVE_NAME[event.initiative]}
                    </TableCell>
                    <TableCell className="font-medium text-foreground">{event.entityId}</TableCell>
                    <TableCell className="text-foreground">{event.eventType}</TableCell>
                    <TableCell className="text-muted-foreground">
                      <span className="flex items-center gap-2">
                        <Avatar name={actor} size="sm" />
                        {actor}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[320px] truncate text-muted-foreground">
                      {event.description}
                    </TableCell>
                  </TableRow>
                  {isExpanded && (
                    <TableRow>
                      <TableCell />
                      <TableCell
                        colSpan={6}
                        className="bg-muted/30 py-3 text-xs whitespace-normal text-foreground"
                      >
                        {event.description}
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              )
            })}
          </TableBody>
        </Table>
      )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {events.length === 0
            ? ""
            : total === null
              ? `Showing ${firstShown}–${lastShown} (total unavailable)`
              : `Showing ${firstShown.toLocaleString()}–${lastShown.toLocaleString()} of ${total.toLocaleString()} events`}
        </p>
        <div className="flex gap-2">
          {page > 1 ? (
            <Link
              href={auditHref({ ...filters, page: page - 1 })}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Previous
            </Link>
          ) : (
            <span aria-disabled="true" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "opacity-50")}>
              Previous
            </span>
          )}
          {page < lastPage ? (
            <Link
              href={auditHref({ ...filters, page: page + 1 })}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Next
            </Link>
          ) : (
            <span aria-disabled="true" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "opacity-50")}>
              Next
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
