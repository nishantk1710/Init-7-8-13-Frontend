"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { ChevronRight, Download } from "lucide-react"

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
import type {
  DeclarationStatus,
  RepairChain,
  RepairStatus,
} from "@/features/initiative-8/types/repair"
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
  DECLARATION_STATUS_TONE,
  DEFAULT_AGING_BUCKETS,
  OVERDUE_STATUSES,
  OVERDUE_STATUS_LABEL,
  OVERDUE_STATUS_TONE,
  RECEIPT_STATUS_TONE,
  REPAIR_STATUS_TONE,
  UNKNOWN,
  hasNoLeadTime,
  isBeyondLeadTime,
  orUnknown,
  overdueStatusOf,
  vendorLabel,
} from "@/features/initiative-8/utils/status"
import { useMaterial360 } from "@/lib/material-360-context"
import { cn, downloadCsv, formatCount } from "@/lib/utils"

const DECLARATION_STATUSES: DeclarationStatus[] = ["Required", "Pending", "Completed", "Flagged"]

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
                <TableHead>Receipt Status</TableHead>
                <TableHead>Declaration Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => {
                const overdue = overdueStatusOf(c)
                const beyondLeadTime = isBeyondLeadTime(c)
                const noLeadTime = hasNoLeadTime(c)
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
                    {/* Undefined for every Gamsberg material -- MARC covers plants
                        1300 and 1200 only. A dash, never a 0. */}
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
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.expectedReturn ?? UNKNOWN}
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={OVERDUE_STATUS_TONE[overdue]}>
                        {OVERDUE_STATUS_LABEL[overdue]}
                      </StatusBadge>
                    </TableCell>
                    {/* The lead-time highlight. Days open stays the number on
                        show -- the ruling was to keep the aging and mark it when
                        it runs past the material's planned delivery time, not to
                        replace it with a verdict. The cell says by how much and
                        against what, because "90" in red is an accusation
                        without evidence. With no planned time to measure
                        against, the number is muted and says so: "not known"
                        must not read the same as "within". */}
                    <TableCell
                      className={cn(
                        "text-right",
                        beyondLeadTime
                          ? "font-medium text-warning"
                          : noLeadTime
                            ? "text-muted-foreground"
                            : "text-foreground"
                      )}
                      title={
                        beyondLeadTime
                          ? `${c.daysOverLeadTime} days past the ${c.leadTimeDays}-day planned delivery time for this material`
                          : noLeadTime
                            ? "No planned delivery time is maintained for this material at this plant, so there is nothing to measure against"
                            : `Within the ${c.leadTimeDays}-day planned delivery time for this material`
                      }
                    >
                      {c.daysOpen}
                      {noLeadTime && (
                        <span className="block text-[10px] italic">no lead time</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={RECEIPT_STATUS_TONE[c.receiptStatus]}>
                        {c.receiptStatus}
                      </StatusBadge>
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
