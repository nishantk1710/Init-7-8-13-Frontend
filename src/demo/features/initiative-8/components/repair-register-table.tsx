"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState, type KeyboardEvent, type MouseEvent } from "react"
import { Download } from "lucide-react"

import { ClearFiltersButton } from "@demo/components/shared/clear-filters-button"
import { FilterBar } from "@demo/components/shared/filter-bar"
import { MaterialIdentity } from "@demo/components/shared/material-identity"
import { SAPDocumentChip } from "@demo/components/shared/sap-document-chip"
import { StatusBadge } from "@demo/components/shared/status-badge"
import { Button } from "@demo/components/ui/button"
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
  REPAIR_PLANTS,
  REPAIR_STATUS_OPTIONS,
  REPAIR_VENDORS,
} from "@demo/features/initiative-8/data/repair-chains"
import { REGISTER_CHAINS } from "@demo/features/initiative-8/data/register"
import type { RepairChain } from "@demo/features/initiative-8/types/repair"
import {
  ALL,
  NO_REGISTER_FILTERS,
  REGISTER_CSV_HEADERS,
  filterRegister,
  registerRowsToCsv,
  type RegisterFilters,
} from "@demo/features/initiative-8/utils/register-view"
import {
  CRITICALITY_TONE,
  DECLARATION_STATUSES,
  DECLARATION_STATUS_TONE,
  AGING_BUCKETS,
  JUSTIFICATION_CELL_LABEL,
  JUSTIFICATION_CELL_NOTE,
  JUSTIFICATION_CELL_TONE,
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
  justificationCellOf,
  overdueStatusOf,
} from "@demo/features/initiative-8/utils/status"
import { cn, downloadCsv, formatCount } from "@demo/lib/utils"

/** The repair detail page for one register line. */
export function repairHref(chain: Pick<RepairChain, "id">): string {
  return `/repairable-spares/repair-register/${chain.id}`
}

/**
 * The Snapshot register: the same columns, filters and row behaviour as live,
 * over the fixture chains with their declarations and justifications joined on
 * (`data/register.ts`).
 *
 * The register: one row per repair PO line, and the one place to work on it.
 *
 * Since 08-Oct-2026 it also carries what the Declaration Queue and the
 * Justifications screen showed (who declared and when, and whether a new
 * purchase while the repair was out has a reason), and **the whole row opens
 * the repair** — there is no View button. The material name opens it too,
 * rather than the Material 360 drawer: two click targets in one row that go to
 * different places is how people land somewhere they did not mean to. Material
 * 360 is one click away on the detail page.
 *
 * Columns run from what a repair is doing now, through its declaration and
 * justification, to the reference columns (criticality, stock, SAP documents)
 * people read least.
 */
export function RepairRegisterTable() {
  const chains = REGISTER_CHAINS
  const router = useRouter()
  const [filters, setFilters] = useState<RegisterFilters>(NO_REGISTER_FILTERS)

  function setFilter(key: keyof RegisterFilters) {
    return (value: string) => setFilters((current) => ({ ...current, [key]: value }))
  }

  const filtered = useMemo(() => filterRegister(chains, filters), [chains, filters])

  function exportCsv() {
    downloadCsv("i08-repair-register.csv", REGISTER_CSV_HEADERS, registerRowsToCsv(filtered))
  }

  /**
   * A click anywhere on the row opens the repair.
   *
   * Clicks on the material link are left to the link, which already handles
   * them -- including ctrl/cmd-click and middle-click into a new tab, which a
   * row handler alone would lose. A click that ends a text selection is not a
   * request to navigate.
   */
  function openFromRow(event: MouseEvent<HTMLTableRowElement>, href: string) {
    // Only the primary and middle buttons; a right-click opens the menu.
    if (event.button !== 0 && event.button !== 1) return
    if ((event.target as HTMLElement).closest("a")) return
    if (window.getSelection()?.toString()) return
    if (event.metaKey || event.ctrlKey || event.button === 1) {
      window.open(href, "_blank", "noopener")
      return
    }
    router.push(href)
  }

  function openFromKeyboard(event: KeyboardEvent<HTMLTableRowElement>, href: string) {
    if (event.target !== event.currentTarget || event.key !== "Enter") return
    event.preventDefault()
    router.push(href)
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
        {/* The criticality column sits at the far end now, but FR-10 asks for
            the register to be filterable by criticality, so the filter stays. */}
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
                <TableHead>Vendor</TableHead>
                <TableHead className="text-right">Qty Under Repair</TableHead>
                <TableHead>Repair Status</TableHead>
                <TableHead>Expected Return</TableHead>
                <TableHead>Due Date Status</TableHead>
                <TableHead className="text-right">Days Open</TableHead>
                <TableHead>Lead Time</TableHead>
                <TableHead>Declaration Status</TableHead>
                <TableHead>Justification</TableHead>
                <TableHead>Criticality</TableHead>
                <TableHead className="text-right">SOH</TableHead>
                <TableHead className="text-right">ROP</TableHead>
                <TableHead>Repair PR</TableHead>
                <TableHead>Repair PO</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => {
                const href = repairHref(c)
                const overdue = overdueStatusOf(c)
                const beyondLeadTime = isBeyondLeadTime(c)
                const noLeadTime = hasNoLeadTime(c)
                // Only reached when noLeadTime is false, so the absent third
                // state never has to be represented as a verdict.
                const verdict: LeadTimeVerdict = beyondLeadTime
                  ? "BEYOND_LEAD_TIME"
                  : "WITHIN_LEAD_TIME"
                const justification = justificationCellOf(c)
                return (
                  <TableRow
                    key={c.id}
                    tabIndex={0}
                    aria-label={`Open repair ${c.id}`}
                    onClick={(event) => openFromRow(event, href)}
                    onAuxClick={(event) => openFromRow(event, href)}
                    onKeyDown={(event) => openFromKeyboard(event, href)}
                    className="cursor-pointer focus-visible:bg-muted/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                  >
                    <TableCell>
                      {/* A real link, so ctrl-click, middle-click and "copy
                          link" all work; the row forwards its clicks here. */}
                      <Link href={href} className="block hover:underline" tabIndex={-1}>
                        <MaterialIdentity material={c.material} />
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate text-muted-foreground">
                      {c.material.description}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{c.plant.name}</TableCell>
                    <TableCell className="max-w-[160px] truncate text-muted-foreground">
                      {c.vendor}
                    </TableCell>
                    <TableCell className="text-right text-foreground">{c.qtyUnderRepair}</TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1">
                        <StatusBadge tone={REPAIR_STATUS_TONE[c.repairStatus]}>
                          {c.repairStatus}
                        </StatusBadge>
                        {/* The one thing the old receipt-status column said that
                            this one does not. */}
                        {isPartiallyReceived(c) && (
                          <span className="text-[10px] italic text-warning">
                            partially received
                          </span>
                        )}
                        {/* Moved here from under the Repair PO, which is now the
                            last column: a blocked line must stay on screen.
                            Blocked, not deleted -- still a live line and still
                            counted, so it is flagged rather than hidden. */}
                        {c.poBlocked && (
                          <StatusBadge tone="danger" className="h-4 px-1.5 text-[10px]">
                            Blocked in SAP
                          </StatusBadge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{c.expectedReturn}</TableCell>
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
                        treatment as an unrated criticality, because a third
                        badge beside two verdicts reads as a third verdict. */}
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
                    {/* Who declared and when, under the status -- what the
                        Declaration Queue showed in two columns of its own. The
                        condition, the next action and the form are on the
                        detail page. */}
                    <TableCell>
                      <div className="flex flex-col items-start gap-0.5">
                        <StatusBadge tone={DECLARATION_STATUS_TONE[c.declarationStatus]}>
                          {c.declarationStatus}
                        </StatusBadge>
                        {c.declaredBy && (
                          <span className="whitespace-nowrap text-[10px] text-muted-foreground">
                            {c.declaredBy}
                            {c.declaredAt && ` · ${c.declaredAt}`}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    {/* FR-7 on this line. The full reason, who recorded it and
                        the session are on the detail page. */}
                    <TableCell>
                      {justification === "NONE" ? (
                        <span
                          className="text-xs text-muted-foreground"
                          title={JUSTIFICATION_CELL_NOTE.NONE}
                        >
                          {JUSTIFICATION_CELL_LABEL.NONE}
                        </span>
                      ) : (
                        <div
                          className="flex flex-col items-start gap-0.5"
                          title={JUSTIFICATION_CELL_NOTE[justification]}
                        >
                          <StatusBadge tone={JUSTIFICATION_CELL_TONE[justification]}>
                            {JUSTIFICATION_CELL_LABEL[justification]}
                          </StatusBadge>
                          <span className="max-w-[160px] truncate text-[10px] text-muted-foreground">
                            {justification === "RECORDED"
                              ? reasonLabel(c.justification?.entries[0]?.reasonCategory)
                              : purchasesLabel(c.justification?.unjustifiedPurchases.length ?? 0)}
                          </span>
                        </div>
                      )}
                    </TableCell>
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
                      {c.repairPO ? (
                        <SAPDocumentChip doc={c.repairPO} />
                      ) : (
                        <span className="text-xs text-muted-foreground">Not yet raised</span>
                      )}
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

/** A reason category as words: `URGENT_BREAKDOWN` -> "urgent breakdown". */
function reasonLabel(category: string | undefined): string {
  return category ? category.replace(/_/g, " ").toLowerCase() : "reason recorded"
}

function purchasesLabel(count: number): string {
  return count === 1 ? "1 new unit bought" : `${count} new units bought`
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
