"use client"

import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"

import { AlertBanner } from "@/components/shared/alert-banner"
import { SAPDocumentChip } from "@/components/shared/sap-document-chip"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { REPAIR_CHAINS } from "@/features/initiative-8/data/repair-chains"
import { formatZAR } from "@/lib/utils"

const DEFAULT_MATERIAL_ID = "800-14201" // Scenario C

export function DuplicateGuardFlow() {
  const [materialId, setMaterialId] = useState(DEFAULT_MATERIAL_ID)
  const [attempted, setAttempted] = useState(false)
  const [justifying, setJustifying] = useState(false)
  const [justification, setJustification] = useState("")
  const [proceeded, setProceeded] = useState(false)

  const chain = REPAIR_CHAINS.find((c) => c.material.materialId === materialId)
  const hasActiveRepair = !!chain && chain.repairStatus !== "Closed"

  function resetAttempt() {
    setAttempted(false)
    setJustifying(false)
    setJustification("")
    setProceeded(false)
  }

  function onMaterialChange(next: string | null) {
    if (!next) return
    setMaterialId(next)
    resetAttempt()
  }

  function submitAttempt() {
    setAttempted(true)
    setJustifying(false)
    setProceeded(false)
  }

  function cancelRequest() {
    toast.info(`New-unit request for ${materialId} cancelled.`)
    resetAttempt()
  }

  function confirmJustification() {
    if (!justification.trim()) {
      toast.error("Enter a justification before proceeding.")
      return
    }
    toast.success(
      `Proceeding with new-unit request for ${materialId} — Simulated, PR still requires normal approval.`
    )
    setProceeded(true)
    setJustifying(false)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 text-sm font-medium text-foreground">New Procurement Attempt</div>
        <p className="mb-3 text-xs text-muted-foreground">
          Simulates a user requesting a new unit of a repairable material — the system checks for an
          active repair chain before the request goes further.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-muted-foreground">Material requested</label>
            <Select value={materialId} onValueChange={onMaterialChange}>
              <SelectTrigger className="h-9 w-full">
                <SelectValue placeholder="Select a material" />
              </SelectTrigger>
              <SelectContent>
                {REPAIR_CHAINS.map((c) => (
                  <SelectItem key={c.material.materialId} value={c.material.materialId}>
                    {c.material.materialId} — {c.material.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={submitAttempt}>Request new unit</Button>
        </div>
      </div>

      {attempted && chain && hasActiveRepair && (
        <AlertBanner
          tone="warning"
          title="Another unit is already under repair"
          actions={
            !proceeded ? (
              <>
                <Link
                  href={`/repairable-spares/repair-register/${chain.id}`}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Review Repair
                </Link>
                <Button variant="outline" size="sm" onClick={cancelRequest}>
                  Cancel New Request
                </Button>
                {!justifying ? (
                  <Button size="sm" onClick={() => setJustifying(true)}>
                    Proceed with Justification
                  </Button>
                ) : null}
              </>
            ) : undefined
          }
        >
          <p className="mb-2">
            This is advisory only — it never blocks the request. Review the details below before
            deciding whether to proceed.
          </p>
          <dl className="grid grid-cols-2 gap-y-1.5 sm:grid-cols-4">
            <dt className="text-muted-foreground">Vendor</dt>
            <dd className="col-span-1 sm:col-span-3">{chain.vendor}</dd>
            <dt className="text-muted-foreground">Repair PO</dt>
            <dd className="col-span-1 sm:col-span-3">
              {chain.repairPO ? <SAPDocumentChip doc={chain.repairPO} /> : "Not yet raised"}
            </dd>
            <dt className="text-muted-foreground">Quantity at vendor</dt>
            <dd className="col-span-1 sm:col-span-3">{chain.qtyUnderRepair}</dd>
            <dt className="text-muted-foreground">Expected return</dt>
            <dd className="col-span-1 sm:col-span-3">{chain.expectedReturn}</dd>
            <dt className="text-muted-foreground">Days remaining</dt>
            <dd className="col-span-1 sm:col-span-3">
              {chain.daysRemainingInRepair >= 0
                ? `${chain.daysRemainingInRepair} days`
                : `Overdue by ${Math.abs(chain.daysRemainingInRepair)} days`}
            </dd>
            <dt className="text-muted-foreground">New-unit cost vs repair cost</dt>
            <dd className="col-span-1 sm:col-span-3">
              {formatZAR(chain.newUnitCost)} vs {formatZAR(chain.repairCost)}
            </dd>
            <dt className="text-muted-foreground">New-unit lead time vs repair return</dt>
            <dd className="col-span-1 sm:col-span-3">
              {chain.newUnitLeadTimeDays} days vs{" "}
              {chain.daysRemainingInRepair >= 0
                ? `${chain.daysRemainingInRepair} days`
                : "overdue"}
            </dd>
          </dl>

          {justifying && (
            <div className="mt-3 flex flex-col gap-2 border-t border-dashed border-warning/30 pt-3">
              <label className="text-xs text-muted-foreground" htmlFor="justification">
                Justification for proceeding despite the active repair
              </label>
              <textarea
                id="justification"
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-input bg-background p-2 text-xs text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                placeholder="e.g. Repair unit is a different configuration than what's now required on site."
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={confirmJustification}>
                  Confirm & Proceed
                </Button>
                <Button variant="outline" size="sm" onClick={() => setJustifying(false)}>
                  Back
                </Button>
              </div>
            </div>
          )}

          {proceeded && (
            <p className="mt-3 border-t border-dashed border-warning/30 pt-3 text-foreground">
              Proceeding — Simulated. The new-unit PR still requires normal approval; this decision and
              its justification are recorded in the Audit Trail.
            </p>
          )}
        </AlertBanner>
      )}

      {attempted && (!chain || !hasActiveRepair) && (
        <AlertBanner tone="info" title="No active repair chain found">
          No open repair chain exists for {materialId}. The new-unit request can proceed through normal
          procurement — Simulated, not connected to SAP.
        </AlertBanner>
      )}
    </div>
  )
}
