"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { Download } from "lucide-react"

import { FilterBar } from "@demo/components/shared/filter-bar"
import { MaterialIdentity } from "@demo/components/shared/material-identity"
import { SAPDocumentChip } from "@demo/components/shared/sap-document-chip"
import { StatusBadge } from "@demo/components/shared/status-badge"
import { Button } from "@demo/components/ui/button"
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
import { EXCEPTIONS } from "@demo/features/initiative-8/data/exceptions"
import {
  EXCEPTION_SEVERITY_TONE,
  exceptionTypeLabel,
} from "@demo/features/initiative-8/utils/status"
import { useMaterial360 } from "@demo/lib/material-360-context"
import { downloadCsv, formatCount } from "@demo/lib/utils"

const ALL = "all"

/**
 * The Exception Queue — every finding the Initiative 8 checks raised, one row
 * each.
 *
 * Read-only by design. Nothing here resolves or dismisses an exception: the
 * way to clear a missing attestation is to record one on the Declaration
 * Queue, and the list is recomputed from the underlying records rather than
 * ticked off.
 */
export function ExceptionQueueTable() {
  const { openMaterial360 } = useMaterial360()
  const [type, setType] = useState<string>(ALL)
  const [plant, setPlant] = useState<string>(ALL)
  const [openOnly, setOpenOnly] = useState(false)

  const typeOptions = useMemo(() => {
    const counts = new Map<string, number>()
    for (const e of EXCEPTIONS) counts.set(e.type, (counts.get(e.type) ?? 0) + 1)
    return [...counts.entries()].map(([value, count]) => ({ value, count }))
  }, [])

  const plantOptions = useMemo(() => {
    const seen = new Map<string, string>()
    for (const e of EXCEPTIONS) seen.set(e.plant.plantId, e.plant.name)
    return [...seen.entries()].map(([plantId, name]) => ({ plantId, name }))
  }, [])

  const filtered = useMemo(
    () =>
      EXCEPTIONS.filter((e) => {
        if (type !== ALL && e.type !== type) return false
        if (plant !== ALL && e.plant.plantId !== plant) return false
        if (openOnly && !e.isOpenRepair) return false
        return true
      }),
    [type, plant, openOnly]
  )

  // Quoted beside the row count, never instead of it: the total is the
  // business case and the actionable count is the work, and either one alone
  // misleads — in opposite directions.
  const actionable = filtered.filter((e) => !e.preAutomation).length

  function exportCsv() {
    // The filtered rows, all of them: the file is the view it came from.
    downloadCsv(
      "i08-exceptions.csv",
      [
        "Type",
        "Severity",
        "Exception",
        "Detail",
        "Material",
        "Plant",
        "Repair Line",
        "Acquisition Line",
        "Raised",
        "Repair State",
        "Pre-automation",
      ],
      filtered.map((e) => [
        exceptionTypeLabel(e.type),
        e.severity,
        e.title,
        e.detail,
        e.material.materialId,
        e.plant.name,
        `${e.repairLine.documentNumber}${e.repairLine.line ? `/${e.repairLine.line}` : ""}`,
        e.acquisitionLine
          ? `${e.acquisitionLine.documentNumber}${e.acquisitionLine.line ? `/${e.acquisitionLine.line}` : ""}`
          : "",
        e.raisedAt,
        e.isOpenRepair ? "Open" : "Received",
        e.preAutomation ? "Yes" : "No",
      ])
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <FilterBar>
        <Select value={type} onValueChange={(v) => setType(v ?? ALL)}>
          <SelectTrigger className="h-9 w-full sm:w-56">
            <SelectValue placeholder="Exception type">
              {(value: string) =>
                value === ALL ? "All exception types" : exceptionTypeLabel(value)
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All exception types</SelectItem>
            {typeOptions.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {exceptionTypeLabel(t.value)} ({formatCount(t.count)})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={plant} onValueChange={(v) => setPlant(v ?? ALL)}>
          <SelectTrigger className="h-9 w-full sm:w-48">
            <SelectValue placeholder="Plant">
              {(value: string) =>
                value === ALL
                  ? "All plants"
                  : (plantOptions.find((p) => p.plantId === value)?.name ?? value)
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
          value={openOnly ? "open" : ALL}
          onValueChange={(v) => setOpenOnly(v === "open")}
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
            {formatCount(filtered.length)} of {formatCount(EXCEPTIONS.length)} shown ·{" "}
            {formatCount(actionable)} actionable
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
          No exceptions match these filters.
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
              {filtered.map((e) => (
                <TableRow key={e.id} className="align-top">
                  <TableCell className="text-xs font-medium whitespace-nowrap text-foreground">
                    {exceptionTypeLabel(e.type)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={EXCEPTION_SEVERITY_TONE[e.severity]}>
                      {e.severity}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="max-w-[420px] whitespace-normal">
                    <p className="text-xs font-medium text-foreground">{e.title}</p>
                    {/* Says what is missing AND what was searched for — the
                        part that lets somebody check the finding. */}
                    <p className="mt-0.5 text-xs text-muted-foreground">{e.detail}</p>
                    {/* A reason, not a violation: the line predates the
                        control, so nobody could have recorded anything. */}
                    {e.preAutomation && (
                      <StatusBadge className="mt-1.5">
                        Raised before Spares Automation
                      </StatusBadge>
                    )}
                  </TableCell>
                  <TableCell>
                    <MaterialIdentity material={e.material} onOpen={openMaterial360} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{e.plant.name}</TableCell>
                  <TableCell>
                    <div className="flex flex-col items-start gap-1">
                      {e.repairId ? (
                        <Link
                          href={`/repairable-spares/repair-register/${e.repairId}`}
                          className="hover:underline"
                          title="Open this repair line in the register"
                        >
                          <SAPDocumentChip doc={e.repairLine} />
                        </Link>
                      ) : (
                        <SAPDocumentChip doc={e.repairLine} />
                      )}
                      <span className="text-[11px] text-muted-foreground">
                        {e.isOpenRepair ? "Repair still open" : "Repair received"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {e.acquisitionLine ? (
                      <SAPDocumentChip doc={e.acquisitionLine} />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {e.raisedAt}
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
