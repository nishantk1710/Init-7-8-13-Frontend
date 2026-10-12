"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { Download } from "lucide-react"

import { ClearFiltersButton } from "@/components/shared/clear-filters-button"
import { FilterBar } from "@/components/shared/filter-bar"
import { MaterialIdentity } from "@/components/shared/material-identity"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { repairHref } from "@/features/initiative-8/components/repair-register-table"
import type { DeclarationRecord } from "@/features/initiative-8/types/repair"
import { CONDITIONS } from "@/features/initiative-8/utils/attestation"
import {
  DECLARATION_CONDITION_TONE,
  DECLARATION_CSV_HEADERS,
  DECLARATION_LINKS,
  DECLARATION_LINK_LABEL,
  DECLARATION_LINK_NOTE,
  DECLARATION_LINK_TONE,
  NO_DECLARATION_FILTERS,
  declarationLinkOf,
  declarationRowsToCsv,
  faultCategoryLabel,
  filterDeclarations,
  type DeclarationLogFilters,
} from "@/features/initiative-8/utils/declaration-log"
import { ALL } from "@/features/initiative-8/utils/register-view"
import { formatApiDateTime } from "@/lib/api/format"
import { cn, downloadCsv, formatCount } from "@/lib/utils"

/**
 * Every condition-to-repair declaration ever recorded (FR-4), newest first.
 *
 * Including the ones the register can never show: a part assessed Beyond
 * Economical Repair or Scrap gets no repair PO, so it has no register line,
 * and a part declared ahead of its repair PO has none yet. Amended
 * declarations stay listed — they are the audit trail — and say what replaced
 * them.
 *
 * Read-only. Declaring happens through the "Declare a part" button above it.
 */
export function DeclarationLogTable({
  records,
  plantOptions,
}: {
  records: DeclarationRecord[]
  plantOptions: { plantId: string; name: string }[]
}) {
  const [filters, setFilters] = useState<DeclarationLogFilters>(NO_DECLARATION_FILTERS)

  function setFilter(key: keyof DeclarationLogFilters) {
    return (value: string) => setFilters((current) => ({ ...current, [key]: value }))
  }

  const filtered = useMemo(() => filterDeclarations(records, filters), [records, filters])
  const activeFilters =
    [filters.plant, filters.condition, filters.link].filter((v) => v !== ALL).length +
    (filters.search.trim() ? 1 : 0)

  function exportCsv() {
    // The filtered rows, all of them: the file is the view it came from.
    downloadCsv("i08-declarations.csv", DECLARATION_CSV_HEADERS, declarationRowsToCsv(filtered))
  }

  return (
    <div className="flex flex-col gap-4">
      <FilterBar>
        <Input
          value={filters.search}
          onChange={(e) => setFilter("search")(e.target.value)}
          placeholder="Search material or description"
          className="h-9 w-full sm:w-64"
          aria-label="Search material or description"
        />
        <FilterSelect
          value={filters.plant}
          onChange={setFilter("plant")}
          allLabel="All plants"
          options={plantOptions.map((p) => ({ value: p.plantId, label: p.name }))}
          className="sm:w-48"
        />
        <FilterSelect
          value={filters.condition}
          onChange={setFilter("condition")}
          allLabel="All conditions"
          options={CONDITIONS.map((c) => ({ value: c, label: c }))}
          className="sm:w-52"
        />
        <FilterSelect
          value={filters.link}
          onChange={setFilter("link")}
          allLabel="Any repair line status"
          options={DECLARATION_LINKS.map((l) => ({ value: l, label: DECLARATION_LINK_LABEL[l] }))}
          className="sm:w-52"
        />
        <ClearFiltersButton
          activeCount={activeFilters}
          onClear={() => setFilters(NO_DECLARATION_FILTERS)}
        />

        <div className="flex items-center gap-3 sm:ml-auto">
          <span className="text-xs text-muted-foreground">
            {formatCount(filtered.length)} of {formatCount(records.length)} declarations
          </span>
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download className="size-3.5" />
            Export CSV
          </Button>
        </div>
      </FilterBar>

      {records.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No declarations have been recorded yet. Use “Declare a part” when a repairable part
          comes off the machine.
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No declarations match these filters.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Declared</TableHead>
                <TableHead>Material</TableHead>
                <TableHead>Plant</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead>Condition</TableHead>
                <TableHead>Fault Category</TableHead>
                <TableHead>Condition Description</TableHead>
                <TableHead>Serial</TableHead>
                <TableHead>Repair Line</TableHead>
                <TableHead>Declaration</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => {
                const link = declarationLinkOf(r)
                return (
                  <TableRow key={r.id} className={cn(link === "AMENDED" && "opacity-60")}>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="whitespace-nowrap text-foreground">
                          {formatApiDateTime(r.declaredAt)}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{r.declaredBy}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <MaterialIdentity material={r.material} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{r.plant.name}</TableCell>
                    <TableCell className="text-right text-foreground">{r.quantity}</TableCell>
                    <TableCell>
                      <StatusBadge tone={DECLARATION_CONDITION_TONE[r.condition] ?? "default"}>
                        {r.condition}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {faultCategoryLabel(r.faultCategory)}
                    </TableCell>
                    <TableCell
                      className="max-w-[260px] truncate text-muted-foreground"
                      title={r.conditionDescription}
                    >
                      {r.conditionDescription}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{r.serialNumber ?? "—"}</TableCell>
                    <TableCell>
                      <div
                        className="flex flex-col items-start gap-0.5"
                        title={DECLARATION_LINK_NOTE[link]}
                      >
                        <StatusBadge tone={DECLARATION_LINK_TONE[link]}>
                          {DECLARATION_LINK_LABEL[link]}
                        </StatusBadge>
                        {r.repairLineIds.map((id) => (
                          <Link
                            key={id}
                            href={repairHref({ id })}
                            className="text-[10px] text-muted-foreground hover:underline"
                          >
                            {id}
                          </Link>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="whitespace-nowrap text-xs text-foreground">{r.id}</span>
                        {r.supersededBy && (
                          <span className="whitespace-nowrap text-[10px] text-muted-foreground">
                            replaced by {r.supersededBy}
                          </span>
                        )}
                        {r.supersedes && (
                          <span className="whitespace-nowrap text-[10px] text-muted-foreground">
                            amends {r.supersedes}
                          </span>
                        )}
                      </div>
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

/** One dropdown: an "all" choice followed by the given options. */
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
