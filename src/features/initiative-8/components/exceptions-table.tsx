"use client"

import Link from "next/link"
import { useMemo, useState } from "react"

import { ClearFiltersButton } from "@/components/shared/clear-filters-button"
import { FilterBar } from "@/components/shared/filter-bar"
import { MaterialIdentity } from "@/components/shared/material-identity"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
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
import type {
  ExceptionQueueRow,
  ExceptionQueueSummary,
} from "@/features/initiative-8/types/repair"
import { downloadCsv } from "@/lib/utils"
import { useMaterial360 } from "@/lib/material-360-context"

const ALL = "all"

type Tone = "default" | "success" | "warning" | "danger"

// Severity is a plain string on purpose (the backend may add one), so this is
// a lookup with a fallback rather than an exhaustive map.
const SEVERITY_TONE: Record<string, Tone> = {
  info: "default",
  warning: "warning",
  critical: "danger",
}

/** The shouted enum values as a reader would say them. */
const TYPE_LABEL: Record<string, string> = {
  MISSING_ATTESTATION: "No condition declaration",
  UNJUSTIFIED_ACQUISITION: "Bought new, no justification",
  MISSING_SESSION_ID: "No assistant session",
}

function labelFor(type: string): string {
  return TYPE_LABEL[type] ?? type
}

export type ExceptionsTableProps = {
  rows: ExceptionQueueRow[]
  summary: ExceptionQueueSummary
  truncated?: boolean
}

export function ExceptionsTable({
  rows,
  summary,
  truncated = false,
}: ExceptionsTableProps) {
  const { openMaterial360 } = useMaterial360()

  const [type, setType] = useState<string>(ALL)
  const [plant, setPlant] = useState<string>(ALL)
  const [openOnly, setOpenOnly] = useState(false)
  const [hidePreAutomation, setHidePreAutomation] = useState(false)

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
    return rows.filter((row) => {
      if (type !== ALL && row.type !== type) return false
      if (plant !== ALL && row.plant?.plantId !== plant) return false
      if (openOnly && !row.isOpenRepair) return false
      if (hidePreAutomation && row.preAutomation) return false
      return true
    })
  }, [rows, type, plant, openOnly, hidePreAutomation])

  function exportCsv() {
    downloadCsv(
      "i08-exception-queue.csv",
      [
        "Type",
        "Severity",
        "Material",
        "Description",
        "Plant",
        "Repair Line",
        "Acquisition Line",
        "Raised At",
        "Open Repair",
        "Pre-automation",
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
        row.detail,
      ])
    )
  }

  const activeFilters = [
    type !== ALL,
    plant !== ALL,
    openOnly,
    hidePreAutomation,
  ].filter(Boolean).length

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
        <Button size="sm" variant="outline" onClick={exportCsv}>
          Export CSV
        </Button>
      </div>

      {/* An empty count must read as "none found", never as "not built". */}
      {summary.typesRaised.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Checks running: {summary.typesRaised.map(labelFor).join(", ")}.
          Declarations matched within ±{summary.attestationWindowDays} days
          {summary.justificationWindowDays
            ? `, justifications within ±${summary.justificationWindowDays} days`
            : ""}
          . A check not listed here is not running yet, and its absence from
          this queue is not evidence of nothing to find.
        </p>
      )}

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

        <Select
          value={hidePreAutomation ? "yes" : ALL}
          onValueChange={(v) => setHidePreAutomation(v === "yes")}
        >
          <SelectTrigger className="w-[240px]">
            <SelectValue placeholder="Including pre-automation">
              {(value: string) =>
                value === "yes"
                  ? "Actionable only"
                  : "Including pre-automation"
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Including pre-automation</SelectItem>
            <SelectItem value="yes">Actionable only</SelectItem>
          </SelectContent>
        </Select>

        <ClearFiltersButton
          activeCount={activeFilters}
          onClear={() => {
            setType(ALL)
            setPlant(ALL)
            setOpenOnly(false)
            setHidePreAutomation(false)
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
                <TableHead>Severity</TableHead>
                <TableHead>Exception</TableHead>
                <TableHead>Material</TableHead>
                <TableHead>Plant</TableHead>
                <TableHead>Repair Line</TableHead>
                <TableHead>Acquisition Line</TableHead>
                <TableHead>Raised</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => (
                <TableRow key={row.id} className="align-top">
                  <TableCell className="text-xs font-medium whitespace-nowrap text-foreground">
                    {labelFor(row.type)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={SEVERITY_TONE[row.severity] ?? "default"}>
                      {row.severity}
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
    </div>
  )
}
