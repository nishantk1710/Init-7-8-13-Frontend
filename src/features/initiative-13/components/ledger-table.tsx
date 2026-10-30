"use client"

import { Fragment, useState } from "react"
import { TriangleAlert } from "lucide-react"

import { DeliveredOnCell } from "@/features/initiative-13/components/delivered-on-cell"
import { deliveryStatusFromProcurement, PROCUREMENT_STATUS_LABELS } from "@/features/initiative-13/utils/delivery-status"
import { EmptyState } from "@/components/shared/empty-state"
import { EmptyValue } from "@/features/initiative-13/components/empty-value"
import { DataTable, RowToggle, FITTED_TABLE } from "@/features/initiative-13/components/ui/data-table"
import { DocNo } from "@/features/initiative-13/components/ui/doc-no"
import { StatusPill } from "@/features/initiative-13/components/ui/status-pill"
import { Stepper } from "@/features/initiative-13/components/ui/stepper-dots"
import type { EmptyKind } from "@/features/initiative-13/utils/empty-labels"
import { IssuedOnCell, NextPlannedIssueCell } from "@/features/initiative-13/components/issued-on-cell"
import {
  ISSUE_MATCH_EXPLANATIONS,
  ISSUE_MATCH_LABELS,
  UTILISATION_STATUS_LABELS,
} from "@/features/initiative-13/utils/issue-match"
import { journeySteps, journeyStop, type DisplayTone } from "@/features/initiative-13/utils/oar-display"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { LedgerUtilisationStatus, ProcurementStatus, UtilisationLedgerEntry } from "@/lib/api/i13"
import { sapPlantLabel } from "@/lib/shared-data/sap-plants"
import { cn, formatCount } from "@/lib/utils"

const PROCUREMENT_TONE: Record<ProcurementStatus, DisplayTone> = {
  OPEN: "primary",
  PARTIALLY_RECEIVED: "caution",
  RECEIVED: "healthy",
  CLOSED: "neutral",
  NOT_AN_ORDER: "neutral",
}

const UTILISATION_TONE: Record<LedgerUtilisationStatus, DisplayTone> = {
  NOT_ISSUED: "urgent",
  PARTIALLY_ISSUED: "caution",
  FULLY_ISSUED: "healthy",
  BEFORE_ISSUE_HISTORY: "neutral",
}

/** The quantity drawn on top of a date cell (Received, Issued); nothing when there is none to show. */
function QuantityLead({ value }: { value: number | null }) {
  if (!value) return null
  return <span className="font-semibold tabular-nums text-foreground">{formatCount(value)}</span>
}

/**
 * Received against ordered -- "0 of 6", "4 of 10" -- when the backend sent the
 * PO line's quantity (EKPO-MENGE). What is still to come on an open line adds
 * up to the assistant's Open PO. A line ordering nothing (a contract) or with
 * no quantity sent falls back to the received quantity alone.
 */
function ReceivedLead({ received, ordered }: { received: number | null; ordered: number | null }) {
  if (!ordered) return <QuantityLead value={received} />
  return (
    <span className="tabular-nums" title="Received of ordered (EKPO-MENGE)">
      <span className="font-semibold text-foreground">{formatCount(received ?? 0)}</span>
      <span className="text-muted-foreground"> of {formatCount(ordered)}</span>
    </span>
  )
}

function Quantity({ value, empty }: { value: number | null; empty: EmptyKind }) {
  return (
    <TableCell className="text-right text-foreground">
      {value === null ? (
        <EmptyValue kind={empty} />
      ) : (
        <span className="font-semibold tabular-nums">{formatCount(value)}</span>
      )}
    </TableCell>
  )
}

/**
 * A line is one PO item (or one PR item not yet on a PO), so its documents
 * identify it. Not `ledgerId`: the backend builds that from the PR item alone,
 * and a PR item ordered on several PO lines gives them all the same id.
 */
function rowKey(entry: UtilisationLedgerEntry): string {
  return [entry.poNumber, entry.poItem, entry.prNumber, entry.prItem].map((v) => v ?? "").join("|")
}

function deliveryOf(entry: UtilisationLedgerEntry) {
  return deliveryStatusFromProcurement({
    hasPo: Boolean(entry.poNumber),
    procurementStatus: entry.procurementStatus,
    firstGrDate: entry.firstGrDate,
    latestGrDate: entry.latestGrDate,
    expectedDeliveryDate: entry.expectedDeliveryDate,
  })
}

/** The five steps at full size, and where the line stops if it has not reached goods issue. */
function DocumentChainDetail({ entry }: { entry: UtilisationLedgerEntry }) {
  const steps = journeySteps(entry)
  const stop = journeyStop(steps)
  return (
    <div className="flex flex-col gap-4">
      <Stepper steps={steps} />
      {stop && (
        <p className="flex items-start gap-2 rounded-lg bg-warning/15 px-3 py-2 text-sm text-warning">
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>
            {stop.after ? (
              <>
                Stops at <span className="font-semibold">{stop.after.label}</span>
              </>
            ) : (
              <>Nothing linked yet</>
            )}{" "}
            — next is <span className="font-semibold">{stop.next.label}</span>: {stop.next.detail.toLowerCase()}.
          </span>
        </p>
      )}
    </div>
  )
}

/**
 * The utilisation ledger table.
 *
 * Renders one page of lines it is handed. Every filter -- plant, material and
 * the three statuses (procurement, utilization, delivery) -- is a URL
 * parameter the backend applies over the whole ledger, and the page owns the
 * pager. The status filters used to run here, over the first 1,000 lines the
 * page had loaded, so a filtered view silently missed every match past them.
 */
export function UtilizationLedgerTable({
  entries,
}: {
  entries: UtilisationLedgerEntry[]
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  if (entries.length === 0) {
    return (
      <EmptyState
        title="No utilization records found."
        description="No lines match these filters. Try clearing some of them."
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <DataTable className={FITTED_TABLE}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <span className="sr-only">Details</span>
              </TableHead>
              <TableHead>Material</TableHead>
              <TableHead>PO / PR</TableHead>
              <TableHead title="Quantity received, with the goods-receipt date (EKBE-BUDAT) underneath">Received</TableHead>
              <TableHead title="Quantity issued, with the goods-issue date (MKPF-BUDAT) underneath">Issued</TableHead>
              <TableHead className="text-right" title="Received and not yet issued">In store</TableHead>
              <TableHead title="The earliest open reservation expected to draw on this line's stock">
                Next planned issue
              </TableHead>
              <TableHead>Procurement</TableHead>
              <TableHead>Utilization</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => {
              const key = rowKey(entry)
              const isExpanded = expandedId === key
              return (
                <Fragment key={key}>
                  <TableRow
                    className="cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : key)}
                  >
                    <TableCell className="px-1">
                      <RowToggle
                        expanded={isExpanded}
                        onToggle={() => setExpandedId(isExpanded ? null : key)}
                        label={`ledger line ${entry.material}${entry.poNumber ? ` PO ${entry.poNumber}` : entry.prNumber ? ` PR ${entry.prNumber}` : ""}`}
                      />
                    </TableCell>
                    <TableCell className="text-foreground">
                      <div className="flex max-w-[200px] flex-col gap-0.5">
                        {entry.materialDescription ? (
                          <>
                            <span className="truncate font-medium" title={entry.materialDescription}>
                              {entry.materialDescription}
                            </span>
                            <span className="text-[11px] text-muted-foreground">{entry.material}</span>
                          </>
                        ) : (
                          <span className="font-medium">{entry.material}</span>
                        )}
                        <span className="text-[11px] whitespace-nowrap text-muted-foreground">
                          {sapPlantLabel(entry.plant)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1">
                        {entry.poNumber ? (
                          <DocNo number={entry.poNumber} item={entry.poItem} />
                        ) : (
                          <span className="text-xs text-muted-foreground">No PO yet</span>
                        )}
                        {entry.prNumber && (
                          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            PR <DocNo number={entry.prNumber} item={entry.prItem} />
                          </span>
                        )}
                      </div>
                    </TableCell>
                    {/* The quantity sits on top only when something arrived or
                        went out: underneath, the date cell already says "No PO
                        yet", "Not delivered" or "Not issued yet" -- a label
                        where the backend recorded nothing, never a bare zero.
                        Received is the exception once the ordered quantity is
                        known: "0 of 6" says how much is still to come. */}
                    <DeliveredOnCell
                      status={deliveryOf(entry)}
                      receivedQuantity={entry.receivedQuantity}
                      lead={<ReceivedLead received={entry.receivedQuantity} ordered={entry.orderedQuantity} />}
                    />
                    <IssuedOnCell
                      firstDate={entry.firstGiDate}
                      lastDate={entry.latestGiDate}
                      received={(entry.receivedQuantity ?? 0) > 0}
                      issueMatch={entry.issueMatch}
                      lead={<QuantityLead value={entry.issuedQuantity} />}
                    />
                    <Quantity value={entry.openQuantity} empty="notRecorded" />
                    <NextPlannedIssueCell
                      date={entry.nextPlannedIssueDate}
                      quantity={entry.nextPlannedIssueQuantity}
                      inStock={(entry.openQuantity ?? 0) > 0}
                    />
                    <TableCell>
                      <StatusPill tone={PROCUREMENT_TONE[entry.procurementStatus]} className="h-auto py-0.5 leading-tight whitespace-normal">
                        {PROCUREMENT_STATUS_LABELS[entry.procurementStatus]}
                      </StatusPill>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1">
                        <StatusPill tone={UTILISATION_TONE[entry.utilisationStatus]} className="h-auto py-0.5 leading-tight whitespace-normal">
                          {UTILISATION_STATUS_LABELS[entry.utilisationStatus]}
                        </StatusPill>
                        {entry.issueMatch && entry.issueMatch !== "BEFORE_ISSUE_HISTORY" && (
                          <span
                            className="cursor-help text-[11px] whitespace-nowrap text-muted-foreground underline decoration-dotted underline-offset-2"
                            title={ISSUE_MATCH_EXPLANATIONS[entry.issueMatch]}
                          >
                            {ISSUE_MATCH_LABELS[entry.issueMatch]}
                            {entry.issueMatch === "RESERVATION" && entry.reservationNumber
                              ? ` ${entry.reservationNumber}${entry.reservationItem ? `/${entry.reservationItem}` : ""}`
                              : ""}
                          </span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                  <TableRow className="hover:bg-transparent">
                    <TableCell className="p-0" />
                    <TableCell colSpan={8} className="p-0">
                      <div
                        className={cn(
                          "grid transition-[grid-template-rows] duration-300 ease-out",
                          isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                        )}
                      >
                        <div className="min-h-0 overflow-hidden">
                          <div className="bg-muted/40 px-4 py-5">
                            {/* Rendered from the row we already have.
                                This used to call GET /i13/ledger/{id} on
                                every expansion -- which returns the SAME
                                model this list response already contained,
                                and rebuilds the entire unfiltered ledger
                                server-side to linear-scan for one row. A
                                request per click, for data in hand. */}
                            {isExpanded && <DocumentChainDetail entry={entry} />}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                </Fragment>
              )
            })}
          </TableBody>
        </Table>
      </DataTable>
    </div>
  )
}
