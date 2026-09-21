"use client"

import { useMemo, useState } from "react"

import { EmptyState } from "@/components/shared/empty-state"
import { FilterBar } from "@/components/shared/filter-bar"
import { StatusBadge } from "@/components/shared/status-badge"
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
import type { AcquiredVsPlanStatus, AgingBand, WatchMetric } from "@/features/initiative-13/api/types"
import { formatCount } from "@/lib/utils"

const ALL_FILTER = "all"

const AGING_LABEL: Record<AgingBand, string> = {
  FAST: "Fast-moving",
  SLOW: "Slow-moving",
  NON_MOVING: "Non-moving",
}

const AGING_TONE: Record<AgingBand, "success" | "warning" | "danger"> = {
  FAST: "success",
  SLOW: "warning",
  NON_MOVING: "danger",
}

const PLAN_LABEL: Record<AcquiredVsPlanStatus, string> = {
  NO_PLAN: "No plan",
  BELOW_PLAN: "Below plan",
  ON_PLAN: "On plan",
  ABOVE_PLAN: "Above plan",
}

const PLAN_TONE: Record<AcquiredVsPlanStatus, "default" | "success" | "warning" | "danger"> = {
  NO_PLAN: "default",
  BELOW_PLAN: "warning",
  ON_PLAN: "success",
  ABOVE_PLAN: "danger",
}

export function WatchTable({
  metrics,
  plant,
  material,
  agingBand,
  onFilterPlant,
  onFilterMaterial,
  onFilterAgingBand,
}: {
  metrics: WatchMetric[]
  plant: string
  material: string
  agingBand: string
  onFilterPlant: (value: string) => void
  onFilterMaterial: (value: string) => void
  onFilterAgingBand: (value: string) => void
}) {
  const [planFilter, setPlanFilter] = useState<string>(ALL_FILTER)

  const filtered = useMemo(
    () => metrics.filter((m) => planFilter === ALL_FILTER || m.acquiredVsPlanStatus === planFilter),
    [metrics, planFilter]
  )

  return (
    <div className="flex flex-col gap-3">
      <FilterBar>
        <Input
          placeholder="Plant (1300 or 1500)"
          value={plant}
          onChange={(e) => onFilterPlant(e.target.value)}
          className="h-9 sm:w-40"
        />
        <Input
          placeholder="Material"
          value={material}
          onChange={(e) => onFilterMaterial(e.target.value)}
          className="h-9 sm:w-40"
        />
        <Select
          value={agingBand || ALL_FILTER}
          onValueChange={(v) => {
            const value = v ?? ALL_FILTER
            onFilterAgingBand(value === ALL_FILTER ? "" : value)
          }}
        >
          <SelectTrigger className="h-9 w-full sm:w-40">
            <SelectValue placeholder="Aging band">
              {(v: string) => (v === ALL_FILTER ? "All aging bands" : AGING_LABEL[v as AgingBand] ?? v)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>All aging bands</SelectItem>
            {Object.entries(AGING_LABEL).map(([value, text]) => (
              <SelectItem key={value} value={value}>
                {text}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={planFilter} onValueChange={(v) => setPlanFilter(v ?? ALL_FILTER)}>
          <SelectTrigger className="h-9 w-full sm:w-44">
            <SelectValue placeholder="Acquired vs. plan">
              {(v: string) => (v === ALL_FILTER ? "All plan statuses" : PLAN_LABEL[v as AcquiredVsPlanStatus] ?? v)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>All plan statuses</SelectItem>
            {Object.entries(PLAN_LABEL).map(([value, text]) => (
              <SelectItem key={value} value={value}>
                {text}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterBar>

      {filtered.length === 0 ? (
        <EmptyState
          title="No WATCH records found."
          description="Try clearing the plant/material/aging-band filters."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead>Plant</TableHead>
                <TableHead>Aging band</TableHead>
                <TableHead className="text-right">Months of cover</TableHead>
                <TableHead className="text-right">Days since movement</TableHead>
                <TableHead className="text-right">Consumption (12m)</TableHead>
                <TableHead className="text-right">Inventory turns</TableHead>
                <TableHead>GR not issued (30d)</TableHead>
                <TableHead>Acquired vs. plan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((m) => (
                <TableRow key={`${m.material}-${m.plant}`}>
                  <TableCell className="font-medium text-foreground">{m.material}</TableCell>
                  <TableCell className="text-muted-foreground">{m.plant}</TableCell>
                  <TableCell>
                    <StatusBadge tone={AGING_TONE[m.agingBand]}>{AGING_LABEL[m.agingBand]}</StatusBadge>
                  </TableCell>
                  <TableCell className="text-right text-foreground">
                    {m.monthsOfCover !== null ? (
                      m.monthsOfCover.toFixed(1)
                    ) : (
                      <span className="text-muted-foreground" title={m.monthsOfCoverReason ?? undefined}>
                        Insufficient consumption history
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-foreground">
                    {m.daysSinceLastMovement !== null ? `${m.daysSinceLastMovement}d` : "—"}
                  </TableCell>
                  <TableCell className="text-right text-foreground">
                    {formatCount(m.consumptionCount12m)} ({formatCount(m.consumedQty12m)} qty)
                  </TableCell>
                  <TableCell className="text-right text-foreground">
                    {m.inventoryTurns !== null ? (
                      m.inventoryTurns.toFixed(2)
                    ) : (
                      <span className="text-muted-foreground" title={m.inventoryTurnsReason ?? undefined}>
                        Not available
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {m.grNotIssuedFlag ? (
                      <StatusBadge tone="danger">
                        {m.grNotIssuedDaysSinceGr !== null ? `${m.grNotIssuedDaysSinceGr}d since GR` : "Flagged"}
                      </StatusBadge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={PLAN_TONE[m.acquiredVsPlanStatus]}>
                      {PLAN_LABEL[m.acquiredVsPlanStatus]}
                    </StatusBadge>
                    {m.acquiredVsPlanStatus !== "NO_PLAN" && (
                      <div className="mt-0.5 text-[11px] text-muted-foreground">
                        planned {formatCount(m.plannedQuantity ?? 0)} · received {formatCount(m.receivedQuantity)} ·
                        issued {formatCount(m.issuedQuantity)}
                      </div>
                    )}
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
