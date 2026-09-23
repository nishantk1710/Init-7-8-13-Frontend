"use client"

import { AskAssistantLink } from "@/components/assistant/ask-assistant-link"

import { EmptyState } from "@/components/shared/empty-state"
import { StatusBadge } from "@/components/shared/status-badge"
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
import { formatCount } from "@/lib/utils"

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
                  <TableCell className="font-medium text-foreground">
                    <div className="flex flex-col gap-0.5">
                      {m.material}
                      {/* Both identifiers are real here and come from the
                          backend, so this opens a session directly rather
                          than asking for a plant the row already knows. */}
                      <AskAssistantLink materialId={m.material} plant={m.plant} />
                      <SessionChips
                        sessions={sessionsByKey?.get(`${m.material}::${m.plant}`)}
                      />
                    </div>
                  </TableCell>
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
                    {formatCount(m.consumptionCount12m)} ({formatCount(m.consumedQty12m ?? 0)} qty)
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
        </div>
      )}
    </div>
  )
}
