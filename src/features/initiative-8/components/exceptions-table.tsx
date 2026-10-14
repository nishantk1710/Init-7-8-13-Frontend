"use client"

import Link from "next/link"
import { useMemo, useState } from "react"

import { ClearFiltersButton } from "@/components/shared/clear-filters-button"
import { FilterBar } from "@/components/shared/filter-bar"
import { MaterialIdentity } from "@/components/shared/material-identity"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
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
import { ExceptionDetailDrawer } from "@/features/initiative-8/components/exception-detail-drawer"
import type {
  ExceptionQueueRow,
  ExceptionQueueSummary,
  ExceptionStatus,
} from "@/features/initiative-8/types/repair"
import {
  EXCEPTION_STATUSES,
  EXCEPTION_STATUS_LABEL,
  EXCEPTION_STATUS_TONE,
  exceptionTypeLabel as labelFor,
} from "@/features/initiative-8/utils/status"
import { downloadExcel } from "@/lib/utils"
import { useMaterial360 } from "@/lib/material-360-context"

const ALL = "all"

/** The status filter's default. Chosen over "All statuses" for the same
 *  reason it always was: the queue runs to thousands of rows and almost all
 *  of it is historical, so starting on everything would bury the handful
 *  somebody can actually act on. "Open + In progress" used to be the default
 *  value too, as a second blended option the dropdown offered; removed on
 *  request, leaving OPEN -- the first of the four real statuses -- as the
 *  plain default instead of a fifth synthetic one. */
const DEFAULT_STATUS: ExceptionStatus = "OPEN"

/**
 * What each check actually looks for.
 *
 * Written out because a finding nobody can trace to a rule is a finding
 * nobody will act on -- and because not every check below is running, which a
 * reader has to be able to tell apart from "running and found nothing". The
 * screen only shows the rule for checks the backend says it raises; the rest
 * appear under "not running yet". Which those are is read from `typesRaised`
 * rather than written down here, so this does not go stale as checks land.
 */
const HOW_IT_WORKS: Record<string, string> = {
  MISSING_ATTESTATION:
    "A repair PO line with no condition declaration linked to it, matched on the same material and plant within the window below.",
  MISSING_SESSION_ID:
    "An 80-series reservation whose item text (SGTXT) carries no valid Spares Assistant session for that part -- blank, an ID nobody issued, or another part's session.",
  OVERDUE_REPAIR:
    "A repair PO line past its EKET delivery date plus the grace period, with units still at the vendor.",
}

/**
 * The FR-8 checks this queue carries, in the order they read.
 *
 * `UNJUSTIFIED_ACQUISITION` is deliberately not among them since
 * 14-Oct-2026: the reason for a new purchase is asked for at the reservation,
 * by the Spares Assistant (FR-5b), so it is a control rather than a queue
 * item. The rows and the type are dropped in `live-exceptions.ts`, which
 * carries the reasoning; this list is kept in step so the screen does not
 * explain a check it no longer shows.
 */
const ALL_CHECKS = [
  "MISSING_ATTESTATION",
  "OVERDUE_REPAIR",
  "MISSING_SESSION_ID",
] as const

export type ExceptionsTableProps = {
  rows: ExceptionQueueRow[]
  summary: ExceptionQueueSummary
  truncated?: boolean
  /** `?id=` — open this item's drawer on arrival. */
  initialId?: string
  /** `?repair=` — narrow the queue to one repair line, as the register links. */
  initialRepair?: string
}

export function ExceptionsTable({
  rows,
  summary,
  truncated = false,
  initialId,
  initialRepair,
}: ExceptionsTableProps) {
  const { openMaterial360 } = useMaterial360()

  const [type, setType] = useState<string>(ALL)
  const [plant, setPlant] = useState<string>(ALL)
  const [openOnly, setOpenOnly] = useState(false)
  const [status, setStatus] = useState<string>(DEFAULT_STATUS)
  const [search, setSearch] = useState("")
  const [selectedId, setSelectedId] = useState<string | undefined>(initialId)
  const [drawerOpen, setDrawerOpen] = useState(initialId !== undefined)

  const plants = useMemo(() => {
    const seen = new Map<string, string>()
    for (const row of rows) {
      if (row.plant) seen.set(row.plant.plantId, row.plant.name ?? row.plant.plantId)
    }
    return [...seen.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [rows])

  // From the rows AND from typesRaised, so a type the backend raises but this
  // page happens not to contain is still offered -- and one it does not raise
  // at all never appears as a filter that can only ever return nothing.
  const types = useMemo(() => {
    const seen = new Set<string>(summary.typesRaised)
    for (const row of rows) seen.add(row.type)
    return [...seen].sort()
  }, [rows, summary.typesRaised])

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return rows.filter((row) => {
      if (type !== ALL && row.type !== type) return false
      if (plant !== ALL && row.plant?.plantId !== plant) return false
      if (openOnly && !row.isOpenRepair) return false
      // Always on, not a toggle. Depends on attestationCutoverDate, which is
      // unset on the deployed backend -- every row reads as actionable today,
      // so this filters nothing yet. It will the day VZI supplies the date.
      if (row.preAutomation) return false
      if (status !== ALL && row.status !== status) return false
      if (initialRepair && row.repairId !== initialRepair) return false
      if (
        needle &&
        ![row.id, row.material.materialCode, row.material.description, row.repairLine]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(needle))
      ) {
        return false
      }
      return true
    })
  }, [rows, type, plant, openOnly, status, search, initialRepair])

  const selected = selectedId ? rows.find((r) => r.id === selectedId) : undefined

  function exportExcel() {
    downloadExcel(
      "i08-exception-queue.xlsx",
      [
        "Type",
        "Severity",
        "Material",
        "Description",
        "Plant",
        "Repair Line",
        "New Purchase",
        "Raised At",
        "Open Repair",
        "Pre-automation",
        "Status",
        "Owner",
        "Detail",
      ],
      filtered.map((row) => [
        row.type,
        row.severity,
        row.material.materialCode,
        row.material.description ?? "",
        row.plant?.name ?? row.plant?.plantId ?? "",
        row.repairLine,
        row.acquisitionLine ?? "",
        row.raisedAt ?? "",
        row.isOpenRepair ? "Yes" : "No",
        row.preAutomation ? "Yes" : "No",
        EXCEPTION_STATUS_LABEL[row.status],
        row.owner ?? "",
        row.detail,
      ])
    )
  }

  const activeFilters = [
    type !== ALL,
    plant !== ALL,
    openOnly,
    // The status filter starts narrowed to DEFAULT_STATUS, so being on it is
    // not "a filter the user applied" -- counting it would show "1 filter" on
    // an untouched screen.
    status !== DEFAULT_STATUS,
    search.trim() !== "",
  ].filter(Boolean).length

  function openItem(id: string) {
    setSelectedId(id)
    setDrawerOpen(true)
  }

  const coverage =
    summary.linesChecked > 0
      ? Math.round((summary.linesCovered / summary.linesChecked) * 100)
      : null

  return (
    <div className="flex flex-col gap-4">
      {/* BOTH numbers, always. `total` is the business case -- every historical
          repair line raises this because the control did not exist before the
          platform -- and `actionable` is the work. Either one alone misleads,
          and these numbers end up in status reports. */}
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground">
          <strong className="text-foreground">{summary.actionable}</strong>{" "}
          actionable of {summary.total} raised
          {summary.preAutomation > 0 && (
            <> ({summary.preAutomation} predate the control)</>
          )}
          .{" "}
          {coverage !== null && (
            <span className="text-xs">
              {summary.linesCovered} of {summary.linesChecked} repair lines
              covered ({coverage}%).
            </span>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={exportExcel}>
          Export Excel
        </Button>
      </div>

      {/* How each check works.
          An empty count must read as "none found", never as "not built" --
          so the checks that ARE running are separated from the ones that are
          not, by name, rather than both rendering as a zero. */}
      <div className="rounded-xl border border-border p-4">
        <h2 className="text-xs font-medium text-foreground">How each check works</h2>
        <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-2">
          {ALL_CHECKS.filter((t) => summary.typesRaised.includes(t)).map((type) => (
            <div key={type}>
              <dt className="text-xs font-medium text-foreground">
                {labelFor(type)}
              </dt>
              <dd className="mt-0.5 text-xs text-muted-foreground">
                {HOW_IT_WORKS[type]}
              </dd>
            </div>
          ))}
        </dl>

      </div>

      {truncated && (
        <div
          role="alert"
          className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-foreground"
        >
          Showing the first {rows.length} of {summary.total} exceptions. This is
          a partial queue — filter by plant or type to reach the rest.
        </div>
      )}

      <FilterBar>
        <Select value={type} onValueChange={(v) => setType(v ?? ALL)}>
          <SelectTrigger className="w-[260px]">
            <SelectValue placeholder="All exception types">
              {(value: string) =>
                value === ALL ? "All exception types" : labelFor(value)
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All exception types</SelectItem>
            {types.map((t) => (
              <SelectItem key={t} value={t}>
                {labelFor(t)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={plant} onValueChange={(v) => setPlant(v ?? ALL)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All plants">
              {(value: string) =>
                value === ALL
                  ? "All plants"
                  : (plants.find(([id]) => id === value)?.[1] ?? value)
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All plants</SelectItem>
            {plants.map(([id, name]) => (
              <SelectItem key={id} value={id}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={openOnly ? "yes" : ALL}
          onValueChange={(v) => setOpenOnly(v === "yes")}
        >
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="All repairs">
              {(value: string) =>
                value === "yes" ? "Open repairs only" : "All repairs"
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All repairs</SelectItem>
            <SelectItem value="yes">Open repairs only</SelectItem>
          </SelectContent>
        </Select>

        {/* FR-11: the queue is worked, so it filters by where the work is.
            No "Open + In progress" blend any more -- that was a fifth,
            synthetic option sitting beside the four real statuses. Starts on
            OPEN, the plain first status, rather than on a combined one. */}
        <Select value={status} onValueChange={(v) => setStatus(v ?? DEFAULT_STATUS)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder={EXCEPTION_STATUS_LABEL[DEFAULT_STATUS]}>
              {(value: string) =>
                value === ALL
                  ? "All statuses"
                  : EXCEPTION_STATUS_LABEL[value as ExceptionStatus] ?? value
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {EXCEPTION_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {EXCEPTION_STATUS_LABEL[s]}
              </SelectItem>
            ))}
            <SelectItem value={ALL}>All statuses</SelectItem>
          </SelectContent>
        </Select>

        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search id, material, document…"
          aria-label="Search exceptions"
          className="h-9 w-full sm:w-64"
        />

        <ClearFiltersButton
          activeCount={activeFilters}
          onClear={() => {
            setType(ALL)
            setPlant(ALL)
            setOpenOnly(false)
            setStatus(DEFAULT_STATUS)
            setSearch("")
          }}
        />
      </FilterBar>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No exceptions match these filters.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              {/* Column order mirrors the Snapshot exception queue, so the
                  two read the same way side by side. */}
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Exception</TableHead>
                <TableHead>Material</TableHead>
                <TableHead>Plant</TableHead>
                <TableHead>Repair Line</TableHead>
                <TableHead>New purchase</TableHead>
                <TableHead>Raised</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer align-top"
                  tabIndex={0}
                  aria-label={`Open ${row.id}`}
                  onClick={() => openItem(row.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      openItem(row.id)
                    }
                  }}
                >
                  <TableCell className="text-xs font-medium whitespace-nowrap text-foreground">
                    {labelFor(row.type)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={EXCEPTION_STATUS_TONE[row.status]}>
                      {EXCEPTION_STATUS_LABEL[row.status]}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="max-w-[420px] whitespace-normal">
                    <p className="text-xs font-medium text-foreground">{row.title}</p>
                    {/* Says what is missing AND what was searched for -- the
                        part that lets somebody check the finding rather than
                        take it on trust. */}
                    <p className="mt-0.5 text-xs text-muted-foreground">{row.detail}</p>
                    {/* A reason, not a violation: the line predates the
                        control, so nobody could have recorded anything. */}
                    {row.preAutomation && (
                      <StatusBadge className="mt-1.5">
                        Raised before Spares Automation
                      </StatusBadge>
                    )}
                  </TableCell>
                  <TableCell>
                    <MaterialIdentity
                      material={row.material}
                      onOpen={openMaterial360}
                    />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.plant?.name ?? row.plant?.plantId ?? "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col items-start gap-1">
                      {row.repairId ? (
                        <Link
                          href={`/repairable-spares/repair-register/${row.repairId}`}
                          className="text-foreground hover:underline"
                          title="Open this repair line in the register"
                        >
                          {row.repairLine}
                        </Link>
                      ) : (
                        <span className="text-foreground">{row.repairLine}</span>
                      )}
                      <span className="text-[11px] text-muted-foreground">
                        {row.isOpenRepair ? "Repair still open" : "Repair received"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.acquisitionLine ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {row.raisedAt ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ExceptionDetailDrawer
        exception={selected}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </div>
  )
}
