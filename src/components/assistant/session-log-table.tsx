"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { Download } from "lucide-react"

import { ClearFiltersButton } from "@/components/shared/clear-filters-button"
import { EmptyState } from "@/components/shared/empty-state"
import { TablePagination } from "@/components/shared/table-pagination"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { usePaginatedRows } from "@/hooks/use-paginated-rows"
import type { ApiSessionSummary } from "@/lib/api/assistant"
import { cn, downloadExcel } from "@/lib/utils"
import { FLOW_LABEL, flowLabel } from "@/lib/assistant/flow-labels"
import {
  linkedReservationsHref,
  matchesReservationFilter,
  reservationExportCell,
  reservationSearchTerms,
  sessionReservationState,
} from "@/lib/assistant/session-reservations"
import { MaterialName } from "@/components/shared/material-name"
import { sapPlantLabel } from "@/lib/shared-data/sap-plants"
import { departmentText } from "@/lib/assistant/request/record"
import {
  SESSION_OUTCOME_LABEL,
  sessionOutcome,
  type SessionOutcome,
} from "@/lib/assistant/session-outcome"

/** Outcome pill and the row's left edge, one colour each. */
const OUTCOME_PILL: Record<SessionOutcome, string> = {
  followed: "bg-success/10 text-success",
  "went-ahead": "bg-warning/15 text-warning",
  "not-acted": "bg-destructive/10 text-destructive",
  open: "bg-muted text-muted-foreground",
}

const OUTCOME_EDGE: Record<SessionOutcome, string> = {
  followed: "shadow-[inset_4px_0_0_var(--success)]",
  "went-ahead": "shadow-[inset_4px_0_0_var(--warning)]",
  "not-acted": "shadow-[inset_4px_0_0_var(--destructive)]",
  open: "shadow-[inset_4px_0_0_var(--line)]",
}

const STATUS_LABEL: Record<string, string> = {
  COMPLETED: "Completed",
  OPEN: "Open",
  ABANDONED: "Abandoned",
}

/**
 * The session log.
 *
 * Every invocation of the assistant, whether it was acted on or not. That
 * completeness is the point: both FRSs count "advice given, not acted on", and
 * a log that only showed finished conversations would hide exactly the cases
 * the initiatives exist to measure.
 *
 * Filtering is client-side over an already-fetched page, and for `outcome` it
 * has to be: outcome is derived per row from that session's turns rather than
 * stored, so the backend cannot filter on it in SQL and the route does not
 * offer the parameter. `flow` it does offer, but refetching on every toggle
 * would spend a round trip on a list already in hand. If the log outgrows one
 * page, `flow` moves server-side and `outcome` stays here.
 *
 * The search box works the same way: it matches the rows already loaded, so it
 * finds a session only if it is in that page.
 */
export function SessionLogTable({
  sessions,
  note,
  total,
  wentAheadIds = [],
}: {
  sessions: ApiSessionSummary[]
  note: string
  total: number
  /** Sessions with a "went ahead anyway" justification (`wentAheadSessionIds`). */
  wentAheadIds?: string[]
}) {
  const [flow, setFlow] = useState<string>("all")
  const [outcome, setOutcome] = useState<string>("all")
  const [result, setResult] = useState<string>("all")
  const wentAhead = useMemo(() => new Set(wentAheadIds), [wentAheadIds])
  const [reservation, setReservation] = useState<string>("all")
  const [search, setSearch] = useState("")

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return sessions.filter((session) => {
      if (flow !== "all" && session.flow !== flow) return false
      if (outcome !== "all" && session.outcome !== outcome) return false
      if (result !== "all" && sessionOutcome(session, wentAhead) !== result) return false
      if (!matchesReservationFilter(session, reservation)) return false
      if (
        needle &&
        // The plant label as well as the code, so "Black Mountain" finds 1300.
        ![
          session.sessionId,
          session.reference,
          session.requestId,
          session.materialId,
          session.materialDescription,
          session.plant,
          sapPlantLabel(session.plant),
          session.requestedFor,
          session.department,
          session.departmentName,
          session.departmentNote,
          ...reservationSearchTerms(session),
        ]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(needle))
      ) {
        return false
      }
      return true
    })
  }, [sessions, flow, outcome, result, wentAhead, reservation, search])

  // 25 to a page on screen; the filters, search and export still cover every
  // loaded session.
  const { paged, page, pageSize, total: filteredTotal, setPage } = usePaginatedRows(filtered, {
    resetKey: [flow, outcome, result, reservation, search].join("|"),
  })

  const activeFilters =
    (flow !== "all" ? 1 : 0) +
    (outcome !== "all" ? 1 : 0) +
    (result !== "all" ? 1 : 0) +
    (reservation !== "all" ? 1 : 0) +
    (search.trim() ? 1 : 0)

  function exportExcel() {
    // Exports what is on screen, not the whole log. A file that silently
    // contains more rows than the view it came from is a different document
    // from the one somebody thinks they are sending on.
    downloadExcel(
      "assistant-sessions.xlsx",
      [
        "Reference",
        "Request",
        "Flow",
        "Material",
        "Plant",
        "Requester",
        "Department",
        "Department note",
        "Opened from",
        "Turns",
        "AI session status",
        "Outcome",
        "Issued",
        "Expires",
        "Reservation",
      ],
      filtered.map((session) => [
        session.reference ?? session.sessionId,
        session.requestId ?? "",
        flowLabel(session.flow),
        session.materialId,
        session.plant,
        // The person the part was for, not whoever operated the assistant.
        // Blank rather than a placeholder: an exported cell is read without the
        // column's caveats beside it.
        session.requestedFor ?? "",
        session.department ? departmentText(session.department, session.departmentName) : "",
        session.departmentNote ?? "",
        session.origin,
        session.turns,
        session.outcome,
        SESSION_OUTCOME_LABEL[sessionOutcome(session, wentAhead)],
        session.issuedAt,
        session.expiresAt,
        reservationExportCell(session),
      ])
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search reference, request, material, requester…"
          aria-label="Search sessions"
          className="h-11 w-full bg-card sm:w-80"
        />
        <Button
          variant="outline"
          size="lg"
          className="min-h-11 px-4 font-semibold"
          onClick={exportExcel}
          disabled={filtered.length === 0}
        >
          <Download className="size-4" aria-hidden />
          Export Excel
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <FilterGroup
          label="Flow"
          value={flow}
          onChange={setFlow}
          options={[
            { value: "all", label: "All" },
            { value: "i08", label: FLOW_LABEL.i08 },
            { value: "i13", label: FLOW_LABEL.i13 },
          ]}
        />
        <FilterGroup
          label="AI session status"
          value={outcome}
          onChange={setOutcome}
          options={[
            { value: "all", label: "All" },
            { value: "COMPLETED", label: "Completed" },
            { value: "OPEN", label: "Open" },
            { value: "ABANDONED", label: "Abandoned" },
          ]}
        />
        <FilterGroup
          label="Outcome"
          value={result}
          onChange={setResult}
          options={[
            { value: "all", label: "All" },
            { value: "followed", label: SESSION_OUTCOME_LABEL.followed },
            { value: "went-ahead", label: SESSION_OUTCOME_LABEL["went-ahead"] },
            { value: "not-acted", label: SESSION_OUTCOME_LABEL["not-acted"] },
            { value: "open", label: SESSION_OUTCOME_LABEL.open },
          ]}
        />
        <FilterGroup
          label="Reservation"
          value={reservation}
          onChange={setReservation}
          options={[
            { value: "all", label: "All" },
            { value: "linked", label: "Linked" },
            { value: "not-linked", label: "Not linked" },
          ]}
        />

        <ClearFiltersButton
          activeCount={activeFilters}
          onClear={() => {
            setFlow("all")
            setOutcome("all")
            setResult("all")
            setReservation("all")
            setSearch("")
          }}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={
            sessions.length === 0
              ? "No sessions recorded yet."
              : "No sessions match these filters."
          }
          description={
            sessions.length === 0
              ? "A session is recorded the moment somebody opens the assistant for a material, whether or not they answer anything."
              : undefined
          }
        />
      ) : (
        <div className="overflow-hidden rounded-card border border-line bg-card [&_[data-slot=table-cell]]:py-3 [&_[data-slot=table-head]]:h-11 [&_[data-slot=table-head]]:text-xs [&_[data-slot=table-head]]:font-semibold [&_[data-slot=table-head]]:text-muted-foreground">
          <Table>
            <caption className="sr-only">
              Assistant sessions{flow === "all" ? "" : `, ${flowLabel(flow)} only`}
              {outcome === "all" ? "" : `, ${outcome.toLowerCase()} only`}
              {result === "all" ? "" : `, ${SESSION_OUTCOME_LABEL[result as SessionOutcome].toLowerCase()} only`}
              {reservation === "all" ? "" : `, ${reservation === "linked" ? "linked" : "not linked"} only`}
              {search.trim() ? `, matching "${search.trim()}"` : ""}
            </caption>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Request</TableHead>
                <TableHead>Flow</TableHead>
                <TableHead>Material</TableHead>
                <TableHead>Plant</TableHead>
                <TableHead>Requester</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Opened from</TableHead>
                <TableHead>Turns</TableHead>
                <TableHead>AI session status</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead>Reservation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((session) => {
                const result = sessionOutcome(session, wentAhead)
                return (
                <TableRow key={session.sessionId}>
                  <TableCell className={OUTCOME_EDGE[result]}>
                    {/* What the requester typed into SAP: R…/n for a line of a
                        multi-material request, the session ID otherwise. */}
                    <Link
                      href={`/assistant/sessions/${session.sessionId}`}
                      className="font-mono text-sm font-bold tracking-wider text-action underline-offset-4 hover:underline"
                    >
                      {session.reference ?? session.sessionId}
                    </Link>
                  </TableCell>
                  <TableCell className="text-xs">
                    {session.requestId ? (
                      <Link
                        href={`/assistant/requests/${session.requestId}`}
                        className="font-mono text-action underline-offset-4 hover:underline"
                        title="Open the multi-material request this line belongs to"
                      >
                        {session.requestId}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold",
                        session.flow === "i13" ? "bg-action/10 text-action" : "bg-warning/15 text-warning"
                      )}
                    >
                      {flowLabel(session.flow)}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs">
                    <MaterialName material={session.materialId} description={session.materialDescription} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs">
                    {sapPlantLabel(session.plant)}
                  </TableCell>
                  {/* Who the part was for. This column used to show
                      `session.requester` -- who operated the assistant -- which
                      with one coordinator running the site is the same value on
                      every row, and a column that never varies is a column that
                      tells a reader nothing. The operator is still recorded and
                      still served on the trace; it is simply not worth a column
                      here. */}
                  <TableCell
                    className={cn(
                      "text-xs",
                      !session.requestedFor && "text-muted-foreground"
                    )}
                  >
                    {session.requestedFor ?? "not stated"}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-xs",
                      !session.department && "text-muted-foreground"
                    )}
                  >
                    {session.department ? departmentText(session.department, session.departmentName) : "not stated"}
                    {session.departmentNote && (
                      <span className="block text-[11px] text-muted-foreground">{session.departmentNote}</span>
                    )}
                    {/* Typed before the department became a code (15 Oct 2026). */}
                    {session.department && !/^\d{5}$/.test(session.department) && (
                      <span className="ml-1 text-[10px] text-muted-foreground">legacy</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    {session.origin === "BADI" ? "SAP" : "platform"}
                  </TableCell>
                  <TableCell className="text-xs tabular-nums">{session.turns}</TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold",
                        session.outcome === "COMPLETED" && "bg-success/10 text-success",
                        session.outcome === "OPEN" && "bg-action/10 text-action",
                        // Abandoned is an outcome, not a failure: neutral.
                        session.outcome === "ABANDONED" && "bg-muted text-muted-foreground"
                      )}
                    >
                      <span aria-hidden className="size-1.5 rounded-full bg-current" />
                      {STATUS_LABEL[session.outcome] ?? session.outcome}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold",
                        OUTCOME_PILL[result]
                      )}
                    >
                      <span aria-hidden className="size-1.5 rounded-full bg-current" />
                      {SESSION_OUTCOME_LABEL[result]}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(session.issuedAt)}
                  </TableCell>
                  <TableCell className="text-xs">
                    <ReservationCell session={session} />
                  </TableCell>
                </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <TablePagination
        page={page}
        pageSize={pageSize}
        total={filteredTotal}
        count={paged.length}
        noun="sessions"
        onPageChange={setPage}
      />

      <div className="flex flex-col gap-1">
        <p className="text-xs text-muted-foreground">
          <span className="font-bold text-foreground">{filtered.length}</span> of {sessions.length} loaded sessions match
          {total > sessions.length && ` · ${total} recorded in total`}
        </p>
        {/* The backend's own note about what this list is and is not. Served
            rather than written here so it cannot go stale against it. */}
        {note && <p className="text-[11px] text-muted-foreground">{note}</p>}
      </div>
    </div>
  )
}

/** At most this many references per cell; the rest as "+n". */
const MAX_REFS_SHOWN = 2

/**
 * The reservation(s) whose SGTXT names this session. OAR links to the
 * Utilization Ledger's reservations for this session; Repairable to the
 * session trace, since the ledger lists OAR materials only. "Not linked" is "not read yet", not "never": the link appears once the
 * item text reaches the platform.
 */
function ReservationCell({ session }: { session: ApiSessionSummary }) {
  const state = sessionReservationState(session)
  if (state.kind === "unknown") {
    return (
      <span className="text-muted-foreground" title="Not available from this backend">
        —
      </span>
    )
  }
  if (state.kind === "not-linked") {
    return (
      <span
        className="whitespace-nowrap text-muted-foreground"
        title="No reservation's item text (SGTXT) names this session yet. It is read from the RESB extract (next night's rebuild), or at once through the UAT “Link SAP reservation” panel."
      >
        Not linked
      </span>
    )
  }
  const shown = state.refs.slice(0, MAX_REFS_SHOWN)
  const more = state.refs.length - shown.length
  return (
    <span className="flex flex-wrap items-center gap-1">
      <Link
        href={linkedReservationsHref(session)}
        className="font-mono whitespace-nowrap text-action underline-offset-4 hover:underline"
        title={`${session.flow === "i13" ? "Open in the Utilization Ledger" : "Open the session trace"}: ${state.refs.join(", ")}`}
      >
        {shown.join(", ")}
      </Link>
      {more > 0 && <span className="text-muted-foreground">+{more}</span>}
      {state.fromUat && (
        <span
          className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground"
          title="Linked through the UAT “Link SAP reservation” panel, not read from SAP's item text"
        >
          UAT
        </span>
      )}
    </span>
  )
}

function FilterGroup({
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
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold text-muted-foreground" id={`filter-${label.replaceAll(" ", "-")}`}>
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby={`filter-${label.replaceAll(" ", "-")}`}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={value === option.value}
            className={cn(
              "min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors",
              "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              value === option.value
                ? "border-foreground bg-foreground text-background"
                : "border-line bg-card text-muted-foreground hover:border-muted-foreground hover:text-foreground"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function formatDate(iso: string): string {
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return iso
  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}
