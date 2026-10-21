"use client"

import { Fragment, useState } from "react"
import { ChevronRight } from "lucide-react"

import { DeliveredOnCell } from "@/features/initiative-13/components/delivered-on-cell"
import { deliveryStatusFromProcurement } from "@/features/initiative-13/utils/delivery-status"
import { EmptyState } from "@/components/shared/empty-state"
import { SAPDocumentChip } from "@/components/shared/sap-document-chip"
import { StatusBadge } from "@/components/shared/status-badge"
import { EmptyValue } from "@/features/initiative-13/components/empty-value"
import type { EmptyKind } from "@/features/initiative-13/utils/empty-labels"
import { Timeline, type TimelineEvent } from "@/components/shared/timeline"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type {
  ProcurementStatus,
  UtilisationLedgerEntry,
  LedgerUtilisationStatus,
} from "@/lib/api/i13"
import { sapPlantLabel } from "@/lib/shared-data/sap-plants"
import { cn, formatCount } from "@/lib/utils"

const PROCUREMENT_TONE: Record<ProcurementStatus, "default" | "success" | "warning"> = {
  OPEN: "default",
  PARTIALLY_RECEIVED: "warning",
  RECEIVED: "success",
}

const UTILISATION_TONE: Record<LedgerUtilisationStatus, "default" | "success" | "warning"> = {
  NOT_ISSUED: "default",
  PARTIALLY_ISSUED: "warning",
  FULLY_ISSUED: "success",
}

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
        formatCount(value)
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

function DocumentChainDetail({ entry }: { entry: UtilisationLedgerEntry }) {
  const events: TimelineEvent[] = [
    {
      id: "reservation",
      label: "Reservation",
      timestamp: "",
      description: entry.reservationNumber
        ? `Rsnum ${entry.reservationNumber}${entry.reservationItem ? `/${entry.reservationItem}` : ""}`
        : "Not linked",
      tone: entry.reservationNumber ? "success" : "default",
    },
    {
      id: "pr",
      label: "Purchase Requisition",
      timestamp: "",
      description: entry.prNumber ? `PR ${entry.prNumber}${entry.prItem ? `/${entry.prItem}` : ""}` : "Not linked",
      tone: entry.prNumber ? "success" : "default",
    },
    {
      id: "po",
      label: "Purchase Order",
      timestamp: "",
      description: entry.poNumber ? `PO ${entry.poNumber}${entry.poItem ? `/${entry.poItem}` : ""}` : "Not linked",
      tone: entry.poNumber ? "success" : "default",
    },
    {
      id: "gr",
      label: "Goods Receipt",
      timestamp: entry.firstGrDate ?? "",
      description: entry.firstGrDate
        ? `First ${entry.firstGrDate}${entry.latestGrDate && entry.latestGrDate !== entry.firstGrDate ? `, latest ${entry.latestGrDate}` : ""}`
        : "Not available",
      tone: entry.firstGrDate ? "success" : "default",
    },
    {
      id: "gi",
      label: "Goods Issue",
      timestamp: entry.firstGiDate ?? "",
      description: entry.firstGiDate
        ? `First ${entry.firstGiDate}${entry.latestGiDate && entry.latestGiDate !== entry.firstGiDate ? `, latest ${entry.latestGiDate}` : ""}`
        : "Not available",
      tone: entry.firstGiDate ? "success" : "default",
    },
  ]

  return <Timeline events={events} />
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
      <div className="overflow-x-auto rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Material</TableHead>
              <TableHead>Plant</TableHead>
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
                    aria-expanded={isExpanded}
                  >
                    <TableCell>
                      <ChevronRight
                        className={cn(
                          "size-4 text-muted-foreground transition-transform duration-300 ease-out",
                          isExpanded && "rotate-90"
                        )}
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
                      <StatusBadge tone={PROCUREMENT_TONE[entry.procurementStatus]}>
                        {label(entry.procurementStatus)}
                      </StatusBadge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={UTILISATION_TONE[entry.utilisationStatus]}>
                        {label(entry.utilisationStatus)}
                      </StatusBadge>
                    </TableCell>
                  </TableRow>
                  <TableRow className="hover:bg-transparent">
                    <TableCell className="p-0" />
                    <TableCell colSpan={11} className="p-0">
                      <div
                        className={cn(
                          "grid transition-[grid-template-rows] duration-300 ease-out",
                          isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                        )}
                      >
                        <div className="min-h-0 overflow-hidden">
                          <div className="bg-muted/30 px-4 py-3">
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
      </div>
    </div>
  )
}
