"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { ChevronRight, Download } from "lucide-react"

import { ClearFiltersButton } from "@demo/components/shared/clear-filters-button"
import { FilterBar } from "@demo/components/shared/filter-bar"
import { MaterialIdentity } from "@demo/components/shared/material-identity"
import { SAPDocumentChip } from "@demo/components/shared/sap-document-chip"
import { StatusBadge } from "@demo/components/shared/status-badge"
import { Button, buttonVariants } from "@demo/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@demo/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@demo/components/ui/table"
import {
  CRITICALITY_OPTIONS,
  REPAIR_CHAINS,
  REPAIR_PLANTS,
  REPAIR_STATUS_OPTIONS,
  REPAIR_VENDORS,
} from "@demo/features/initiative-8/data/repair-chains"
import {
  ALL,
  NO_REGISTER_FILTERS,
  REGISTER_CSV_HEADERS,
  filterRegister,
  registerRowsToCsv,
  type RegisterFilters,
} from "@demo/features/initiative-8/utils/register-view"
import {
  AGING_BUCKETS,
  CRITICALITY_TONE,
  DECLARATION_STATUSES,
  DECLARATION_STATUS_TONE,
  LEAD_TIME_VERDICT_LABEL,
  LEAD_TIME_VERDICT_TONE,
  OVERDUE_STATUSES,
  OVERDUE_STATUS_LABEL,
  OVERDUE_STATUS_TONE,
  REPAIR_STATUS_TONE,
  UNKNOWN,
  type LeadTimeVerdict,
  hasNoLeadTime,
  isBeyondLeadTime,
  isPartiallyReceived,
  overdueStatusOf,
} from "@demo/features/initiative-8/utils/status"
import { useMaterial360 } from "@demo/lib/material-360-context"
import { cn, downloadCsv, formatCount } from "@demo/lib/utils"

export function RepairRegisterTable() {
  const { openMaterial360 } = useMaterial360()
  const [filters, setFilters] = useState<RegisterFilters>(NO_REGISTER_FILTERS)

  function setFilter(key: keyof RegisterFilters) {
    return (value: string) => setFilters((current) => ({ ...current, [key]: value }))
  }

  const filtered = useMemo(() => filterRegister(REPAIR_CHAINS, filters), [filters])

  function exportCsv() {
    downloadCsv("i08-repair-register.csv", REGISTER_CSV_HEADERS, registerRowsToCsv(filtered))
  }

  return (
    <div className="flex flex-col gap-4">
      <FilterBar>
        <FilterSelect
          value={filters.plant}
          onChange={setFilter("plant")}
          allLabel="All plants"
          options={REPAIR_PLANTS.map((p) => ({ value: p.plantId, label: p.name }))}
          className="sm:w-44"
        />
        <FilterSelect
          value={filters.vendor}
          onChange={setFilter("vendor")}
          allLabel="All vendors"
          options={REPAIR_VENDORS.map((v) => ({ value: v, label: v }))}
          className="sm:w-52"
        />
        <FilterSelect
          value={filters.repairStatus}
          onChange={setFilter("repairStatus")}
          allLabel="All repair statuses"
          options={REPAIR_STATUS_OPTIONS.map((s) => ({ value: s, label: s }))}
          className="sm:w-44"
        />
        <FilterSelect
          value={filters.overdue}
          onChange={setFilter("overdue")}
          allLabel="Any due-date status"
          options={OVERDUE_STATUSES.map((s) => ({ value: s, label: OVERDUE_STATUS_LABEL[s] }))}
          className="sm:w-44"
        />
        <FilterSelect
          value={filters.criticality}
          onChange={setFilter("criticality")}
          allLabel="All criticalities"
          options={CRITICALITY_OPTIONS.map((c) => ({ value: c, label: c }))}
          className="sm:w-44"
        />
        <FilterSelect
          value={filters.declarationStatus}
          onChange={setFilter("declarationStatus")}
          allLabel="All declaration statuses"
          options={DECLARATION_STATUSES.map((s) => ({ value: s, label: s }))}
          className="sm:w-48"
        />
        <FilterSelect
          value={filters.aging}
          onChange={setFilter("aging")}
          allLabel="All aging"
          options={AGING_BUCKETS.map((b) => ({ value: b, label: `${b} days` }))}
          className="sm:w-40"
        />
        <ClearFiltersButton
          activeCount={Object.values(filters).filter((v) => v !== ALL).length}
          onClear={() => setFilters(NO_REGISTER_FILTERS)}
        />

        <div className="flex items-center gap-3 sm:ml-auto">
          <span className="text-xs text-muted-foreground">
            {formatCount(filtered.length)} of {formatCount(REPAIR_CHAINS.length)} lines
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={exportCsv}
            disabled={filtered.length === 0}
          >
            <Download className="size-3.5" />
            Export CSV
          </Button>
        </div>
      </FilterBar>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No repair chains match these filters.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Plant</TableHead>
                <TableHead>Criticality</TableHead>
                <TableHead className="text-right">SOH</TableHead>
                <TableHead className="text-right">ROP</TableHead>
                <TableHead>Repair PR</TableHead>
                <TableHead>Repair PO</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead className="text-right">Qty Under Repair</TableHead>
                <TableHead>Repair Status</TableHead>
                <TableHead>Expected Return</TableHead>
                <TableHead>Due Date Status</TableHead>
                <TableHead className="text-right">Days Open</TableHead>
                <TableHead>Lead Time</TableHead>
                <TableHead>Declaration Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => {
                const overdue = overdueStatusOf(c)
                const beyondLeadTime = isBeyondLeadTime(c)
                const noLeadTime = hasNoLeadTime(c)
                const verdict: LeadTimeVerdict = beyondLeadTime
                  ? "BEYOND_LEAD_TIME"
                  : "WITHIN_LEAD_TIME"
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <MaterialIdentity material={c.material} onOpen={openMaterial360} />
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate text-muted-foreground">
                      {c.material.description}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{c.plant.name}</TableCell>
                    <TableCell>
                      {c.criticality ? (
                        <StatusBadge tone={CRITICALITY_TONE[c.criticality] ?? "default"}>
                          {c.criticality}
                        </StatusBadge>
                      ) : (
                        <span
                          className="text-xs text-muted-foreground"
                          title="No criticality rating is recorded for this material"
                        >
                          {UNKNOWN}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-foreground">{c.stockOnHand}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {c.reorderPoint}
                    </TableCell>
                    <TableCell>
                      <SAPDocumentChip doc={c.repairPR} />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1">
                        {c.repairPO ? (
                          <SAPDocumentChip doc={c.repairPO} />
                        ) : (
                          <span className="text-xs text-muted-foreground">Not yet raised</span>
                        )}
                        {c.poBlocked && (
                          <StatusBadge tone="danger" className="h-4 px-1.5 text-[10px]">
                            Blocked in SAP
                          </StatusBadge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[160px] truncate text-muted-foreground">
                      {c.vendor}
                    </TableCell>
                    <TableCell className="text-right text-foreground">{c.qtyUnderRepair}</TableCell>
                    <TableCell>
                      <StatusBadge tone={REPAIR_STATUS_TONE[c.repairStatus]}>
                        {c.repairStatus}
                      </StatusBadge>
                      {isPartiallyReceived(c) && (
                        <span className="block text-[10px] italic text-warning">
                          partially received
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{c.expectedReturn}</TableCell>
                    <TableCell>
                      <StatusBadge tone={OVERDUE_STATUS_TONE[overdue]}>
                        {OVERDUE_STATUS_LABEL[overdue]}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="text-right text-foreground">{c.daysOpen}</TableCell>
                    <TableCell>
                      {noLeadTime ? (
                        <span
                          className="text-xs text-muted-foreground"
                          title="No planned delivery time is maintained for this material at this plant, so there is nothing to measure against"
                        >
                          {UNKNOWN}
                        </span>
                      ) : (
                        <div className="flex flex-col items-start gap-0.5">
                          <StatusBadge tone={LEAD_TIME_VERDICT_TONE[verdict]}>
                            {LEAD_TIME_VERDICT_LABEL[verdict]}
                          </StatusBadge>
                          <span
                            className="text-[10px] text-muted-foreground"
                            title={`${c.daysElapsed ?? UNKNOWN} days elapsed (PO line raised to ${c.receivedAt ? "receipt" : "the reference date"}) against a ${c.leadTimeDays}-day planned delivery time`}
                          >
                            {beyondLeadTime
                              ? `+${c.daysOverLeadTime}d over ${c.leadTimeDays}d`
                              : `${c.leadTimeDays}d planned`}
                          </span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={DECLARATION_STATUS_TONE[c.declarationStatus]}>
                        {c.declarationStatus}
                      </StatusBadge>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/repairable-spares/repair-register/${c.id}`}
                        className={buttonVariants({ variant: "ghost", size: "xs" })}
                      >
                        View
                        <ChevronRight className="size-3.5" />
                      </Link>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

/** One register dropdown: an "all" choice followed by the given options. */
function FilterSelect({
  value,
  onChange,
  allLabel,
  options,
  className,
}: {
  value: string
  onChange: (value: string) => void
  allLabel: string
  options: { value: string; label: string }[]
  className?: string
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v ?? ALL)}>
      <SelectTrigger className={cn("h-9 w-full", className)}>
        <SelectValue placeholder={allLabel}>
          {(selected: string) =>
            selected === ALL
              ? allLabel
              : options.find((o) => o.value === selected)?.label ?? selected
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
