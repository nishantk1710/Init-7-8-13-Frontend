"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"

import { EmptyState } from "@/components/shared/empty-state"
import { FilterBar } from "@/components/shared/filter-bar"
import { RiskBadge } from "@/components/shared/risk-badge"
import { SAPDocumentChip } from "@/components/shared/sap-document-chip"
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
import type { I13Exception, I13ExceptionStatus, I13ExceptionType } from "@/features/initiative-13/api/types"

const ALL_FILTER = "all"

const TYPE_LABEL: Record<I13ExceptionType, string> = {
  PLAN_BREACH: "Plan Breach",
  NO_PLAN: "No Plan",
  GR_NOT_ISSUED_30_DAY: "GR Not Issued (30d)",
}

const TYPE_RISK: Record<I13ExceptionType, "medium" | "high"> = {
  PLAN_BREACH: "high",
  NO_PLAN: "medium",
  GR_NOT_ISSUED_30_DAY: "high",
}

const STATUS_TONE: Record<I13ExceptionStatus, "default" | "warning" | "success"> = {
  OPEN: "default",
  ACKNOWLEDGED: "warning",
  RESOLVED: "success",
}

/** Next simulated status a click on this exception's action button moves it
 * to. Purely local UI state — the backend's `/exceptions` endpoint is
 * read-only, so this never claims a write happened (same simulated-SAP
 * pattern documented in the module README, just re-pointed at the real
 * `ExceptionStatus` enum instead of the old ledger-exception concept). */
const NEXT_STATUS: Record<I13ExceptionStatus, I13ExceptionStatus | null> = {
  OPEN: "ACKNOWLEDGED",
  ACKNOWLEDGED: "RESOLVED",
  RESOLVED: null,
}

const ACTION_LABEL: Record<I13ExceptionStatus, string> = {
  OPEN: "Acknowledge",
  ACKNOWLEDGED: "Mark Resolved",
  RESOLVED: "Resolved",
}

export function AgingExceptionsBoard({
  exceptions,
  plant,
  material,
  exceptionType,
  status,
  onFilterPlant,
  onFilterMaterial,
  onFilterType,
  onFilterStatus,
}: {
  exceptions: I13Exception[]
  plant: string
  material: string
  exceptionType: string
  status: string
  onFilterPlant: (value: string) => void
  onFilterMaterial: (value: string) => void
  onFilterType: (value: string) => void
  onFilterStatus: (value: string) => void
}) {
  // Local-only simulated status transitions, keyed by exception id — never
  // sent to the backend (no write endpoint exists).
  const [localStatus, setLocalStatus] = useState<Record<string, I13ExceptionStatus>>({})

  const displayed = useMemo(
    () => exceptions.map((e) => ({ ...e, status: localStatus[e.id] ?? e.status })),
    [exceptions, localStatus]
  )

  function advance(exception: I13Exception & { status: I13ExceptionStatus }) {
    const next = NEXT_STATUS[exception.status]
    if (!next) return
    setLocalStatus((prev) => ({ ...prev, [exception.id]: next }))
    toast.success(
      `${exception.material} @ ${exception.plant} — marked ${next === "ACKNOWLEDGED" ? "acknowledged" : "resolved"} (UI-only, not sent to SAP)`
    )
  }

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
          value={exceptionType || ALL_FILTER}
          onValueChange={(v) => {
            const value = v ?? ALL_FILTER
            onFilterType(value === ALL_FILTER ? "" : value)
          }}
        >
          <SelectTrigger className="h-9 w-full sm:w-52">
            <SelectValue placeholder="Exception type">
              {(v: string) => (v === ALL_FILTER ? "All exception types" : TYPE_LABEL[v as I13ExceptionType] ?? v)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>All exception types</SelectItem>
            {Object.entries(TYPE_LABEL).map(([value, text]) => (
              <SelectItem key={value} value={value}>
                {text}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={status || ALL_FILTER}
          onValueChange={(v) => {
            const value = v ?? ALL_FILTER
            onFilterStatus(value === ALL_FILTER ? "" : value)
          }}
        >
          <SelectTrigger className="h-9 w-full sm:w-40">
            <SelectValue placeholder="Status">
              {(v: string) => (v === ALL_FILTER ? "All statuses" : v)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>All statuses</SelectItem>
            {Object.keys(STATUS_TONE).map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterBar>

      {displayed.length === 0 ? (
        <EmptyState
          title="No exceptions for the selected filters."
          description="Every open OAR exception has been actioned, or none match the current filters."
        />
      ) : (
        displayed.map((exception) => (
          <div key={exception.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-foreground">{exception.material}</span>
                  <span className="text-xs text-muted-foreground">@ {exception.plant}</span>
                  {exception.reservationNumber && (
                    <SAPDocumentChip doc={{ type: "RESERVATION", documentNumber: exception.reservationNumber }} />
                  )}
                  {exception.prNumber && <SAPDocumentChip doc={{ type: "PR", documentNumber: exception.prNumber }} />}
                  {exception.poNumber && <SAPDocumentChip doc={{ type: "PO", documentNumber: exception.poNumber }} />}
                  <RiskBadge level={TYPE_RISK[exception.type]}>{TYPE_LABEL[exception.type]}</RiskBadge>
                  <StatusBadge tone={STATUS_TONE[exception.status]}>{exception.status}</StatusBadge>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {exception.reason}
                  {exception.daysOverdue !== null && ` — ${exception.daysOverdue} days overdue`}
                  {exception.ownerName ? ` · Owner: ${exception.ownerName}` : exception.ownerId ? ` · Owner: ${exception.ownerId}` : ""}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">Evidence: {exception.evidence}</p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={exception.status === "RESOLVED" ? "outline" : "default"}
                  disabled={exception.status === "RESOLVED"}
                  onClick={() => advance(exception)}
                >
                  {ACTION_LABEL[exception.status]}
                </Button>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
