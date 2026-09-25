"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { Download } from "lucide-react"

import { FilterBar } from "@/components/shared/filter-bar"
import { MaterialIdentity } from "@/components/shared/material-identity"
import { SAPDocumentChip } from "@/components/shared/sap-document-chip"
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
import {
  EXCEPTION_CSV_HEADERS,
  exceptionPlantOptions,
  exceptionRowsToCsv,
  filterExceptions,
  type ExceptionFilters,
} from "@/features/initiative-8/data/live-exceptions"
import type { RepairException } from "@/features/initiative-8/types/repair"
import {
  EXCEPTION_SEVERITY_TONE,
  UNKNOWN,
  exceptionTypeLabel,
} from "@/features/initiative-8/utils/status"
import { useMaterial360 } from "@/lib/material-360-context"
import { downloadCsv, formatCount } from "@/lib/utils"

const ALL = "all"

export type ExceptionQueueTableProps = {
  /** Rows to render — always from the backend. An empty array is a real
   *  answer; a failure is reported through `loadError`. */
  items?: RepairException[]
  /** The type filter's options, from `meta.byType` — so a type this build has
   *  never heard of is still offered. */
  typeOptions?: { value: string; label: string; count: number }[]
  /** Set when the queue could not be loaded. Rendered as a failure, never as
   *  an empty queue. */
  loadError?: string | null
}

/**
 * The exception queue: every finding the I08 checks raised, one row each.
 *
 * Read-only. Nothing here resolves or dismisses an exception — the way to
 * clear a missing attestation is to record one on the Declaration Queue, and
 * the backend recomputes this list from its own tables on every request.
 */
export function ExceptionQueueTable({
  items = [],
  typeOptions = [],
  loadError = null,
}: ExceptionQueueTableProps = {}) {
  const { openMaterial360 } = useMaterial360()
  const [filters, setFilters] = useState<ExceptionFilters>({
    type: ALL,
    plant: ALL,
    openOnly: false,
  })

  const plantOptions = useMemo(() => exceptionPlantOptions(items), [items])
  const filtered = useMemo(() => filterExceptions(items, filters), [items, filters])
  // Quoted beside the row count, never instead of it -- see the page header.
  const filteredActionable = useMemo(
    () => filtered.filter((item) => !item.preAutomation).length,
    [filtered]
  )

  function exportCsv() {
    // The filtered rows, all of them: the file is the view it came from.
    downloadCsv("i08-exceptions.csv", EXCEPTION_CSV_HEADERS, exceptionRowsToCsv(filtered))
  }

  if (loadError) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-destructive/40 bg-destructive/5 p-8 text-center text-sm"
      >
        <p className="font-medium text-foreground">The exception queue could not be loaded.</p>
        <p className="mt-1 text-muted-foreground">{loadError}</p>
        <p className="mt-3 text-xs text-muted-foreground">
          This is not an empty queue — it is a failed request. Check that the
          backend is running and that NEXT_PUBLIC_API_BASE_URL points at it.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <FilterBar>
        <Select
          value={filters.type}
          onValueChange={(v) => setFilters((f) => ({ ...f, type: v ?? ALL }))}
        >
          <SelectTrigger className="h-9 w-full sm:w-56">
            <SelectValue placeholder="Exception type">
              {(value: string) => (value === ALL ? "All exception types" : exceptionTypeLabel(value))}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All exception types</SelectItem>
            {typeOptions.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label} ({formatCount(t.count)})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.plant}
          onValueChange={(v) => setFilters((f) => ({ ...f, plant: v ?? ALL }))}
        >
          <SelectTrigger className="h-9 w-full sm:w-48">
            <SelectValue placeholder="Plant">
              {(value: string) =>
                value === ALL
                  ? "All plants"
                  : plantOptions.find((p) => p.plantId === value)?.name ?? value
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All plants</SelectItem>
            {plantOptions.map((p) => (
              <SelectItem key={p.plantId} value={p.plantId}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.openOnly ? "open" : ALL}
          onValueChange={(v) => setFilters((f) => ({ ...f, openOnly: v === "open" }))}
        >
          <SelectTrigger className="h-9 w-full sm:w-52">
            <SelectValue placeholder="Repair state">
              {(value: string) =>
                value === "open" ? "Open repairs only" : "Open and received repairs"
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Open and received repairs</SelectItem>
            <SelectItem value="open">Open repairs only</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-3 sm:ml-auto">
          <span className="text-xs text-muted-foreground">
            {formatCount(filtered.length)} of {formatCount(items.length)} shown ·{" "}
            {formatCount(filteredActionable)} actionable
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={exportCsv}
            disabled={filtered.length === 0}
          >
            <Download className="size-3.5" />
            Export CSV
          </Button>
        </div>
      </FilterBar>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {items.length === 0
            ? "No exceptions raised. Every check the backend runs came back clean."
            : "No exceptions match these filters."}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
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
              {filtered.map((item) => (
                <TableRow key={item.id} className="align-top">
                  <TableCell className="text-xs font-medium whitespace-nowrap text-foreground">
                    {exceptionTypeLabel(item.type)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={EXCEPTION_SEVERITY_TONE[item.severity]}>
                      {item.severity}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="max-w-[420px] whitespace-normal">
                    <p className="text-xs font-medium text-foreground">{item.title}</p>
                    {/* Says what is missing AND what was searched for -- the
                        part that lets somebody check the finding. */}
                    <p className="mt-0.5 text-xs text-muted-foreground">{item.detail}</p>
                    {/* A reason, not a violation: the line predates the
                        control, so nobody could have recorded anything. */}
                    {item.preAutomation && (
                      <StatusBadge className="mt-1.5">Raised before Spares Automation</StatusBadge>
                    )}
                  </TableCell>
                  <TableCell>
                    <MaterialIdentity material={item.material} onOpen={openMaterial360} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.plant?.name ?? UNKNOWN}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col items-start gap-1">
                      {item.repairId ? (
                        <Link
                          href={`/repairable-spares/repair-register/${item.repairId}`}
                          className="hover:underline"
                          title="Open this repair line in the register"
                        >
                          <SAPDocumentChip doc={item.repairLine} />
                        </Link>
                      ) : (
                        <SAPDocumentChip doc={item.repairLine} />
                      )}
                      <span className="text-[11px] text-muted-foreground">
                        {item.isOpenRepair ? "Repair still open" : "Repair received"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {item.acquisitionLine ? (
                      <SAPDocumentChip doc={item.acquisitionLine} />
                    ) : (
                      <span className="text-xs text-muted-foreground">{UNKNOWN}</span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {item.raisedAt ?? UNKNOWN}
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
