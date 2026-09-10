"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"

import { AlertBanner } from "@/components/shared/alert-banner"
import { EmptyState } from "@/components/shared/empty-state"
import { MaterialIdentity } from "@/components/shared/material-identity"
import { RiskBadge } from "@/components/shared/risk-badge"
import { SAPDocumentChip } from "@/components/shared/sap-document-chip"
import { Timeline } from "@/components/shared/timeline"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useMaterial360 } from "@/lib/material-360-context"
import { formatCount } from "@/lib/utils"
import { ESCALATION_TIMELINES } from "@/features/initiative-13/data/escalations"
import type { UtilizationLedgerLine } from "@/features/initiative-13/types/oar"

interface ResolvedState {
  status: "confirmed" | "replanned" | "redeployed"
  note: string
}

export function AgingExceptionsBoard({ lines }: { lines: UtilizationLedgerLine[] }) {
  const { openMaterial360 } = useMaterial360()
  const [resolved, setResolved] = useState<Record<string, ResolvedState>>({})
  const [replanFor, setReplanFor] = useState<string | null>(null)
  const [newDate, setNewDate] = useState("")
  const [reason, setReason] = useState("")
  const [errors, setErrors] = useState<{ date?: boolean; reason?: boolean }>({})

  const open = useMemo(() => lines.filter((l) => !resolved[l.id]), [lines, resolved])
  const activeReplanLine = lines.find((l) => l.id === replanFor)

  function confirmConsumed(line: UtilizationLedgerLine) {
    setResolved((prev) => ({
      ...prev,
      [line.id]: { status: "confirmed", note: "Consumption confirmed by requester" },
    }))
    toast.success(`Consumption confirmed — ${line.material.description} (${line.trackingId})`)
  }

  function markNoLongerRequired(line: UtilizationLedgerLine) {
    setResolved((prev) => ({
      ...prev,
      [line.id]: { status: "redeployed", note: "Marked available for redeployment" },
    }))
    toast.success(
      `${line.material.description} marked available for redeployment — see Redeployment page.`
    )
  }

  function openReplan(lineId: string) {
    setReplanFor(lineId)
    setNewDate("")
    setReason("")
    setErrors({})
  }

  function submitReplan(e: React.FormEvent) {
    e.preventDefault()
    const nextErrors = { date: !newDate, reason: !reason.trim() }
    if (nextErrors.date || nextErrors.reason) {
      setErrors(nextErrors)
      return
    }
    const line = activeReplanLine
    if (line) {
      setResolved((prev) => ({
        ...prev,
        [line.id]: { status: "replanned", note: `Re-planned to ${newDate} — ${reason.trim()}` },
      }))
      toast.success(`Re-planned — ${line.material.description} moved to ${newDate}`)
    }
    setReplanFor(null)
  }

  if (open.length === 0) {
    return (
      <EmptyState
        title="No open aging exceptions"
        description="Every overdue or no-longer-required OAR line has been actioned."
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {open.map((line) => {
        const escalation = ESCALATION_TIMELINES[line.id]
        return (
          <div key={line.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <MaterialIdentity material={line.material} onOpen={openMaterial360} />
                  <SAPDocumentChip doc={line.reservation} />
                  <RiskBadge level={line.exception === "Consumption Overdue" ? "high" : "medium"}>
                    {line.exception}
                  </RiskBadge>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {line.trackingId} · {line.plant.name} · {line.department} · Requested by{" "}
                  {line.requester.name} ({line.requester.role})
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button size="sm" onClick={() => confirmConsumed(line)}>
                  Confirm Used
                </Button>
                <Button size="sm" variant="outline" onClick={() => openReplan(line.id)}>
                  Use Later
                </Button>
                <Button size="sm" variant="outline" onClick={() => markNoLongerRequired(line)}>
                  No Longer Needed
                </Button>
              </div>
            </div>

            <AlertBanner tone="warning" title="Consumption overdue" className="mt-3">
              Planned consumption date was <strong>{line.plannedConsumptionDate}</strong> —{" "}
              {line.agingDays} days ago. {formatCount(line.qtyIssued)} {line.uom} issued,{" "}
              {formatCount(line.qtyConfirmedUsed)} confirmed used.
            </AlertBanner>

            {escalation && (
              <div className="mt-3 rounded-lg border border-border p-3">
                <h4 className="mb-2 text-[11px] font-medium uppercase tracking-[0.5px] text-muted-foreground">
                  Escalation — Requester → HOD → Inventory Control
                </h4>
                <Timeline events={escalation} />
              </div>
            )}
          </div>
        )
      })}

      <Dialog open={replanFor !== null} onOpenChange={(o) => !o && setReplanFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Re-plan consumption date</DialogTitle>
            <DialogDescription>
              {activeReplanLine
                ? `${activeReplanLine.material.description} — ${activeReplanLine.trackingId}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitReplan} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">
                New planned consumption date <span className="text-destructive">*</span>
              </label>
              <Input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                aria-invalid={errors.date}
              />
              {errors.date && (
                <span className="text-[11px] text-destructive">A new date is required.</span>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">
                Reason <span className="text-destructive">*</span>
              </label>
              <Input
                placeholder="e.g. Shutdown window moved"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                aria-invalid={errors.reason}
              />
              {errors.reason && (
                <span className="text-[11px] text-destructive">A reason is required.</span>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setReplanFor(null)}>
                Cancel
              </Button>
              <Button type="submit">Confirm re-plan</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
