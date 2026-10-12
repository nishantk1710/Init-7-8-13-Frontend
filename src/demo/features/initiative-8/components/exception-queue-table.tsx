"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { Download, Search, X } from "lucide-react"

import { ClearFiltersButton } from "@demo/components/shared/clear-filters-button"
import { EmptyState } from "@demo/components/shared/empty-state"
import { FilterBar } from "@demo/components/shared/filter-bar"
import { MaterialIdentity } from "@demo/components/shared/material-identity"
import { SAPDocumentChip } from "@demo/components/shared/sap-document-chip"
import { StatusBadge } from "@demo/components/shared/status-badge"
import { Button } from "@demo/components/ui/button"
import { Input } from "@demo/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@demo/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@demo/components/ui/table"
import { I8_PLANTS, REFERENCE_DATE } from "@demo/features/initiative-8/data/config"
import { documentLabel } from "@demo/features/initiative-8/model/snapshot"
import type { RepairException } from "@demo/features/initiative-8/types/repair"
import { daysBetween } from "@demo/features/initiative-8/utils/dates"
import {
  EXCEPTION_SEVERITY_TONE,
  EXCEPTION_STATUSES,
  EXCEPTION_STATUS_LABEL,
  EXCEPTION_STATUS_TONE,
  EXCEPTION_TYPES,
  exceptionTypeLabel,
  isOpenException,
} from "@demo/features/initiative-8/utils/status"
import { useMaterial360 } from "@demo/lib/material-360-context"
import { cn, downloadCsv, formatCount } from "@demo/lib/utils"

const ALL = "all"

/** The status filter's default: everything still being worked. */
export const ACTIVE_STATUSES = "active"

const UNASSIGNED = "unassigned"

/** Days an item has been open, raised to the reference date. Undefined once resolved or closed. */
export function exceptionAgeOf(exception: RepairException): number | undefined {
  if (!isOpenException(exception)) return undefined
  return Math.max(0, daysBetween(exception.raisedAt, REFERENCE_DATE) ?? 0)
}

/** Why the item was resolved, from the latest event that resolved it. */
function resolutionOf(exception: RepairException): string {
  return [...exception.history].reverse().find((e) => e.status === "RESOLVED")?.text ?? ""
}

function lastEventOf(exception: RepairException): string {
  const event = exception.history[exception.history.length - 1]
  return event ? `${event.at} — ${event.actor}: ${event.text}` : ""
}

function statusFilterLabel(value: string): string {
  if (value === ACTIVE_STATUSES) return "Open + In progress"
  if (value === ALL) return "All statuses"
  return EXCEPTION_STATUS_LABEL[value as keyof typeof EXCEPTION_STATUS_LABEL] ?? value
}

/** What the search box looks through: ids, documents, the material and the text. */
function searchTextOf(e: RepairException): string {
  return [
    e.id,
    e.title,
    e.detail,
    e.material.materialId,
    e.material.description,
    e.repairId,
    documentLabel(e.repairLine),
    documentLabel(e.acquisitionLine),
    documentLabel(e.reservation),
    e.owner,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
}

/**
 * The Exception Queue's rows — every item the four checks raised, open or
 * not, one row each, with its owner and status (FR-11).
 *
 * Opens on what is still being worked (Open + In progress); the resolved and
 * closed items stay one filter away, because the history is the record.
 * `initialRepair` narrows it to one repair line (`?repair=` on the URL) and
 * shows that line's every item, whatever its status. A row opens the item.
 */
export function ExceptionQueueTable({
  exceptions,
  initialRepair,
  initialStatus = ACTIVE_STATUSES,
  selectedId,
  onOpen,
}: {
  exceptions: RepairException[]
  initialRepair?: string
  initialStatus?: string
  selectedId?: string
  onOpen: (id: string) => void
}) {
  const { openMaterial360 } = useMaterial360()
  const [type, setType] = useState<string>(ALL)
  const [status, setStatus] = useState<string>(initialStatus)
  const [plant, setPlant] = useState<string>(ALL)
  const [owner, setOwner] = useState<string>(ALL)
  const [search, setSearch] = useState("")
  const [repair, setRepair] = useState<string | undefined>(initialRepair)

  const typeCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const e of exceptions) counts.set(e.type, (counts.get(e.type) ?? 0) + 1)
    return counts
  }, [exceptions])

  const ownerOptions = useMemo(
    () => [...new Set(exceptions.flatMap((e) => (e.owner ? [e.owner] : [])))].sort(),
    [exceptions],
  )

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return exceptions.filter((e) => {
      if (type !== ALL && e.type !== type) return false
      if (status === ACTIVE_STATUSES ? !isOpenException(e) : status !== ALL && e.status !== status) return false
      if (plant !== ALL && e.plant.plantId !== plant) return false
      if (owner === UNASSIGNED ? e.owner !== undefined : owner !== ALL && e.owner !== owner) return false
      if (repair && e.repairId !== repair) return false
      if (needle && !searchTextOf(e).includes(needle)) return false
      return true
    })
  }, [exceptions, type, status, plant, owner, repair, search])

  const openCount = filtered.filter(isOpenException).length
  const activeFilters =
    (type !== ALL ? 1 : 0) +
    (status !== ACTIVE_STATUSES ? 1 : 0) +
    (plant !== ALL ? 1 : 0) +
    (owner !== ALL ? 1 : 0) +
    (search.trim() ? 1 : 0) +
    (repair ? 1 : 0)

  function clearFilters() {
    setType(ALL)
    setStatus(ACTIVE_STATUSES)
    setPlant(ALL)
    setOwner(ALL)
    setSearch("")
    setRepair(undefined)
  }

  function exportCsv() {
    // The filtered rows, all of them: the file is the view it came from.
    downloadCsv(
      "i08-exception-queue.csv",
      [
        "ID",
        "Type",
        "Severity",
        "Status",
        "Owner",
        "Exception",
        "Detail",
        "Material",
        "Material Description",
        "Plant",
        "Repair Line",
        "Repair Document",
        "Purchase / Reservation",
        "Raised",
        "Age (days)",
        "Raised Before Spares Automation",
        "Still Found By Check",
        "Resolved",
        "Closed",
        "Resolution",
        "Last Event",
      ],
      filtered.map((e) => [
        e.id,
        exceptionTypeLabel(e.type),
        e.severity,
        EXCEPTION_STATUS_LABEL[e.status],
        e.owner ?? "Unassigned",
        e.title,
        e.detail,
        e.material.materialId,
        e.material.description,
        e.plant.name,
        e.repairId ?? "",
        documentLabel(e.repairLine),
        documentLabel(e.acquisitionLine ?? e.reservation),
        e.raisedAt,
        exceptionAgeOf(e) ?? "",
        e.preAutomation ? "Yes" : "No",
        e.stillDetected ? "Yes" : "No",
        e.resolvedAt ?? "",
        e.closedAt ?? "",
        resolutionOf(e),
        lastEventOf(e),
      ]),
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <FilterBar>
        <Select value={type} onValueChange={(v) => setType(v ?? ALL)}>
          <SelectTrigger className="h-9 w-full sm:w-56">
            <SelectValue placeholder="Exception type">
              {(value: string) => (value === ALL ? "All exception types" : exceptionTypeLabel(value))}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All exception types</SelectItem>
            {EXCEPTION_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {exceptionTypeLabel(t)} ({formatCount(typeCounts.get(t) ?? 0)})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={status} onValueChange={(v) => setStatus(v ?? ACTIVE_STATUSES)}>
          <SelectTrigger className="h-9 w-full sm:w-48">
            <SelectValue placeholder="Status">{(value: string) => statusFilterLabel(value)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ACTIVE_STATUSES}>Open + In progress</SelectItem>
            {EXCEPTION_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {EXCEPTION_STATUS_LABEL[s]}
              </SelectItem>
            ))}
            <SelectItem value={ALL}>All statuses</SelectItem>
          </SelectContent>
        </Select>

        <Select value={plant} onValueChange={(v) => setPlant(v ?? ALL)}>
          <SelectTrigger className="h-9 w-full sm:w-52">
            <SelectValue placeholder="Plant">
              {(value: string) =>
                value === ALL ? "All plants" : (I8_PLANTS.find((p) => p.plantId === value)?.name ?? value)
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All plants</SelectItem>
            {I8_PLANTS.map((p) => (
              <SelectItem key={p.plantId} value={p.plantId}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={owner} onValueChange={(v) => setOwner(v ?? ALL)}>
          <SelectTrigger className="h-9 w-full sm:w-48">
            <SelectValue placeholder="Owner">
              {(value: string) => (value === ALL ? "Any owner" : value === UNASSIGNED ? "Unassigned" : value)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Any owner</SelectItem>
            <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
            {ownerOptions.map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search id, material, document…"
            className="h-9 pl-7 text-sm"
            aria-label="Search exceptions"
          />
        </div>

        {repair && (
          <span className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-muted/40 pr-1 pl-2.5 text-xs text-foreground">
            Repair line {repair}
            <button
              type="button"
              onClick={() => setRepair(undefined)}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={`Stop filtering to repair line ${repair}`}
            >
              <X className="size-3.5" />
            </button>
          </span>
        )}

        <ClearFiltersButton activeCount={activeFilters} onClear={clearFilters} />

        <div className="flex items-center gap-3 sm:ml-auto">
          <span className="text-xs text-muted-foreground">
            {formatCount(filtered.length)} of {formatCount(exceptions.length)} · {formatCount(openCount)} open
          </span>
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download className="size-3.5" />
            Export CSV
          </Button>
        </div>
      </FilterBar>

      {filtered.length === 0 ? (
        <EmptyState
          title="No exceptions match these filters"
          description={
            status === ACTIVE_STATUSES
              ? "Nothing is open or in progress here. Resolved and closed items are under the status filter."
              : "Try a wider filter."
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Exception</TableHead>
                <TableHead>Material</TableHead>
                <TableHead>Plant</TableHead>
                <TableHead>Repair Line</TableHead>
                <TableHead>Purchase / Reservation</TableHead>
                <TableHead>Raised</TableHead>
                <TableHead className="text-right">Age</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((e) => {
                const age = exceptionAgeOf(e)
                const purchaseOrReservation = e.acquisitionLine ?? e.reservation
                return (
                  <TableRow
                    key={e.id}
                    data-state={e.id === selectedId ? "selected" : undefined}
                    className="cursor-pointer align-top"
                    tabIndex={0}
                    onClick={() => onOpen(e.id)}
                    onKeyDown={(event) => {
                      if (event.target !== event.currentTarget) return
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        onOpen(e.id)
                      }
                    }}
                  >
                    <TableCell className="text-xs font-medium whitespace-nowrap text-foreground">
                      {exceptionTypeLabel(e.type)}
                      <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">{e.id}</span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={EXCEPTION_SEVERITY_TONE[e.severity]}>{e.severity}</StatusBadge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={EXCEPTION_STATUS_TONE[e.status]}>
                        {EXCEPTION_STATUS_LABEL[e.status]}
                      </StatusBadge>
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-xs whitespace-nowrap",
                        e.owner ? "text-foreground" : "text-muted-foreground italic",
                      )}
                    >
                      {e.owner ?? "Unassigned"}
                    </TableCell>
                    <TableCell className="max-w-[420px] whitespace-normal">
                      <p className="text-xs font-medium text-foreground">{e.title}</p>
                      {/* Says what is missing AND what was looked at — the
                          part that lets somebody check the finding. */}
                      <p className="mt-0.5 text-xs text-muted-foreground">{e.detail}</p>
                      {/* A reason, not a violation: the item predates the
                          control, so nobody could have recorded anything. */}
                      {e.preAutomation && (
                        <StatusBadge className="mt-1.5">Raised before Spares Automation</StatusBadge>
                      )}
                    </TableCell>
                    <TableCell onClick={(event) => event.stopPropagation()}>
                      <MaterialIdentity material={e.material} onOpen={openMaterial360} />
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap text-muted-foreground">{e.plant.name}</TableCell>
                    <TableCell onClick={(event) => event.stopPropagation()}>
                      {e.repairId && e.repairLine ? (
                        <Link
                          href={`/repairable-spares/repair-register/${e.repairId}`}
                          className="flex flex-col items-start gap-1 hover:underline"
                          title="Open this repair line in the register"
                        >
                          <SAPDocumentChip doc={e.repairLine} />
                          <span className="text-[11px] text-muted-foreground">{e.repairId}</span>
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {purchaseOrReservation ? (
                        <SAPDocumentChip doc={purchaseOrReservation} />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap text-muted-foreground">{e.raisedAt}</TableCell>
                    <TableCell className="text-right text-xs whitespace-nowrap tabular-nums">
                      {age === undefined ? (
                        <span className="text-muted-foreground" title="Not open">
                          —
                        </span>
                      ) : (
                        <span className="text-foreground">{formatCount(age)} d</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
