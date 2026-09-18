"use client"

import { AlertBanner } from "@/components/shared/alert-banner"
import { EmptyState } from "@/components/shared/empty-state"
import { MaterialIdentity } from "@/components/shared/material-identity"
import { PageHeader } from "@/components/shared/page-header"
import { SAPDocumentChip } from "@/components/shared/sap-document-chip"
import { StatusBadge } from "@/components/shared/status-badge"
import { Timeline, type TimelineEvent } from "@/components/shared/timeline"
import type { RepairChain } from "@/features/initiative-8/types/repair"
import {
  DECLARATION_STATUS_TONE,
  RECEIPT_STATUS_TONE,
  REPAIR_STATUS_TONE,
  UNKNOWN,
  formatDaysRemaining,
  isRepairOverdue,
  orUnknown,
  vendorLabel,
} from "@/features/initiative-8/utils/status"
import { useMaterial360 } from "@/lib/material-360-context"
import { formatZAR } from "@/lib/utils"

export type RepairDetailPageProps = {
  repairId: string
  /**
   * The line and its lifecycle, fetched by the route.
   *
   * They arrive together or not at all: the timeline is the backend's, because
   * it carries the EVIDENCE for each stage — including the stages it cannot
   * prove, which are the ones worth reading. Absent means the backend answered
   * and has no such line, which renders the not-found state.
   */
  detail?: { chain: RepairChain; timeline: TimelineEvent[] }
  /** Set when the fetch failed. Rendered as a failure, never as "not found". */
  loadError?: string | null
}

export function RepairDetailPage({
  repairId,
  detail,
  loadError = null,
}: RepairDetailPageProps) {
  const { openMaterial360 } = useMaterial360()
  const chain = detail?.chain

  if (loadError) {
    // Deliberately NOT the "repair not found" empty state. A line that does not
    // exist and a backend that cannot be reached are different answers, and
    // showing the second as the first sends someone looking for the wrong bug.
    return (
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <div className="mx-auto flex max-w-5xl flex-col gap-4">
          <PageHeader title={`Repair ${repairId}`} />
          <div
            role="alert"
            className="rounded-xl border border-destructive/40 bg-destructive/5 p-8 text-center text-sm"
          >
            <p className="font-medium text-foreground">This repair could not be loaded.</p>
            <p className="mt-1 text-muted-foreground">{loadError}</p>
            <p className="mt-3 text-xs text-muted-foreground">
              This is not a missing repair — it is a failed request. Check that the
              backend is running and that NEXT_PUBLIC_API_BASE_URL points at it.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (!chain) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <div className="mx-auto flex max-w-5xl flex-col gap-4">
          <PageHeader title="Repair not found" />
          <EmptyState
            title={`No repair chain "${repairId}"`}
            description="No repair line with this id exists in the July SAP extract."
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
          description="Live data from the July SAP extract. Every stage below shows the evidence for it, or why there is none."
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
            {/* The backend's timeline: it carries the evidence for every
                stage, including the ones it cannot prove. */}
            <Timeline events={detail.timeline} />
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

            {/* The backend's own answer, computed from the attestation table
                against a material + plant + date-window match (W5.3). The
                fixture declaration timeline that used to sit here was keyed to
                the RC-80xx scenario ids and could only ever have attached a
                fabricated audit trail to a real part. */}
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-3 text-sm font-medium text-foreground">Condition declaration</div>
              <StatusBadge tone={DECLARATION_STATUS_TONE[chain.declarationStatus]}>
                {chain.declarationStatus}
              </StatusBadge>
              <p className="mt-2 text-xs text-muted-foreground">
                {chain.declarationStatus === "Completed"
                  ? "A recorded condition assessment covers this repair line."
                  : "No recorded condition assessment covers this repair line. Until this platform there was nowhere to record one, so nearly every historical line reads Required — that is the finding, not a fault."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
