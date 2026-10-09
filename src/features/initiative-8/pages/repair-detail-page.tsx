"use client"

import Link from "next/link"

import { AlertBanner } from "@/components/shared/alert-banner"
import { EmptyState } from "@/components/shared/empty-state"
import { MaterialIdentity } from "@/components/shared/material-identity"
import { PageHeader } from "@/components/shared/page-header"
import { SAPDocumentChip } from "@/components/shared/sap-document-chip"
import { StatusBadge } from "@/components/shared/status-badge"
import { Timeline, type TimelineEvent } from "@/components/shared/timeline"
import { DeclareConditionButton } from "@/features/initiative-8/components/declare-condition-button"
import type { RepairChain } from "@/features/initiative-8/types/repair"
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
  orUnknown,
  vendorLabel,
} from "@/features/initiative-8/utils/status"
import { isPlaceholderActor } from "@/lib/api/actor"
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
  /**
   * The attestation form's fault categories, served by the API. Empty when
   * that fetch failed: the form then says so rather than offering a list it
   * made up.
   */
  faultCategories?: string[]
}

export function RepairDetailPage({
  repairId,
  detail,
  loadError = null,
  faultCategories = [],
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
              {/* Undefined for every Gamsberg material: the July MARC extract
                  has rows for plant 1300 only. Showing 0 would read as "never
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
              {isPartiallyReceived(chain) && (
                <StatusBadge tone="warning">Partially received</StatusBadge>
              )}
            </div>
            {/* The backend's timeline: it carries the evidence for every
                stage, including the ones it cannot prove. */}
            <Timeline events={detail.timeline} />
          </div>

          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-3 text-sm font-medium text-foreground">Vendor, cost & timing</div>
              <dl className="grid grid-cols-2 gap-y-2 text-xs">
                <dt className="text-muted-foreground">Vendor</dt>
                <dd className="text-right text-foreground">{vendorLabel(chain)}</dd>
                <dt className="text-muted-foreground">Days open</dt>
                <dd className="text-right text-foreground">{chain.daysOpen}</dd>
                <dt className="text-muted-foreground">Repair cost</dt>
                {/* Unknown when the PO line carries no net price -- R 0.00 would
                    read as a free repair. */}
                <dd className="text-right text-foreground">
                  {chain.repairCost === undefined ? UNKNOWN : formatZAR(chain.repairCost)}
                </dd>
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
                  <DeclareConditionButton chain={chain} faultCategories={faultCategories} />
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
                {/* A requisitioner CODE: no person directory was delivered. */}
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
 * the purchases made with none: this line's share of the Justifications screen.
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
                <span className={entry.author && isPlaceholderActor(entry.author) ? "italic" : undefined}>
                  {entry.author ?? UNKNOWN}
                </span>
                {entry.author && isPlaceholderActor(entry.author) && " (no sign-in — provisional)"}
                {entry.recordedAt && ` · ${entry.recordedAt}`}
                {entry.sessionId && (
                  <>
                    {" · "}
                    <Link
                      href={`/assistant/sessions/${encodeURIComponent(entry.sessionId)}`}
                      className="text-primary hover:underline"
                    >
                      session {entry.sessionId}
                    </Link>
                  </>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}

      {/* Why some reasons are not here: one recorded while a unit was on the
          shelf, with nothing out for repair, has no line to sit on. */}
      <p className="mt-3 text-[11px] text-muted-foreground">
        Reasons recorded while a unit was on the shelf, with nothing out for repair, are on the{" "}
        <Link href="/repairable-spares/justifications" className="text-primary hover:underline">
          Justifications
        </Link>{" "}
        screen.
      </p>
    </div>
  )
}
