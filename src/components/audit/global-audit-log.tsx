"use client"

import { Fragment, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronDown, ChevronRight, Download } from "lucide-react"
import { toast } from "sonner"

import { auditHref, type AuditFilters } from "@/components/audit/audit-params"
import { EmptyState } from "@/components/shared/empty-state"
import { INITIATIVE_NAME } from "@/components/shared/load-status"
import { AlertBanner } from "@/components/shared/alert-banner"
import { Avatar } from "@/components/ui/avatar"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatWhen } from "@/lib/api/format"
import type { AuditEvent, InitiativeId } from "@/lib/domain/contracts"
import { cn, downloadCsv } from "@/lib/utils"

const ALL_FILTER = "all"
const INITIATIVES: InitiativeId[] = ["initiative-7", "initiative-8", "initiative-13"]

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

  function handleExport() {
    downloadCsv(
      "spares-ai-audit-trail.csv",
      ["Timestamp", "Initiative", "Record", "Event", "Actor", "Description"],
      events.map((e) => [
        // The ISO value, not the display string: a CSV bound for Excel should sort.
        e.timestamp,
        INITIATIVE_NAME[e.initiative],
        e.entityId,
        e.eventType,
        e.actor ?? "System",
        e.description,
      ])
    )
    toast.success(`Exported ${events.length} audit events on this page to CSV`)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Initiative
          <Select
            value={filters.initiative ?? ALL_FILTER}
            onValueChange={(v) =>
              go({ initiative: v === ALL_FILTER ? undefined : (v as InitiativeId) })
            }
          >
            <SelectTrigger className="h-9 w-full sm:w-56">
              <SelectValue placeholder="Initiative">
                {(value: string) =>
                  value === ALL_FILTER ? "All initiatives" : INITIATIVE_NAME[value as InitiativeId]
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_FILTER}>All initiatives</SelectItem>
              {INITIATIVES.map((id) => (
                <SelectItem key={id} value={id}>
                  {INITIATIVE_NAME[id]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
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

        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
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

        {filtered && (
          <Link
            href="/audit"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-9")}
          >
            Clear filters
          </Link>
        )}

        <Button variant="outline" size="sm" className="ml-auto h-9" onClick={handleExport}>
          <Download className="size-3.5" />
          Export page to CSV
        </Button>
      </div>

      {truncated && (
        <AlertBanner tone="info" title="Only the newest events can be paged to">
          Paging reaches the newest few hundred events. Narrow the date range to see older ones.
        </AlertBanner>
      )}

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
