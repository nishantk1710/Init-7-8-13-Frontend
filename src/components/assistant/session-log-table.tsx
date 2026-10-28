"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { Download } from "lucide-react"

import { CompliancePanel, type ComplianceCheck } from "@/components/assistant/compliance-panel"
import { OutcomeChip } from "@/components/assistant/session-chips"
import { Chip } from "@/components/assistant/request/request-parts"
import { ClearFiltersButton } from "@/components/shared/clear-filters-button"
import { EmptyState } from "@/components/shared/empty-state"
import { MaterialName } from "@/components/shared/material-name"
import { StatCard } from "@/components/shared/stat-card"
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
import { flowLabel } from "@/lib/assistant/flow-labels"
import { departmentText } from "@/lib/assistant/request/record"
import {
  declaredCell,
  declaredExportCell,
  i08SessionSummary,
  SESSION_OUTCOME_LABEL,
  sessionOutcome,
  type SessionOutcome,
} from "@/lib/assistant/session-outcome"
import {
  linkedReservationsHref,
  matchesReservationFilter,
  reservationExportCell,
  reservationSearchTerms,
  sessionReservationState,
} from "@/lib/assistant/session-reservations"
import { formatClock, formatDay, formatInstant } from "@/lib/assistant/trace-format"
import { sapPlantLabel, sapPlantName } from "@/lib/shared-data/sap-plants"
import { cn, downloadExcel } from "@/lib/utils"

/** The row's left edge, one colour per outcome (the chip says it in words). */
const OUTCOME_EDGE: Record<SessionOutcome, string> = {
  followed: "shadow-[inset_4px_0_0_var(--success)]",
  "went-ahead": "shadow-[inset_4px_0_0_var(--warning)]",
  "not-acted": "shadow-[inset_4px_0_0_var(--destructive)]",
  open: "shadow-[inset_4px_0_0_var(--line)]",
}

/** Short flow names, the request page's: a column of "Repairable Spares" wastes width. */
const FLOW_SHORT: Record<string, string> = { i08: "Repairable", i13: "OAR" }

/**
 * The session log.
 *
 * Every invocation of the assistant, whether it was acted on or not. That
 * completeness is the point: both FRSs count "advice given, not acted on", and
 * a log that only showed finished conversations would hide exactly the cases
 * the initiatives exist to measure.
 *
 * Filtering is client-side over an already-fetched page, and for the outcome it
 * has to be: the outcome is derived per row from that session's turns and
 * justifications rather than stored, so the backend cannot filter on it.
 *
 * With Flow set to Repairable Spares the summary cards become the repairable
 * ones (followed, new unit with a reason, faulty unit declared, linked in
 * SAP); each is also a filter.
 */
export function SessionLogTable({
  sessions,
  total,
  wentAheadIds = [],
  checks = [],
}: {
  sessions: ApiSessionSummary[]
  total: number
  /** Sessions with a "went ahead anyway" justification (`wentAheadSessionIds`). */
  wentAheadIds?: string[]
  /** The cards shown for every flow, or for OAR. */
  checks?: ComplianceCheck[]
}) {
  const [flow, setFlow] = useState<string>("all")
  const [result, setResult] = useState<string>("all")
  const [reservation, setReservation] = useState<string>("all")
  const [declaredOnly, setDeclaredOnly] = useState(false)
  const [search, setSearch] = useState("")
  const wentAhead = useMemo(() => new Set(wentAheadIds), [wentAheadIds])

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return sessions.filter((session) => {
      if (flow !== "all" && session.flow !== flow) return false
      if (result !== "all" && sessionOutcome(session, wentAhead) !== result) return false
      if (!matchesReservationFilter(session, reservation)) return false
      if (declaredOnly && declaredCell(session).kind !== "yes") return false
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
  }, [sessions, flow, result, wentAhead, reservation, declaredOnly, search])

  // 25 to a page on screen; the filters, search and export still cover every
  // loaded session.
  const { paged, page, pageSize, total: filteredTotal, setPage } = usePaginatedRows(filtered, {
    resetKey: [flow, result, reservation, declaredOnly, search].join("|"),
  })

  const activeFilters =
    (flow !== "all" ? 1 : 0) +
    (result !== "all" ? 1 : 0) +
    (reservation !== "all" ? 1 : 0) +
    (declaredOnly ? 1 : 0) +
    (search.trim() ? 1 : 0)

  function clearFilters() {
    setFlow("all")
    setResult("all")
    setReservation("all")
    setDeclaredOnly(false)
    setSearch("")
  }

  function exportExcel() {
    // Exports what is on screen, not the whole log. A file that silently
    // contains more rows than the view it came from is a different document
    // from the one somebody thinks they are sending on.
    downloadExcel(
      "assistant-sessions.xlsx",
      [
        "Issued",
        "Reference",
        "Flow",
        "Material",
        "Material description",
        "Plant",
        "Requester",
        "Department",
        "Department note",
        "Opened from",
        "Outcome",
        "Faulty unit declared",
        "Linked in SAP",
      ],
      filtered.map((session) => [
        formatInstant(session.issuedAt),
        session.reference ?? session.sessionId,
        flowLabel(session.flow),
        session.materialId,
        session.materialDescription ?? "",
        sapPlantLabel(session.plant),
        // The person the part was for, not whoever operated the assistant.
        // Blank rather than a placeholder: an exported cell is read without the
        // column's caveats beside it.
        session.requestedFor ?? "",
        session.department ? departmentText(session.department, session.departmentName) : "",
        session.departmentNote ?? "",
        session.origin === "BADI" ? "SAP" : "Platform",
        SESSION_OUTCOME_LABEL[sessionOutcome(session, wentAhead)],
        declaredExportCell(session),
        reservationExportCell(session),
      ])
    )
  }

  const showI08Cards = flow === "i08"

  return (
    <div className="flex flex-col gap-4">
      {showI08Cards ? (
        <I08Cards
          sessions={sessions}
          wentAhead={wentAhead}
          result={result}
          reservation={reservation}
          declaredOnly={declaredOnly}
          onResult={(value) => setResult((current) => (current === value ? "all" : value))}
          onReservation={(value) => setReservation((current) => (current === value ? "all" : value))}
          onDeclared={() => setDeclaredOnly((v) => !v)}
        />
      ) : (
        checks.length > 0 && <CompliancePanel checks={checks} />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search reference, material, requester…"
          aria-label="Search sessions"
          className="h-11 w-full bg-card sm:w-80"
        />
        <div className="flex flex-wrap items-center gap-2">
          <ClearFiltersButton activeCount={activeFilters} onClear={clearFilters} />
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
      </div>

      {/* One row at 1440 px: short labels on compact pills. */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <FilterGroup
          label="Flow"
          value={flow}
          onChange={setFlow}
          options={[
            { value: "all", label: "All" },
            { value: "i08", label: "Repairable" },
            { value: "i13", label: "OAR" },
          ]}
        />
        <FilterGroup
          label="Outcome"
          value={result}
          onChange={setResult}
          options={[
            { value: "all", label: "All" },
            { value: "followed", label: "Followed" },
            { value: "went-ahead", label: "Went ahead" },
            { value: "not-acted", label: "Not acted on" },
            { value: "open", label: "Still open" },
          ]}
        />
        <FilterGroup
          label="Linked in SAP"
          value={reservation}
          onChange={setReservation}
          options={[
            { value: "all", label: "All" },
            { value: "linked", label: "Linked" },
            { value: "not-linked", label: "Not linked" },
          ]}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={sessions.length === 0 ? "No sessions recorded yet." : "No sessions match these filters."}
          description={
            sessions.length === 0
              ? "A session is recorded the moment somebody opens the assistant for a material, whether or not they answer anything."
              : undefined
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card [&_[data-slot=table-cell]]:py-3 [&_[data-slot=table-head]]:h-11 [&_[data-slot=table-head]]:text-xs [&_[data-slot=table-head]]:font-semibold [&_[data-slot=table-head]]:text-muted-foreground">
          <Table>
            <caption className="sr-only">
              Assistant sessions{flow === "all" ? "" : `, ${flowLabel(flow)} only`}
              {result === "all" ? "" : `, ${SESSION_OUTCOME_LABEL[result as SessionOutcome].toLowerCase()} only`}
              {reservation === "all" ? "" : `, ${reservation === "linked" ? "linked" : "not linked"} only`}
              {declaredOnly ? ", faulty unit declared only" : ""}
              {search.trim() ? `, matching "${search.trim()}"` : ""}
            </caption>
            <TableHeader>
              <TableRow>
                <TableHead>Issued</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Flow</TableHead>
                <TableHead>Material</TableHead>
                <TableHead>Plant</TableHead>
                <TableHead>Requester · Department</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead>Declared</TableHead>
                <TableHead>Linked in SAP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((session) => {
                const outcome = sessionOutcome(session, wentAhead)
                return (
                  <TableRow key={session.sessionId}>
                    <TableCell className={cn("whitespace-nowrap", OUTCOME_EDGE[outcome])}>
                      <span className="block text-xs font-medium text-foreground">{formatDay(session.issuedAt)}</span>
                      <span className="block text-[11px] text-muted-foreground">{formatClock(session.issuedAt)}</span>
                    </TableCell>
                    <TableCell>
                      {/* What the requester types into SAP: R…/n for a line of a
                          request (one value), the session ID otherwise. */}
                      <Link
                        href={`/assistant/sessions/${session.sessionId}`}
                        className="font-mono text-sm font-semibold tracking-wider whitespace-nowrap text-action underline-offset-4 hover:underline"
                      >
                        {session.reference ?? session.sessionId}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Chip tone={session.flow === "i13" ? "muted" : "warn"}>
                        {FLOW_SHORT[session.flow] ?? flowLabel(session.flow)}
                      </Chip>
                    </TableCell>
                    <TableCell className="text-xs">
                      <MaterialName
                        material={session.materialId}
                        description={session.materialDescription}
                        className="max-w-[176px]"
                      />
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      {/* Name over code: "Black Mountain (1300)" on one line is the widest cell. */}
                      <span className="block font-medium text-foreground">{sapPlantName(session.plant)}</span>
                      {sapPlantName(session.plant) !== session.plant && (
                        <span className="block text-[11px] text-muted-foreground">{session.plant}</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[200px] text-xs">
                      <RequesterCell session={session} />
                    </TableCell>
                    <TableCell>
                      <OutcomeChip outcome={outcome} />
                    </TableCell>
                    <TableCell className="text-xs">
                      <DeclaredCellView session={session} />
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

      <p className="text-xs text-muted-foreground">
        The outcome is read from what was answered in each session, and a session left without an answer counts as not
        acted on.
        {total > sessions.length && ` Showing the latest ${sessions.length} of ${total} sessions.`}
      </p>
    </div>
  )
}

/** The repairable cards: what the sessions decided, and what SAP has linked. Each card filters the table. */
function I08Cards({
  sessions,
  wentAhead,
  result,
  reservation,
  declaredOnly,
  onResult,
  onReservation,
  onDeclared,
}: {
  sessions: ApiSessionSummary[]
  wentAhead: ReadonlySet<string>
  result: string
  reservation: string
  declaredOnly: boolean
  onResult: (value: string) => void
  onReservation: (value: string) => void
  onDeclared: () => void
}) {
  const s = i08SessionSummary(sessions, wentAhead)
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        tone="healthy"
        value={s.followed}
        label="Followed the advice"
        hint="Used the existing unit, or no unit existed to use."
        onClick={() => onResult("followed")}
        pressed={result === "followed"}
      />
      <StatCard
        tone="caution"
        value={s.wentAhead}
        label="New unit, reason recorded"
        hint="A unit existed; the reason is on the session."
        onClick={() => onResult("went-ahead")}
        pressed={result === "went-ahead"}
      />
      {s.declared === null ? (
        <StatCard tone="action" value="—" label="Faulty unit declared" hint="Not sent by this backend yet." />
      ) : (
        <StatCard
          tone="action"
          value={s.declared}
          label="Faulty unit declared"
          hint="Declared in the same visit."
          onClick={onDeclared}
          pressed={declaredOnly}
        />
      )}
      {s.linked === null ? (
        <StatCard tone="action" value="—" label="Linked in SAP" hint="Not sent by this backend yet." />
      ) : (
        <StatCard
          tone="action"
          value={s.linked}
          label="Linked in SAP"
          hint={`${s.notLinked} not linked yet. Click to show only those.`}
          onClick={() => onReservation("not-linked")}
          pressed={reservation === "not-linked"}
        />
      )}
    </div>
  )
}

/** Who the part was for, and their department under it. */
function RequesterCell({ session }: { session: ApiSessionSummary }) {
  const department = session.department ? departmentText(session.department, session.departmentName) : null
  // Typed before the department became a code (15 Oct 2026).
  const legacy = session.department !== null && !/^\d{5}$/.test(session.department)
  return (
    <span className="flex min-w-0 flex-col">
      <span className={cn("font-medium", session.requestedFor ? "text-foreground" : "text-muted-foreground")}>
        {session.requestedFor ?? "Not stated"}
      </span>
      <span
        className="truncate text-[11px] text-muted-foreground"
        title={[department, session.departmentNote].filter(Boolean).join(" · ") || undefined}
      >
        {department ?? "Department not stated"}
        {legacy && " (typed before codes)"}
      </span>
    </span>
  )
}

function DeclaredCellView({ session }: { session: ApiSessionSummary }) {
  const cell = declaredCell(session)
  switch (cell.kind) {
    case "yes":
      return <Chip tone="ready">{cell.text}</Chip>
    case "no":
      return <span className="text-muted-foreground">No</span>
    case "unknown":
      return (
        <span className="text-muted-foreground" title="Not available from this backend">
          —
        </span>
      )
    case "na":
      return (
        <span className="text-muted-foreground" title="Only a repairable part is declared">
          <span aria-hidden>—</span>
          <span className="sr-only">Not applicable</span>
        </span>
      )
  }
}

/** At most this many references per cell; the rest as "+n". */
const MAX_REFS_SHOWN = 2

/**
 * The reservation(s) whose text names this session. OAR links to the
 * Utilization Ledger's reservations for this session; Repairable to the
 * session page, since the ledger lists OAR materials only. "Not linked" is
 * "not read yet", not "never".
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
        title="No SAP reservation carrying this reference has reached the platform yet."
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
        title={`${session.flow === "i13" ? "Open in the Utilization Ledger" : "Open the session"}: ${state.refs.join(", ")}`}
      >
        {shown.join(", ")}
      </Link>
      {more > 0 && <span className="text-muted-foreground">+{more}</span>}
      {state.fromUat && (
        <Chip tone="muted" title="Linked through the UAT test panel, not read from SAP">
          UAT
        </Chip>
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
  const id = `filter-${label.replaceAll(" ", "-")}`
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-semibold whitespace-nowrap text-muted-foreground" id={id}>
        {label}
      </span>
      <div className="flex gap-1" role="group" aria-labelledby={id}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={value === option.value}
            className={cn(
              "min-h-9 rounded-full border px-3 text-[13px] font-semibold whitespace-nowrap transition-colors",
              "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              value === option.value
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-card text-muted-foreground hover:border-muted-foreground hover:text-foreground"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}
