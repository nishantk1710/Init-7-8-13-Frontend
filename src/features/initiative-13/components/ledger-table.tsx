"use client"

import { Fragment, useMemo, useState } from "react"
import { ChevronRight } from "lucide-react"

import { FilterBar } from "@/components/shared/filter-bar"
import { MaterialIdentity } from "@/components/shared/material-identity"
import { RiskBadge } from "@/components/shared/risk-badge"
import { SAPDocumentChip } from "@/components/shared/sap-document-chip"
import { StatusBadge } from "@/components/shared/status-badge"
import { Timeline, type TimelineEvent } from "@/components/shared/timeline"
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
import { useMaterial360 } from "@/lib/material-360-context"
import { cn, formatCount, formatZAR } from "@/lib/utils"
import type { LedgerStage, UtilizationLedgerLine } from "@/features/initiative-13/types/oar"

const ALL_FILTER = "all"

const STAGE_TONE: Record<LedgerStage, "default" | "success" | "warning" | "danger"> = {
  Requested: "default",
  Reserved: "default",
  "PR Raised": "default",
  "PO Raised": "default",
  "Goods Receipt": "default",
  "Goods Issued": "warning",
  "Utilization Confirmed": "success",
  "Available for Redeployment": "warning",
}

function chainTone(step: UtilizationLedgerLine["documentChain"][number]): TimelineEvent["tone"] {
  return step.tone ?? "default"
}

function DocumentChainDetail({
  line,
  revealed,
}: {
  line: UtilizationLedgerLine
  revealed: boolean
}) {
  const events: TimelineEvent[] = line.documentChain.map((step) => ({
    id: step.id,
    label: step.doc ? `${step.stage}` : step.stage,
    timestamp: step.timestamp,
    description: step.doc
      ? `${step.description} — ${step.doc.type} ${step.doc.documentNumber}${step.doc.line ? `/${step.doc.line}` : ""}`
      : step.description,
    tone: chainTone(step),
  }))

  return (
    <div className="flex flex-col gap-3 p-1">
      {line.allocationMethod && (
        <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 px-3 py-2 text-[11px] text-foreground">
          <span className="font-medium">Allocation method:</span> {line.allocationMethod}. This
          reservation shares one consolidated PR/PO with other reservation lines — the receipt is
          not a 1:1 SAP link back to this line alone.
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto]">
        <Timeline events={events} revealed={revealed} />
        <dl className="flex h-fit flex-col gap-1 rounded-lg border border-border p-3 text-[11px] sm:w-56">
          {line.project && (
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Project</dt>
              <dd className="text-foreground">{line.project}</dd>
            </div>
          )}
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Job / Work order</dt>
            <dd className="text-foreground">{line.jobWorkOrder ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Equipment</dt>
            <dd className="text-foreground">{line.equipment ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Unit price</dt>
            <dd className="text-foreground">{formatZAR(line.unitPrice)}</dd>
          </div>
          {line.replanReason && (
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Re-plan reason</dt>
              <dd className="text-right text-foreground">{line.replanReason}</dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  )
}

export function UtilizationLedgerTable({ lines }: { lines: UtilizationLedgerLine[] }) {
  const { openMaterial360 } = useMaterial360()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [plant, setPlant] = useState<string>(ALL_FILTER)
  const [department, setDepartment] = useState<string>(ALL_FILTER)
  const [stage, setStage] = useState<string>(ALL_FILTER)

  const plants = useMemo(() => Array.from(new Set(lines.map((l) => l.plant.name))), [lines])
  const departments = useMemo(() => Array.from(new Set(lines.map((l) => l.department))), [lines])
  const stages = useMemo(() => Array.from(new Set(lines.map((l) => l.stage))), [lines])

  const filtered = useMemo(
    () =>
      lines.filter((l) => {
        if (plant !== ALL_FILTER && l.plant.name !== plant) return false
        if (department !== ALL_FILTER && l.department !== department) return false
        if (stage !== ALL_FILTER && l.stage !== stage) return false
        return true
      }),
    [lines, plant, department, stage]
  )

  return (
    <div className="flex flex-col gap-3">
      <FilterBar>
        <Select value={plant} onValueChange={(v) => setPlant(v ?? ALL_FILTER)}>
          <SelectTrigger className="h-9 w-full sm:w-44">
            <SelectValue placeholder="Plant">
              {(v: string) => (v === ALL_FILTER ? "All plants" : v)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>All plants</SelectItem>
            {plants.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={department} onValueChange={(v) => setDepartment(v ?? ALL_FILTER)}>
          <SelectTrigger className="h-9 w-full sm:w-44">
            <SelectValue placeholder="Department">
              {(v: string) => (v === ALL_FILTER ? "All departments" : v)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>All departments</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={stage} onValueChange={(v) => setStage(v ?? ALL_FILTER)}>
          <SelectTrigger className="h-9 w-full sm:w-48">
            <SelectValue placeholder="Stage">
              {(v: string) => (v === ALL_FILTER ? "All stages" : v)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>All stages</SelectItem>
            {stages.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterBar>

      <div className="overflow-x-auto rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Tracking ID</TableHead>
              <TableHead>Reservation</TableHead>
              <TableHead>Line</TableHead>
              <TableHead>Material</TableHead>
              <TableHead>Requester</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Plant</TableHead>
              <TableHead>Purpose</TableHead>
              <TableHead>Planned Consumption</TableHead>
              <TableHead className="text-right">Req</TableHead>
              <TableHead className="text-right">Recv</TableHead>
              <TableHead className="text-right">Issued</TableHead>
              <TableHead className="text-right">Confirmed</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Aging</TableHead>
              <TableHead>Exception</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((line) => {
              const isExpanded = expandedId === line.id
              return (
                <Fragment key={line.id}>
                  <TableRow
                    className="cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : line.id)}
                    aria-expanded={isExpanded}
                  >
                    <TableCell>
                      <ChevronRight
                        className={cn(
                          "size-4 text-muted-foreground transition-transform duration-300 ease-out",
                          isExpanded && "rotate-90"
                        )}
                      />
                    </TableCell>
                    <TableCell className="font-medium text-foreground">{line.trackingId}</TableCell>
                    <TableCell>
                      <SAPDocumentChip doc={line.reservation} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{line.reservation.line}</TableCell>
                    <TableCell>
                      <MaterialIdentity material={line.material} onOpen={openMaterial360} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{line.requester.name}</TableCell>
                    <TableCell className="text-muted-foreground">{line.department}</TableCell>
                    <TableCell className="text-muted-foreground">{line.plant.name}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-muted-foreground" title={line.purpose}>
                      {line.purpose}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{line.plannedConsumptionDate}</TableCell>
                    <TableCell className="text-right text-foreground">{formatCount(line.qtyRequested)}</TableCell>
                    <TableCell className="text-right text-foreground">{formatCount(line.qtyReceived)}</TableCell>
                    <TableCell className="text-right text-foreground">{formatCount(line.qtyIssued)}</TableCell>
                    <TableCell className="text-right text-foreground">{formatCount(line.qtyConfirmedUsed)}</TableCell>
                    <TableCell>
                      <StatusBadge tone={STAGE_TONE[line.stage]}>{line.stage}</StatusBadge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {line.agingDays > 0 ? `${line.agingDays}d` : "—"}
                    </TableCell>
                    <TableCell>
                      {line.exception === "None" ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <RiskBadge level={line.exception === "Consumption Overdue" ? "high" : "medium"}>
                          {line.exception}
                        </RiskBadge>
                      )}
                    </TableCell>
                  </TableRow>
                  <TableRow className="hover:bg-transparent">
                    <TableCell className="p-0" />
                    <TableCell colSpan={16} className="p-0">
                      {/* Grid-rows 0fr->1fr is what lets this animate to "auto"
                          height smoothly — a plain height/max-height transition
                          can't target an unknown content height without either
                          a hard snap or a fixed cap. min-h-0 on the row is the
                          matching fix for the flex/grid-shrink gotcha (same
                          issue fixed in chat-body.tsx: without it the item
                          can't shrink below its content size). */}
                      <div
                        className={cn(
                          "grid transition-[grid-template-rows] duration-300 ease-out",
                          isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                        )}
                      >
                        <div className="min-h-0 overflow-hidden">
                          <div className="bg-muted/30 px-4 py-3">
                            <DocumentChainDetail line={line} revealed={isExpanded} />
                          </div>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                </Fragment>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
