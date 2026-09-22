"use client"

import Link from "next/link"
import { useMemo, useState } from "react"

import { EmptyState } from "@/components/shared/empty-state"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { isPlaceholderActor } from "@/lib/api/actor"
import type { ApiSessionSummary } from "@/lib/api/assistant"
import { cn } from "@/lib/utils"

/**
 * The session log.
 *
 * Every invocation of the assistant, whether it was acted on or not. That
 * completeness is the point: both FRSs count "advice given, not acted on", and
 * a log that only showed finished conversations would hide exactly the cases
 * the initiatives exist to measure.
 *
 * Filtering is client-side over an already-fetched page. The backend accepts
 * `flow` and `outcome` parameters, but refetching on every filter click would
 * make a three-way toggle into three round trips for a list that is small
 * enough to hold. If the log outgrows one page this moves server-side.
 */
export function SessionLogTable({
  sessions,
  note,
  total,
}: {
  sessions: ApiSessionSummary[]
  note: string
  total: number
}) {
  const [flow, setFlow] = useState<string>("all")
  const [outcome, setOutcome] = useState<string>("all")

  const filtered = useMemo(
    () =>
      sessions.filter(
        (session) =>
          (flow === "all" || session.flow === flow) &&
          (outcome === "all" || session.outcome === outcome)
      ),
    [sessions, flow, outcome]
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-4">
        <FilterGroup
          label="Flow"
          value={flow}
          onChange={setFlow}
          options={[
            { value: "all", label: "All" },
            { value: "i08", label: "Repairable" },
            { value: "i13", label: "Planned on demand" },
          ]}
        />
        <FilterGroup
          label="Outcome"
          value={outcome}
          onChange={setOutcome}
          options={[
            { value: "all", label: "All" },
            { value: "COMPLETED", label: "Completed" },
            { value: "OPEN", label: "Open" },
            { value: "ABANDONED", label: "Abandoned" },
          ]}
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reference</TableHead>
              <TableHead>Flow</TableHead>
              <TableHead>Material</TableHead>
              <TableHead>Plant</TableHead>
              <TableHead>Requester</TableHead>
              <TableHead>Opened from</TableHead>
              <TableHead>Turns</TableHead>
              <TableHead>Outcome</TableHead>
              <TableHead>Issued</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((session) => (
              <TableRow key={session.sessionId}>
                <TableCell>
                  <Link
                    href={`/assistant/sessions/${session.sessionId}`}
                    className="font-mono text-xs underline-offset-4 hover:underline"
                  >
                    {session.sessionId}
                  </Link>
                </TableCell>
                <TableCell className="text-xs uppercase">
                  {session.flow}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {session.materialId}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {session.plant}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-xs",
                    isPlaceholderActor(session.requester) &&
                      "text-muted-foreground"
                  )}
                >
                  {session.requester}
                </TableCell>
                <TableCell className="text-xs">
                  {session.origin === "BADI" ? "SAP" : "platform"}
                </TableCell>
                <TableCell className="text-xs">{session.turns}</TableCell>
                <TableCell className="text-xs lowercase">
                  {session.outcome}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatDate(session.issuedAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <div className="flex flex-col gap-1">
        <p className="text-[11px] text-muted-foreground">
          Showing {filtered.length} of {sessions.length} loaded
          {total > sessions.length && ` · ${total} recorded in total`}
        </p>
        {/* The backend's own note about what this list is and is not. Served
            rather than written here so it cannot go stale against it. */}
        {note && <p className="text-[11px] text-muted-foreground">{note}</p>}
      </div>
    </div>
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
    <div className="flex items-center gap-2">
      <span
        className="text-[11px] tracking-[0.3px] text-muted-foreground uppercase"
        id={`filter-${label}`}
      >
        {label}
      </span>
      <div className="flex gap-1" role="group" aria-labelledby={`filter-${label}`}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={value === option.value}
            className={cn(
              "rounded-md border px-2 py-0.5 text-xs transition-colors",
              "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              value === option.value
                ? "border-border bg-secondary text-secondary-foreground"
                : "border-transparent text-muted-foreground hover:bg-muted"
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
  return parsed.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}
