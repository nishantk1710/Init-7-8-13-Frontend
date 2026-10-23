"use client"


import { EmptyState } from "@/components/shared/empty-state"
import { EmptyValue } from "@/features/initiative-13/components/empty-value"
import { DataTable, FITTED_TABLE } from "@/features/initiative-13/components/ui/data-table"
import { StatusPill } from "@/features/initiative-13/components/ui/status-pill"
import { TONE_INK } from "@/features/initiative-13/components/ui/tones"
import { EMPTY_LABEL } from "@/features/initiative-13/utils/empty-labels"
import {
  coverTone,
  isLongIdle,
} from "@/features/initiative-13/utils/oar-display"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { SessionChips } from "@/features/initiative-13/components/session-chips"
import type { AcquiredVsPlanStatus, AgingBand, WatchMetric } from "@/lib/api/i13"
import type { ApiSessionSummary } from "@/lib/api/assistant"
import { cn, formatCount } from "@/lib/utils"
import { MaterialName } from "@/components/shared/material-name"
import { sapPlantLabel } from "@/lib/shared-data/sap-plants"

const AGING_LABEL: Record<AgingBand, string> = {
  FAST: "Fast-moving",
  SLOW: "Slow-moving",
  NON_MOVING: "Non-moving",
}

const AGING_TONE: Record<AgingBand, "healthy" | "caution" | "urgent"> = {
  FAST: "healthy",
  SLOW: "caution",
  NON_MOVING: "urgent",
}

/** Months of cover: the number, in its band's colour. */
function CoverCell({ months }: { months: number | null }) {
  if (months === null) {
    return (
      <span className="text-sm text-ink-muted" title={EMPTY_LABEL.noConsumptionHistory.title}>
        Insufficient consumption history
      </span>
    )
  }
  const tone = coverTone(months)
  return (
    <span className={cn("block text-right font-bold tabular-nums", TONE_INK[tone])}>{months.toFixed(1)}</span>
  )
}

const PLAN_LABEL: Record<AcquiredVsPlanStatus, string> = {
  NO_PLAN: "Non-AI",
  BELOW_PLAN: "Below plan",
  ON_PLAN: "On plan",
  ABOVE_PLAN: "Above plan",
}

const PLAN_TONE: Record<AcquiredVsPlanStatus, "neutral" | "healthy" | "caution" | "urgent"> = {
  NO_PLAN: "neutral",
  BELOW_PLAN: "caution",
  ON_PLAN: "healthy",
  ABOVE_PLAN: "urgent",
}

/**
 * The WATCH table.
 *
 * Every filter this component used to own now lives in the URL and is applied
 * by the backend (`I13UrlFilters` on the page writes them). What is left is
 * rendering — which is the whole job of a table handed its rows.
 *
 * `sessionsByKey` is the assistant join, resolved once on the server for the
 * whole screen. A per-row lookup would be one request per visible material.
 */
export function WatchTable({
  metrics,
  sessionsByKey,
}: {
  metrics: WatchMetric[]
  sessionsByKey?: Map<string, ApiSessionSummary[]>
}) {
  const filtered = metrics

  return (
    <div className="flex flex-col gap-3">
      {filtered.length === 0 ? (
        <EmptyState
          title="No consumption tracking records found."
          description="Try clearing the plant/material/aging-band filters."
        />
      ) : (
        <DataTable className={FITTED_TABLE}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead>Plant</TableHead>
                <TableHead>Stock type</TableHead>
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
                  <TableCell className="text-foreground">
                    <div className="flex flex-col gap-0.5">
                      <MaterialName material={m.material} description={m.materialDescription} />
                      <SessionChips
                        sessions={sessionsByKey?.get(`${m.material}::${m.plant}`)}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{sapPlantLabel(m.plant)}</TableCell>
                  <TableCell>
                    <StatusPill tone={AGING_TONE[m.agingBand]}>{AGING_LABEL[m.agingBand]}</StatusPill>
                  </TableCell>
                  <TableCell className="text-right text-foreground">
                    <CoverCell months={m.monthsOfCover} />
                  </TableCell>
                  <TableCell className="text-right text-foreground">
                    {m.daysSinceLastMovement !== null ? (
                      <span
                        className={cn(
                          "tabular-nums",
                          isLongIdle(m.daysSinceLastMovement) ? "font-bold text-urgent-ink" : "font-semibold"
                        )}
                      >
                        {m.daysSinceLastMovement}d
                        {isLongIdle(m.daysSinceLastMovement) && <span className="sr-only"> (idle 150 days or more)</span>}
                      </span>
                    ) : (
                      <EmptyValue kind="noMovement" />
                    )}
                  </TableCell>
                  <TableCell className="text-right text-foreground">
                    <span className="font-semibold tabular-nums">{formatCount(m.consumptionCount12m)}</span>{" "}
                    <span className="text-ink-muted">({formatCount(m.consumedQty12m ?? 0)} qty)</span>
                  </TableCell>
                  <TableCell className="text-right text-foreground">
                    {m.inventoryTurns !== null ? (
                      <span className="font-semibold tabular-nums">{m.inventoryTurns.toFixed(2)}</span>
                    ) : (
                      <EmptyValue kind="noConsumptionHistory" />
                    )}
                  </TableCell>
                  <TableCell>
                    {m.grNotIssuedFlag ? (
                      <StatusPill tone="urgent">
                        {m.grNotIssuedDaysSinceGr !== null ? `${m.grNotIssuedDaysSinceGr}d since GR` : "Flagged – GR date unknown"}
                      </StatusPill>
                    ) : (
                      <EmptyValue kind="noGrNotIssued" />
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusPill tone={PLAN_TONE[m.acquiredVsPlanStatus]}>
                      {PLAN_LABEL[m.acquiredVsPlanStatus]}
                    </StatusPill>
                    {m.acquiredVsPlanStatus !== "NO_PLAN" && (
                      <div className="mt-0.5 text-[11px] text-muted-foreground">
                        planned {formatCount(m.plannedQuantity ?? 0)} · received{" "}
                        {formatCount(m.receivedQuantity ?? 0)} · issued{" "}
                        {formatCount(m.issuedQuantity ?? 0)}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataTable>
      )}
    </div>
  )
}
