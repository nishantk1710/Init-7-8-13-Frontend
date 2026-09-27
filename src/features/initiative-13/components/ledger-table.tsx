"use client"

import { Fragment, useMemo, useState } from "react"
import { ChevronRight } from "lucide-react"

import { AskAssistantLink } from "@/components/assistant/ask-assistant-link"
import { EmptyState } from "@/components/shared/empty-state"
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
  LinkageStatus,
  ProcurementStatus,
  UtilisationLedgerEntry,
  LedgerUtilisationStatus,
} from "@/lib/api/i13"
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

const LINKAGE_TONE: Record<LinkageStatus, "default" | "success" | "warning" | "danger"> = {
  RESERVATION_LINKED: "success",
  FULL_CHAIN: "success",
  PR_ONLY: "warning",
  UNMATCHED: "danger",
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

/** Parses the backend's own `dataSource` string (e.g.
 * "reservation:MOCK,pr:LIVE,po:LIVE,gr:LIVE,gi:LIVE") into leg/mode pairs —
 * pure display of a string the backend already produced, no source-mode
 * decisions made here. */
function parseDataSource(dataSource: string): { leg: string; mode: string }[] {
  return dataSource
    .split(",")
    .map((part) => part.split(":"))
    .filter((pair): pair is [string, string] => pair.length === 2)
    .map(([leg, mode]) => ({ leg, mode }))
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

  const sources = parseDataSource(entry.dataSource)

  return (
    <div className="grid grid-cols-1 gap-4 p-1 sm:grid-cols-[1fr_auto]">
      <Timeline events={events} />
      <dl className="flex h-fit flex-col gap-1 rounded-lg border border-border p-3 text-[11px] sm:w-64">
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Attribution</dt>
          <dd className="text-right text-foreground">{entry.attributionStatus ? label(entry.attributionStatus) : "—"}</dd>
        </div>
        {entry.attributionEvidence && (
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">Evidence</dt>
            <dd className="max-w-[160px] text-right text-foreground">{entry.attributionEvidence}</dd>
          </div>
        )}
        <div className="mt-1 border-t border-dashed border-border pt-1">
          <dt className="mb-1 text-muted-foreground">Source per leg</dt>
          <dd className="flex flex-wrap gap-1">
            {sources.map(({ leg, mode }) => (
              <span
                key={leg}
                className={cn(
                  "rounded-md border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.4px]",
                  mode === "MOCK"
                    ? "border-warning/30 bg-warning/10 text-warning"
                    : mode === "UNAVAILABLE"
                      ? "border-destructive/30 bg-destructive/10 text-destructive"
                      : "border-success/30 bg-success/10 text-success"
                )}
              >
                {leg}: {mode}
              </span>
            ))}
          </dd>
        </div>
      </dl>
    </div>
  )
}

/**
 * The utilisation ledger table.
 *
 * Plant and material are **not** filtered here any more — they are server-side
 * query parameters now, owned by the URL and rendered by `I13UrlFilters` on the
 * page. What remains local are the three status filters, which narrow rows the
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
  const [linkageFilter, setLinkageFilter] = useState<string>(ALL_FILTER)

  const filtered = useMemo(
    () =>
      entries.filter((e) => {
        if (procurementFilter !== ALL_FILTER && e.procurementStatus !== procurementFilter) return false
        if (utilisationFilter !== ALL_FILTER && e.utilisationStatus !== utilisationFilter) return false
        if (linkageFilter !== ALL_FILTER && e.linkageStatus !== linkageFilter) return false
        return true
      }),
    [entries, procurementFilter, utilisationFilter, linkageFilter]
  )

  if (entries.length === 0) {
    return (
      <EmptyState
        title="No utilisation records found."
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
            <SelectValue placeholder="Utilisation status">
              {(v: string) => (v === ALL_FILTER ? "All utilisation statuses" : label(v))}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>All utilisation statuses</SelectItem>
            {Object.keys(UTILISATION_TONE).map((s) => (
              <SelectItem key={s} value={s}>
                {label(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={linkageFilter} onValueChange={(v) => setLinkageFilter(v ?? ALL_FILTER)}>
          <SelectTrigger className="h-9 w-full sm:w-44">
            <SelectValue placeholder="Linkage status">
              {(v: string) => (v === ALL_FILTER ? "All linkage statuses" : label(v))}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_FILTER}>All linkage statuses</SelectItem>
            {Object.keys(LINKAGE_TONE).map((s) => (
              <SelectItem key={s} value={s}>
                {label(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterBar>

      {filtered.length === 0 ? (
        <EmptyState
          title="No utilisation records found."
          description="No rows match the selected status filters."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Ledger ID</TableHead>
                <TableHead>Material</TableHead>
                <TableHead>Plant</TableHead>
                <TableHead>Reservation</TableHead>
                <TableHead>PR</TableHead>
                <TableHead>PO</TableHead>
                <TableHead className="text-right">Received</TableHead>
                <TableHead className="text-right">Issued</TableHead>
                <TableHead className="text-right">Open</TableHead>
                <TableHead>Procurement</TableHead>
                <TableHead>Utilisation</TableHead>
                <TableHead>Linkage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((entry) => {
                const isExpanded = expandedId === entry.ledgerId
                return (
                  <Fragment key={entry.ledgerId}>
                    <TableRow
                      className="cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : entry.ledgerId)}
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
                      <TableCell className="font-medium text-foreground">{entry.ledgerId}</TableCell>
                      <TableCell className="text-foreground">
                        <div className="flex flex-col gap-0.5">
                          <span>{entry.material}</span>
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
                      <TableCell className="text-muted-foreground">{entry.plant}</TableCell>
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
                      <TableCell>
                        <StatusBadge tone={LINKAGE_TONE[entry.linkageStatus]}>{label(entry.linkageStatus)}</StatusBadge>
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
    </div>
  )
}
