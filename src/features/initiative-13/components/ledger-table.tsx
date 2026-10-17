"use client"

import { Fragment, useMemo, useState } from "react"
import { ChevronRight } from "lucide-react"

import { AskAssistantLink } from "@/components/assistant/ask-assistant-link"
import { DeliveredOnCell } from "@/features/initiative-13/components/delivered-on-cell"
import {
  DELIVERY_STATE_LABELS,
  deliveryStatusFromProcurement,
  type DeliveryState,
} from "@/features/initiative-13/utils/delivery-status"
import { EmptyState } from "@/components/shared/empty-state"
import { ClearFiltersButton } from "@/components/shared/clear-filters-button"
import { TablePagination } from "@/components/shared/table-pagination"
import { FilterBar } from "@/components/shared/filter-bar"
import { SAPDocumentChip } from "@/components/shared/sap-document-chip"
import { StatusBadge } from "@/components/shared/status-badge"
import { Timeline, type TimelineEvent } from "@/components/shared/timeline"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { usePaginatedRows } from "@/hooks/use-paginated-rows"
import { sapPlantLabel } from "@/lib/shared-data/sap-plants"
import { cn, formatCount } from "@/lib/utils"

const ALL_FILTER = "all"

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

function Quantity({ value }: { value: number | null }) {
  return (
    <TableCell className="text-right text-foreground">
      {value === null ? (
        <span className="text-muted-foreground" title="Not recorded">
          —
        </span>
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
 * Plant and material are **not** filtered here any more — they are server-side
 * query parameters now, owned by the URL and rendered by `I13UrlFilters` on the
 * page. What remains local are the three status filters (procurement,
 * utilization, delivery), which narrow rows the
 * server already sent: that is genuine client work over data in hand, and it is
 * the split Initiative 8's register uses.
 */
export function UtilizationLedgerTable({
  entries,
}: {
  entries: UtilisationLedgerEntry[]
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [procurementFilter, setProcurementFilter] = useState<string>(ALL_FILTER)
  const [utilisationFilter, setUtilisationFilter] = useState<string>(ALL_FILTER)
  const [deliveryFilter, setDeliveryFilter] = useState<string>(ALL_FILTER)

  const filtered = useMemo(
    () =>
      entries.filter((e) => {
        if (procurementFilter !== ALL_FILTER && e.procurementStatus !== procurementFilter) return false
        if (utilisationFilter !== ALL_FILTER && e.utilisationStatus !== utilisationFilter) return false
        if (deliveryFilter !== ALL_FILTER && deliveryOf(e).state !== deliveryFilter) return false
        return true
      }),
    [entries, procurementFilter, utilisationFilter, deliveryFilter]
  )
  const { paged, page, pageSize, total, setPage } = usePaginatedRows(filtered, {
    resetKey: `${procurementFilter}|${utilisationFilter}|${deliveryFilter}`,
  })

  if (entries.length === 0) {
    return (
      <EmptyState
        title="No utilization records found."
        description="Try clearing the plant/material filters."
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <FilterBar>
        <Select value={procurementFilter} onValueChange={(v) => setProcurementFilter(v ?? ALL_FILTER)}>
          <SelectTrigger className="h-9 w-full sm:w-48">
            <SelectValue placeholder="Procurement status">
              {(v: string) => (v === ALL_FILTER ? "All procurement statuses" : label(v))}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>All procurement statuses</SelectItem>
            {Object.keys(PROCUREMENT_TONE).map((s) => (
              <SelectItem key={s} value={s}>
                {label(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={utilisationFilter} onValueChange={(v) => setUtilisationFilter(v ?? ALL_FILTER)}>
          <SelectTrigger className="h-9 w-full sm:w-48">
            <SelectValue placeholder="Utilization status">
              {(v: string) => (v === ALL_FILTER ? "All utilization statuses" : label(v))}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>All utilization statuses</SelectItem>
            {Object.keys(UTILISATION_TONE).map((s) => (
              <SelectItem key={s} value={s}>
                {label(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={deliveryFilter} onValueChange={(v) => setDeliveryFilter(v ?? ALL_FILTER)}>
          <SelectTrigger className="h-9 w-full sm:w-48">
            <SelectValue placeholder="Delivery status">
              {(v: string) =>
                v === ALL_FILTER ? "All delivery statuses" : DELIVERY_STATE_LABELS[v as DeliveryState]
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>All delivery statuses</SelectItem>
            {(Object.keys(DELIVERY_STATE_LABELS) as DeliveryState[]).map((s) => (
              <SelectItem key={s} value={s}>
                {DELIVERY_STATE_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <ClearFiltersButton
          activeCount={
            [procurementFilter, utilisationFilter, deliveryFilter].filter((f) => f !== ALL_FILTER)
              .length
          }
          onClear={() => {
            setProcurementFilter(ALL_FILTER)
            setUtilisationFilter(ALL_FILTER)
            setDeliveryFilter(ALL_FILTER)
          }}
        />
      </FilterBar>

      {filtered.length === 0 ? (
        <EmptyState
          title="No utilization records found."
          description="No rows match the selected status filters."
        />
      ) : (
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
              {paged.map((entry) => {
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
                          {/* Stops the click reaching the row's expand handler:
                              following the link and opening the drawer are
                              different intents on the same pixel. */}
                          <span onClick={(event) => event.stopPropagation()}>
                            <AskAssistantLink
                              materialId={entry.material}
                              plant={entry.plant}
                              variant="chip"
                              label="Ask"
                            />
                          </span>
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
                      {/* An em-dash where the backend recorded nothing, not a
                          zero. "No goods receipt was recorded" and "zero units
                          arrived" are different findings on this table, and the
                          adapter keeps them apart precisely so this cell can. */}
                      <Quantity value={entry.receivedQuantity} />
                      <DeliveredOnCell
                        status={deliveryOf(entry)}
                        receivedQuantity={entry.receivedQuantity}
                      />
                      <Quantity value={entry.issuedQuantity} />
                      <Quantity value={entry.openQuantity} />
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
      )}
      <TablePagination
        page={page}
        pageSize={pageSize}
        total={total}
        count={paged.length}
        noun="loaded ledger lines"
        onPageChange={setPage}
      />
    </div>
  )
}
