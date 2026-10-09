"use client"

import Link from "next/link"
import { useState } from "react"

import { AlertBanner } from "@demo/components/shared/alert-banner"
import { EmptyState } from "@demo/components/shared/empty-state"
import { MaterialIdentity } from "@demo/components/shared/material-identity"
import { PageHeader } from "@demo/components/shared/page-header"
import { SAPDocumentChip } from "@demo/components/shared/sap-document-chip"
import { StatusBadge } from "@demo/components/shared/status-badge"
import { Timeline, type TimelineEvent } from "@demo/components/shared/timeline"
import {
  DeclareConditionButton,
  type DeclarationUpdate,
} from "@demo/features/initiative-8/components/declare-condition-button"
import { getRegisterChainById } from "@demo/features/initiative-8/data/register"
import type { RepairChain } from "@demo/features/initiative-8/types/repair"
import {
  DECLARATION_STATUS_TONE,
  JUSTIFICATION_CELL_LABEL,
  JUSTIFICATION_CELL_NOTE,
  JUSTIFICATION_CELL_TONE,
  REPAIR_STATUS_TONE,
  UNKNOWN,
  formatDaysRemaining,
  isPartiallyReceived,
  isRepairOverdue,
  justificationCellOf,
} from "@demo/features/initiative-8/utils/status"
import { useMaterial360 } from "@demo/lib/material-360-context"
import { formatZAR } from "@demo/lib/utils"

function buildRepairTimeline(chain: RepairChain): TimelineEvent[] {
  const events: TimelineEvent[] = [
    {
      id: "pr",
      label: "Repair PR raised",
      timestamp: chain.raisedAt,
      description: `${chain.repairPR.documentNumber} raised for ${chain.qtyUnderRepair || "the"} unit(s).`,
      tone: "default",
    },
  ]

  if (chain.poIssuedAt && chain.repairPO) {
    events.push({
      id: "po",
      label: "Repair PO issued",
      timestamp: chain.poIssuedAt,
      description: `${chain.repairPO.documentNumber} issued to ${chain.vendor}.`,
      tone: "default",
    })
  } else {
    events.push({
      id: "po-pending",
      label: "Repair PO not yet issued",
      timestamp: "Pending",
      description: "Awaiting buyer action to convert the repair PR into a PO.",
      tone: "warning",
    })
  }

  if (chain.sentToVendorAt) {
    events.push({
      id: "vendor",
      label: `Sent to vendor — ${chain.vendor}`,
      timestamp: chain.sentToVendorAt,
      description: "Unit dispatched for repair. Awaiting SAP goods-issue confirmation.",
      tone: "default",
    })
  }

  if (chain.repairStatus === "Closed" || chain.receiptStatus === "Received") {
    events.push({
      id: "return",
      label: "Expected return",
      timestamp: chain.expectedReturn,
      tone: "default",
    })
    events.push({
      id: "receipt",
      label: "Unit received",
      timestamp: chain.receivedAt ?? "—",
      description: "Repaired unit receipted back into stores (goods receipt).",
      tone: "success",
    })
  } else {
    events.push({
      id: "return",
      label: "Expected return",
      timestamp: chain.expectedReturn,
      description:
        chain.daysRemainingInRepair < 0
          ? `Overdue by ${Math.abs(chain.daysRemainingInRepair)} day(s) — Awaiting SAP update.`
          : `${chain.daysRemainingInRepair} day(s) remaining — Awaiting SAP update.`,
      tone: chain.daysRemainingInRepair < 0 ? "danger" : "warning",
    })
  }

  return events
}

export function RepairDetailPage({ repairId }: { repairId: string }) {
  const { openMaterial360 } = useMaterial360()
  // A declaration made on this page, held here: the Snapshot never calls the
  // backend, so it lasts until the page is left -- as the old queue's did.
  const [declared, setDeclared] = useState<DeclarationUpdate | null>(null)
  const found = getRegisterChainById(repairId)
  const chain = found && declared ? { ...found, ...declared } : found

  if (!chain) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <div className="mx-auto flex max-w-5xl flex-col gap-4">
          <PageHeader title="Repair not found" />
          <EmptyState
            title={`No repair chain "${repairId}"`}
            description="This repair record does not exist in the repair register."
          />
        </div>
      </div>
    )
  }

  const isOverdue = isRepairOverdue(chain)

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <PageHeader
          title={`Repair ${chain.id}`}
          description="Repair PR, PO, dispatch and receipt for this unit."
          actions={
            <div className="flex items-center gap-2">
              <StatusBadge tone={REPAIR_STATUS_TONE[chain.repairStatus]}>
                {chain.repairStatus}
              </StatusBadge>
              <StatusBadge tone={DECLARATION_STATUS_TONE[chain.declarationStatus]}>
                Declaration: {chain.declarationStatus}
              </StatusBadge>
            </div>
          }
        />

        <div className="rounded-xl border border-border bg-card p-4">
          <MaterialIdentity material={chain.material} onOpen={openMaterial360} className="max-w-none" />
          <div className="mt-3 text-xs text-muted-foreground">{chain.plant.name}</div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <div className="text-xs text-muted-foreground">Stock on hand</div>
              <div className="text-lg font-semibold text-foreground">{chain.stockOnHand}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Reorder point</div>
              <div className="text-lg font-semibold text-foreground">{chain.reorderPoint}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Under repair</div>
              <div className="text-lg font-semibold text-foreground">{chain.qtyUnderRepair}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Expected availability</div>
              <div className="text-lg font-semibold text-foreground">{chain.expectedReturn}</div>
            </div>
          </div>
        </div>

        {isOverdue && (
          <AlertBanner tone="warning" title="Repair overdue">
            Expected return was {chain.expectedReturn} — {formatDaysRemaining(chain)}.
            Follow up with {chain.vendor}.
          </AlertBanner>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-1 text-sm font-medium text-foreground">Repair chain</div>
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <SAPDocumentChip doc={chain.repairPR} />
              {chain.repairPO && <SAPDocumentChip doc={chain.repairPO} />}
              {isPartiallyReceived(chain) && (
                <StatusBadge tone="warning">Partially received</StatusBadge>
              )}
            </div>
            <Timeline events={buildRepairTimeline(chain)} />
          </div>

          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-3 text-sm font-medium text-foreground">Vendor, cost & timing</div>
              <dl className="grid grid-cols-2 gap-y-2 text-xs">
                <dt className="text-muted-foreground">Vendor</dt>
                <dd className="text-right text-foreground">{chain.vendor}</dd>
                <dt className="text-muted-foreground">Days open</dt>
                <dd className="text-right text-foreground">{chain.daysOpen}</dd>
                <dt className="text-muted-foreground">Repair cost</dt>
                <dd className="text-right text-foreground">{formatZAR(chain.repairCost)}</dd>
                <dt className="text-muted-foreground">New-unit lead time</dt>
                <dd className="text-right text-foreground">{chain.newUnitLeadTimeDays} days</dd>
                <dt className="text-muted-foreground">Repair return time</dt>
                <dd className="text-right text-foreground">{formatDaysRemaining(chain)}</dd>
              </dl>
            </div>

            {/* Computed from the attestation table against a material +
                plant + date-window match (W5.3). Since 08-Oct-2026 this panel
                is also where the condition is declared: the Declaration Queue
                was the register's own lines with other columns, so it was
                folded into the register and its form moved here, beside the
                evidence. */}
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="text-sm font-medium text-foreground">Condition declaration</div>
                {chain.declarationStatus !== "Completed" && (
                  <DeclareConditionButton chain={chain} onDeclared={setDeclared} />
                )}
              </div>
              <StatusBadge tone={DECLARATION_STATUS_TONE[chain.declarationStatus]}>
                {chain.declarationStatus}
              </StatusBadge>
              {chain.declaredBy && (
                <dl className="mt-3 grid grid-cols-2 gap-y-2 text-xs">
                  <dt className="text-muted-foreground">Declared by</dt>
                  <dd className="text-right text-foreground">{chain.declaredBy}</dd>
                  <dt className="text-muted-foreground">Declared on</dt>
                  <dd className="text-right text-foreground">{chain.declaredAt ?? UNKNOWN}</dd>
                  <dt className="text-muted-foreground">Condition</dt>
                  <dd className="text-right text-foreground">{chain.condition ?? UNKNOWN}</dd>
                </dl>
              )}
              <dl className="mt-2 grid grid-cols-2 gap-y-2 text-xs">
                <dt className="text-muted-foreground">Requester</dt>
                <dd className="text-right text-foreground">{chain.requester ?? UNKNOWN}</dd>
              </dl>
              {/* The line's own next action when there is one, open or closed,
                  flagged or not -- and the fixed note per status when not. */}
              <p className="mt-3 text-xs text-muted-foreground">
                {chain.declarationNextAction ??
                  (chain.declarationStatus === "Completed"
                    ? "A recorded condition assessment covers this repair line and found the part repairable."
                    : chain.declarationStatus === "Flagged"
                      ? "A recorded condition assessment covers this repair line but did not find the part repairable — it was sent for repair anyway. Confirm the decision with the attestor."
                      : "No recorded condition assessment covers this repair line. Until this platform there was nowhere to record one, so nearly every historical line reads Required — that is the finding, not a fault.")}
              </p>
            </div>

            <JustificationPanel chain={chain} />
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * FR-7 on this line: the reasons recorded for buying new while it was out, and
 * the purchases made with none. What the Justifications screen showed for this
 * part, before that screen was folded into the register (08-Oct-2026).
 */
function JustificationPanel({ chain }: { chain: RepairChain }) {
  const cell = justificationCellOf(chain)
  const entries = chain.justification?.entries ?? []
  const purchases = chain.justification?.unjustifiedPurchases ?? []

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 text-sm font-medium text-foreground">Justification</div>
      {cell !== "NONE" && (
        <StatusBadge tone={JUSTIFICATION_CELL_TONE[cell]}>{JUSTIFICATION_CELL_LABEL[cell]}</StatusBadge>
      )}
      <p className={cell === "NONE" ? "text-xs text-muted-foreground" : "mt-2 text-xs text-muted-foreground"}>
        {JUSTIFICATION_CELL_NOTE[cell]}
      </p>

      {purchases.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {purchases.map((purchase) => (
            <li key={purchase.exceptionId} className="flex flex-wrap items-center gap-2 text-xs">
              <SAPDocumentChip doc={purchase.purchase} />
              <span className="text-muted-foreground">
                bought {purchase.raisedAt ?? "on an unknown date"}
                {purchase.preAutomation ? ", before the control existed" : ", no reason recorded"}
              </span>
            </li>
          ))}
          <li className="text-xs">
            <Link href="/repairable-spares/exceptions" className="text-primary hover:underline">
              See it on the Exception Queue
            </Link>
          </li>
        </ul>
      )}

      {entries.length > 0 && (
        <ul className="mt-3 flex flex-col gap-3">
          {entries.map((entry, index) => (
            <li key={entry.id ?? index} className="rounded-lg border border-border p-3">
              <p className="text-xs font-medium text-foreground">
                {entry.reasonCategory ? entry.reasonCategory.replace(/_/g, " ") : "Reason recorded"}
              </p>
              {/* The part a person actually reads. A category on its own
                  records that a box was ticked. */}
              {entry.freeText && (
                <p className="mt-0.5 text-xs text-muted-foreground">{entry.freeText}</p>
              )}
              <p className="mt-1 text-[11px] text-muted-foreground">
                Recorded by{" "}
                {entry.author ?? UNKNOWN}
                {entry.recordedAt && ` · ${entry.recordedAt}`}
                {/* Text, not a link: the Snapshot has no assistant screens. */}
                {entry.sessionId && ` · session ${entry.sessionId}`}
              </p>
            </li>
          ))}
        </ul>
      )}

      {/* Why some reasons are not here: one recorded while a unit was on the
          shelf, with nothing out for repair, has no line to sit on. */}
      <p className="mt-3 text-[11px] text-muted-foreground">
        Reasons recorded while a unit was on the shelf, with nothing out for repair, are in the{" "}
        <Link href="/repairable-spares#justifications" className="text-primary hover:underline">
          justification log on the Overview
        </Link>
        .
      </p>
    </div>
  )
}
