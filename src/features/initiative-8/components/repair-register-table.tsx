"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { ChevronRight, Download } from "lucide-react"

import { ClearFiltersButton } from "@/components/shared/clear-filters-button"
import { FilterBar } from "@/components/shared/filter-bar"
import { MaterialIdentity } from "@/components/shared/material-identity"
import { SAPDocumentChip } from "@/components/shared/sap-document-chip"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button, buttonVariants } from "@/components/ui/button"
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
import type { RepairChain, RepairStatus } from "@/features/initiative-8/types/repair"
import {
  ALL,
  NO_REGISTER_FILTERS,
  REGISTER_CSV_HEADERS,
  filterRegister,
  registerRowsToCsv,
  type RegisterFilters,
} from "@/features/initiative-8/utils/register-view"
import {
  CRITICALITY_TONE,
  DECLARATION_STATUSES,
  DECLARATION_STATUS_TONE,
  DEFAULT_AGING_BUCKETS,
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
  orUnknown,
  overdueStatusOf,
  vendorLabel,
} from "@/features/initiative-8/utils/status"
import { useMaterial360 } from "@/lib/material-360-context"
import { cn, downloadCsv, formatCount } from "@/lib/utils"

/** A plant the filter can offer. Structurally `PlantReference`, but the live
 *  plants come from the data rather than from `lib/shared-data/plants`, whose
 *  ids (PLANT-GBG) do not exist in the backend (1300). */
type PlantOption = { plantId: string; name: string }

export type RepairRegisterTableProps = {
  /** The rows to render — always from the backend. There is no fixture
   *  fallback: an empty array means the register really is empty, and a
   *  failure is reported through `loadError` instead. */
  chains?: RepairChain[]
  plantOptions?: PlantOption[]
  vendorOptions?: string[]
  /** The repair statuses present in the data (`LiveRegister.repairStatusOptions`),
   *  not every status the type allows. */
  repairStatusOptions?: RepairStatus[]
  /** Criticality ratings present in the data, plus "Not recorded" when any
   *  line is unrated. */
  criticalityOptions?: string[]
  /** The active aging bands, from `LiveRegister.agingBands` in live mode.
   *  Defaults to the fixed bands the fixtures were written against. */
  agingBands?: string[]
  /**
   * Set when the rows could not be loaded.
   *
   * Rendered as a visible failure, never as an empty table. "No repairs match
   * these filters" and "the server could not be reached" are different
   * statements, and showing the second as the first is how a broken demo looks
   * like a clean answer.
   */
  loadError?: string | null
}

export function RepairRegisterTable({
  chains = [],
  plantOptions = [],
  vendorOptions = [],
  repairStatusOptions = [],
  criticalityOptions = [],
  agingBands = DEFAULT_AGING_BUCKETS,
  loadError = null,
}: RepairRegisterTableProps = {}) {
  const { openMaterial360 } = useMaterial360()
  const [filters, setFilters] = useState<RegisterFilters>(NO_REGISTER_FILTERS)

  function setFilter(key: keyof RegisterFilters) {
    return (value: string) => setFilters((current) => ({ ...current, [key]: value }))
  }

  // The same client-side filter over the full array the table has always done.
  // ~1,200 rows is comfortably small enough for that, so the backend's
  // server-side filter parameters can wait.
  const filtered = useMemo(() => filterRegister(chains, filters), [chains, filters])

  function exportCsv() {
    // Every row the filters match, not a page of them -- and nothing the
    // filters exclude. The file is the view it came from.
    downloadCsv("i08-repair-register.csv", REGISTER_CSV_HEADERS, registerRowsToCsv(filtered))
  }

  if (loadError) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-destructive/40 bg-destructive/5 p-8 text-center text-sm"
      >
        <p className="font-medium text-foreground">The repair register could not be loaded.</p>
        <p className="mt-1 text-muted-foreground">{loadError}</p>
        <p className="mt-3 text-xs text-muted-foreground">
          This is not an empty register — it is a failed request. Check that the
          backend is running and that NEXT_PUBLIC_API_BASE_URL points at it.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <FilterBar>
        <FilterSelect
          value={filters.plant}
          onChange={setFilter("plant")}
          allLabel="All plants"
          options={plantOptions.map((p) => ({ value: p.plantId, label: p.name }))}
          className="sm:w-44"
        />
        <FilterSelect
          value={filters.vendor}
          onChange={setFilter("vendor")}
          allLabel="All vendors"
          options={vendorOptions.map((v) => ({ value: v, label: v }))}
          className="sm:w-52"
        />
        <FilterSelect
          value={filters.repairStatus}
          onChange={setFilter("repairStatus")}
          allLabel="All repair statuses"
          options={repairStatusOptions.map((s) => ({ value: s, label: s }))}
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
          options={criticalityOptions.map((c) => ({ value: c, label: c }))}
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
          options={agingBands.map((b) => ({ value: b, label: `${b} days` }))}
          className="sm:w-40"
        />
        <ClearFiltersButton
          activeCount={Object.values(filters).filter((v) => v !== ALL).length}
          onClear={() => setFilters(NO_REGISTER_FILTERS)}
        />

        <div className="flex items-center gap-3 sm:ml-auto">
          <span className="text-xs text-muted-foreground">
            {formatCount(filtered.length)} of {formatCount(chains.length)} lines
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
                // Only reached when noLeadTime is false, so the absent third
                // state never has to be represented as a verdict.
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
                    {/* Unrated is "not recorded", never NORMAL -- a dash, with
                        the reason on hover. */}
                    <TableCell>
                      {c.criticality ? (
                        <StatusBadge tone={CRITICALITY_TONE[c.criticality] ?? "default"}>
                          {c.criticality}
                        </StatusBadge>
                      ) : (
                        <span
                          className="text-xs text-muted-foreground"
                          title="No criticality rating is recorded for this material in ZMM065"
                        >
                          {UNKNOWN}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-foreground">
                      {orUnknown(c.stockOnHand)}
                    </TableCell>
                    {/* Undefined for every Gamsberg material -- the July MARC
                        extract has rows for plant 1300 only. A dash, never a 0. */}
                    <TableCell className="text-right text-muted-foreground">
                      {orUnknown(c.reorderPoint)}
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
                        {/* Blocked, not deleted: still a live line and still
                            counted, so it is flagged here rather than hidden. */}
                        {c.poBlocked && (
                          <StatusBadge tone="danger" className="h-4 px-1.5 text-[10px]">
                            Blocked in SAP
                          </StatusBadge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[160px] truncate text-muted-foreground">
                      {vendorLabel(c)}
                    </TableCell>
                    <TableCell className="text-right text-foreground">{c.qtyUnderRepair}</TableCell>
                    <TableCell>
                      <StatusBadge tone={REPAIR_STATUS_TONE[c.repairStatus]}>
                        {c.repairStatus}
                      </StatusBadge>
                      {/* The one thing the old receipt-status column said that
                          this one does not. */}
                      {isPartiallyReceived(c) && (
                        <span className="block text-[10px] italic text-warning">
                          partially received
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.expectedReturn ?? UNKNOWN}
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={OVERDUE_STATUS_TONE[overdue]}>
                        {OVERDUE_STATUS_LABEL[overdue]}
                      </StatusBadge>
                    </TableCell>
                    {/* Plain number, no verdict -- the lead-time mark has its
                        own column. Days open runs from the PO line date to the
                        receipt, or to the reference date while the unit is
                        still out, so a closed line reads its turnaround and
                        never a "200" beside a "within the 21-day planned time"
                        verdict. */}
                    <TableCell className="text-right text-foreground">{c.daysOpen}</TableCell>
                    {/* The lead-time verdict: a second, independent signal, not
                        a fallback for Due Date Status -- see LeadTimeStatus.
                        A badge where there is a verdict, a muted dash where
                        there is none. NO_LEAD_TIME is the absence of a
                        benchmark (no MARC.PLIFZ for this material at this
                        plant, which is every Gamsberg line) and gets the same
                        treatment as an unrated criticality above, because a
                        third badge beside two verdicts reads as a third
                        verdict. */}
                    <TableCell>
                      {noLeadTime ? (
                        <span
                          className="text-xs text-muted-foreground"
                          title="No planned delivery time (MARC.PLIFZ) is maintained for this material at this plant, so there is nothing to measure against"
                        >
                          {UNKNOWN}
                        </span>
                      ) : (
                        <div className="flex flex-col items-start gap-0.5">
                          <StatusBadge tone={LEAD_TIME_VERDICT_TONE[verdict]}>
                            {LEAD_TIME_VERDICT_LABEL[verdict]}
                          </StatusBadge>
                          {/* The evidence, because "Beyond" on its own is a
                              verdict without a number. Cites days elapsed
                              rather than days open: that is what the check
                              ran on. */}
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
