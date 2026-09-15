"use client"

import { AlertBanner } from "@/components/shared/alert-banner"
import { EmptyState } from "@/components/shared/empty-state"
import { MaterialIdentity } from "@/components/shared/material-identity"
import { PageHeader } from "@/components/shared/page-header"
import { SAPDocumentChip } from "@/components/shared/sap-document-chip"
import { StatusBadge } from "@/components/shared/status-badge"
import { Timeline, type TimelineEvent } from "@/components/shared/timeline"
import { DECLARATIONS } from "@/features/initiative-8/data/declarations"
import { getRepairChainById } from "@/features/initiative-8/data/repair-chains"
import type { RepairChain } from "@/features/initiative-8/types/repair"
import {
  DECLARATION_STATUS_TONE,
  RECEIPT_STATUS_TONE,
  REPAIR_STATUS_TONE,
  UNKNOWN,
  formatDaysRemaining,
  hasNoDueDate,
  isRepairOverdue,
  orUnknown,
  vendorLabel,
} from "@/features/initiative-8/utils/status"
import { useMaterial360 } from "@/lib/material-360-context"
import { formatZAR } from "@/lib/utils"

function buildRepairTimeline(chain: RepairChain): TimelineEvent[] {
  const events: TimelineEvent[] = [
    {
      id: "pr",
      label: "Repair PR raised",
      timestamp: chain.raisedAt,
      description: `${chain.repairPR.documentNumber} raised for ${chain.qtyUnderRepair || "the"} unit(s) — Simulated, not yet reflected in SAP.`,
      tone: "default",
    },
  ]

  if (chain.poIssuedAt && chain.repairPO) {
    events.push({
      id: "po",
      label: "Repair PO issued",
      timestamp: chain.poIssuedAt,
      description: `${chain.repairPO.documentNumber} issued to ${chain.vendor} — Simulated SAP PO.`,
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
      timestamp: chain.expectedReturn ?? UNKNOWN,
      tone: "default",
    })
    events.push({
      id: "receipt",
      label: "Unit received",
      timestamp: chain.receivedAt ?? "—",
      description: "Repaired unit receipted back into stores — Simulated SAP GR.",
      tone: "success",
    })
  } else {
    // A line with no agreed return date is its own state, not a quiet
    // "on time" -- it is the one nobody is chasing. 63 of the 1,225 repair
    // lines in the July extract are in it.
    events.push({
      id: "return",
      label: hasNoDueDate(chain) ? "No return date agreed" : "Expected return",
      timestamp: chain.expectedReturn ?? UNKNOWN,
      description: hasNoDueDate(chain)
        ? "No schedule line exists for this PO item, so no return was ever promised. Chase the buyer for a date."
        : `${formatDaysRemaining(chain)} — Awaiting SAP update.`,
      tone: isRepairOverdue(chain) ? "danger" : "warning",
    })
  }

  return events
}

export function RepairDetailPage({ repairId }: { repairId: string }) {
  const { openMaterial360 } = useMaterial360()
  const chain = getRepairChainById(repairId)

  if (!chain) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <div className="mx-auto flex max-w-5xl flex-col gap-4">
          <PageHeader title="Repair not found" />
          <EmptyState
            title={`No repair chain "${repairId}"`}
            description="This repair record does not exist in the mock repair register."
          />
        </div>
      </div>
    )
  }

  const declaration = DECLARATIONS.find((d) => d.relatedRepairId === chain.id)
  const isOverdue = isRepairOverdue(chain)

  const declarationTimeline: TimelineEvent[] = declaration
    ? [
        {
          id: "d-created",
          label: `Procurement PR raised — ${declaration.source}`,
          timestamp: declaration.createdAt,
          description: `${declaration.pr.documentNumber} · Requested by ${declaration.requester}`,
          tone: "default",
        },
        declaration.status === "Completed"
          ? {
              id: "d-declared",
              label: `Condition declared: ${declaration.condition ?? "—"}`,
              timestamp: declaration.declaredAt ?? "—",
              description: `Declared by ${declaration.declaredBy ?? "—"} — Simulated, not yet written to SAP.`,
              tone: "success" as const,
            }
          : {
              id: "d-pending",
              label: `Declaration ${declaration.status.toLowerCase()}`,
              timestamp: "Outstanding",
              description: declaration.nextAction,
              tone: declaration.status === "Flagged" ? ("danger" as const) : ("warning" as const),
            },
      ]
    : []

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <PageHeader
          title={`Repair ${chain.id}`}
          description="Simulated repair chain — no live SAP connection."
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
              <div className="text-lg font-semibold text-foreground">
                {orUnknown(chain.stockOnHand)}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Reorder point</div>
              {/* Undefined for every Gamsberg material: the MARC extract covers
                  plants 1300 and 1200 only. Showing 0 would read as "never
                  reorder", which is worse than showing nothing. */}
              <div className="text-lg font-semibold text-foreground">
                {orUnknown(chain.reorderPoint)}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Under repair</div>
              <div className="text-lg font-semibold text-foreground">{chain.qtyUnderRepair}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Expected availability</div>
              <div className="text-lg font-semibold text-foreground">
                {chain.expectedReturn ?? UNKNOWN}
              </div>
            </div>
          </div>
        </div>

        {chain.declarationStatus === "Flagged" && (
          <AlertBanner tone="critical" title="Duplicate procurement flagged">
            A new-unit procurement request was raised against this material while its repair PO was
            already open. Reconcile with the buyer before proceeding.
          </AlertBanner>
        )}
        {isOverdue && (
          <AlertBanner tone="warning" title="Repair overdue">
            Expected return was {chain.expectedReturn ?? UNKNOWN} — {formatDaysRemaining(chain)}.
            Follow up with {vendorLabel(chain)}.
          </AlertBanner>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-1 text-sm font-medium text-foreground">Repair chain</div>
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <SAPDocumentChip doc={chain.repairPR} />
              {chain.repairPO && <SAPDocumentChip doc={chain.repairPO} />}
              <StatusBadge tone={RECEIPT_STATUS_TONE[chain.receiptStatus]}>
                {chain.receiptStatus}
              </StatusBadge>
            </div>
            <Timeline events={buildRepairTimeline(chain)} />
          </div>

          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-3 text-sm font-medium text-foreground">Vendor & economics</div>
              <dl className="grid grid-cols-2 gap-y-2 text-xs">
                <dt className="text-muted-foreground">Vendor</dt>
                <dd className="text-right text-foreground">{vendorLabel(chain)}</dd>
                <dt className="text-muted-foreground">Days open</dt>
                <dd className="text-right text-foreground">{chain.daysOpen}</dd>
                <dt className="text-muted-foreground">New-unit cost</dt>
                {/* No valuation source in Initiative 8's table set -- stated as
                    unavailable rather than implied as zero. */}
                <dd className="text-right text-foreground">
                  {chain.newUnitCost === undefined ? "Not available" : formatZAR(chain.newUnitCost)}
                </dd>
                <dt className="text-muted-foreground">Repair cost</dt>
                <dd className="text-right text-foreground">{formatZAR(chain.repairCost)}</dd>
                <dt className="text-muted-foreground">New-unit lead time</dt>
                {/* Undefined on every Gamsberg line -- MARC covers plants 1300
                    and 1200 only. "— days" would read as a lead time of nothing,
                    which is the strongest possible case against repairing. */}
                <dd className="text-right text-foreground">
                  {chain.newUnitLeadTimeDays === undefined
                    ? UNKNOWN
                    : `${chain.newUnitLeadTimeDays} days`}
                </dd>
                <dt className="text-muted-foreground">Repair return time</dt>
                <dd className="text-right text-foreground">{formatDaysRemaining(chain)}</dd>
              </dl>
              {chain.notes && (
                <p className="mt-3 border-t border-dashed border-border pt-2 text-[11px] text-muted-foreground italic">
                  {chain.notes}
                </p>
              )}
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-3 text-sm font-medium text-foreground">Declaration history</div>
              {declaration ? (
                <Timeline events={declarationTimeline} />
              ) : (
                <p className="text-xs text-muted-foreground">
                  No condition-to-repair declaration on file for this repair chain.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
