"use client"

import { Fragment, useState } from "react"
import { TriangleAlert } from "lucide-react"

import { DeliveredOnCell } from "@/features/initiative-13/components/delivered-on-cell"
import { deliveryStatusFromProcurement } from "@/features/initiative-13/utils/delivery-status"
import { EmptyState } from "@/components/shared/empty-state"
import { SAPDocumentChip } from "@/components/shared/sap-document-chip"
import { EmptyValue } from "@/features/initiative-13/components/empty-value"
import { DataTable, RowToggle } from "@/features/initiative-13/components/ui/data-table"
import { StatusPill } from "@/features/initiative-13/components/ui/status-pill"
import { Stepper, StepperDots } from "@/features/initiative-13/components/ui/stepper-dots"
import type { EmptyKind } from "@/features/initiative-13/utils/empty-labels"
import { journeySteps, journeyStop } from "@/features/initiative-13/utils/oar-display"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { UtilisationLedgerEntry } from "@/lib/api/i13"
import { sapPlantLabel } from "@/lib/shared-data/sap-plants"
import { cn, formatCount } from "@/lib/utils"

function label(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ")
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
        <p className="flex items-start gap-2 rounded-lg bg-caution-tint px-3 py-2 text-sm text-caution-ink">
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>
            {stop.after ? (
              <>
                Stops at <span className="font-bold">{stop.after.label}</span>
              </>
            ) : (
              <>Nothing linked yet</>
            )}{" "}
            — next is <span className="font-bold">{stop.next.label}</span>: {stop.next.detail.toLowerCase()}.
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
      <DataTable>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <span className="sr-only">Details</span>
              </TableHead>
              <TableHead>Material</TableHead>
              <TableHead>Plant</TableHead>
              <TableHead>Journey</TableHead>
              <TableHead>Reservation</TableHead>
              <TableHead>PR</TableHead>
              <TableHead>PO</TableHead>
              <TableHead className="text-right">Received</TableHead>
              <TableHead>Delivered on</TableHead>
              <TableHead className="text-right">Issued</TableHead>
              <TableHead className="text-right">Open</TableHead>
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
                      <div className="flex max-w-[240px] flex-col gap-0.5">
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
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {sapPlantLabel(entry.plant)}
                    </TableCell>
                    <TableCell>
                      <StepperDots steps={journeySteps(entry)} />
                    </TableCell>
                    <TableCell>
                      {entry.reservationNumber ? (
                        <SAPDocumentChip
                          doc={{ type: "RESERVATION", documentNumber: entry.reservationNumber, line: entry.reservationItem ?? undefined }}
                        />
                      ) : (
                        <span className="text-muted-foreground">Not linked</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {entry.prNumber ? (
                        <SAPDocumentChip doc={{ type: "PR", documentNumber: entry.prNumber, line: entry.prItem ?? undefined }} />
                      ) : (
                        <span className="text-muted-foreground">Not linked</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {entry.poNumber ? (
                        <SAPDocumentChip doc={{ type: "PO", documentNumber: entry.poNumber, line: entry.poItem ?? undefined }} />
                      ) : (
                        <span className="text-muted-foreground">Not linked</span>
                      )}
                    </TableCell>
                    {/* A label where the backend recorded nothing, not a
                        zero. "No goods receipt was recorded" and "zero units
                        arrived" are different findings on this table, and the
                        adapter keeps them apart precisely so this cell can. */}
                    <Quantity value={entry.receivedQuantity} empty="noGrYet" />
                    <DeliveredOnCell
                      status={deliveryOf(entry)}
                      receivedQuantity={entry.receivedQuantity}
                    />
                    <Quantity value={entry.issuedQuantity} empty="notIssued" />
                    <Quantity value={entry.openQuantity} empty="notRecorded" />
                    <TableCell>
                      <StatusPill tone="primary">{label(entry.procurementStatus)}</StatusPill>
                    </TableCell>
                    <TableCell>
                      <StatusPill tone="caution">{label(entry.utilisationStatus)}</StatusPill>
                    </TableCell>
                  </TableRow>
                  <TableRow className="hover:bg-transparent">
                    <TableCell className="p-0" />
                    <TableCell colSpan={12} className="p-0">
                      <div
                        className={cn(
                          "grid transition-[grid-template-rows] duration-300 ease-out",
                          isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                        )}
                      >
                        <div className="min-h-0 overflow-hidden">
                          <div className="bg-page px-4 py-5">
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
