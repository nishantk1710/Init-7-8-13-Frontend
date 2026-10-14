"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { Download, Lock, PencilLine } from "lucide-react"

import { ClearFiltersButton } from "@demo/components/shared/clear-filters-button"
import { FilterBar } from "@demo/components/shared/filter-bar"
import { MaterialIdentity } from "@demo/components/shared/material-identity"
import { StatusBadge } from "@demo/components/shared/status-badge"
import { Button } from "@demo/components/ui/button"
import { Input } from "@demo/components/ui/input"
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
import { DeclarationFormDialog } from "@demo/features/initiative-8/components/declaration-form-dialog"
import { I8_PLANTS } from "@demo/features/initiative-8/data/config"
import { ALL } from "@demo/features/initiative-8/model/metrics"
import type { DeclarationRecord, RepairChain } from "@demo/features/initiative-8/types/repair"
import {
  DECLARATION_CSV_HEADERS,
  DECLARATION_LINKS,
  DECLARATION_LINK_LABEL,
  DECLARATION_LINK_NOTE,
  DECLARATION_LINK_TONE,
  NO_DECLARATION_FILTERS,
  declarationLinkOf,
  declarationRowsToCsv,
  filterDeclarations,
  type DeclarationLogFilters,
} from "@demo/features/initiative-8/utils/declaration-log"
import {
  DECLARATION_CONDITIONS,
  DECLARATION_CONDITION_TONE,
  UNKNOWN,
  codeLabel,
} from "@demo/features/initiative-8/utils/status"
import { useMaterial360 } from "@demo/lib/material-360-context"
import { cn, downloadExcel, formatCount } from "@demo/lib/utils"

/** The repair detail page for a line. */
function lineHref(id: string): string {
  return `/repairable-spares/repair-register/${encodeURIComponent(id)}`
}

/**
 * Every condition-to-repair declaration ever recorded (FR-4), newest first.
 *
 * Including the ones the register can never show: a part assessed Beyond
 * Economical Repair or Scrap gets no repair PO, so it has no register line,
 * and a part declared ahead of its repair PO has none yet. Amended
 * declarations stay listed — they are the audit trail — dimmed, locked, and
 * saying what replaced them.
 *
 * A declaration in force can be amended from its row. That never edits it:
 * the dialog records a new declaration that supersedes it, with the reason.
 */
export function DeclarationLogTable({
  records,
  lines,
}: {
  records: DeclarationRecord[]
  /** The register's lines, so each declaration can say where its line stands. */
  lines: RepairChain[]
}) {
  const { openMaterial360 } = useMaterial360()
  const [filters, setFilters] = useState<DeclarationLogFilters>(NO_DECLARATION_FILTERS)
  const [amending, setAmending] = useState<DeclarationRecord | undefined>(undefined)
  // A fresh form for every opening — see DeclarationFormDialog.
  const [formKey, setFormKey] = useState(0)

  const linesById = useMemo(() => new Map(lines.map((l) => [l.id, l])), [lines])
  const filtered = useMemo(
    () => filterDeclarations(records, filters, linesById),
    [records, filters, linesById],
  )

  function setFilter(key: keyof DeclarationLogFilters) {
    return (value: string) => setFilters((current) => ({ ...current, [key]: value }))
  }

  const activeFilters =
    [filters.plant, filters.condition, filters.link].filter((v) => v !== ALL).length +
    (filters.search.trim() ? 1 : 0)

  function exportExcel() {
    // The filtered rows, all of them: the file is the view it came from.
    downloadExcel("i08-declarations.xlsx", DECLARATION_CSV_HEADERS, declarationRowsToCsv(filtered, linesById))
  }

  function openAmend(record: DeclarationRecord) {
    setFormKey((k) => k + 1)
    setAmending(record)
  }

  return (
    <div className="flex flex-col gap-4">
      <FilterBar>
        <Input
          value={filters.search}
          onChange={(e) => setFilter("search")(e.target.value)}
          placeholder="Search material, declaration, line or session"
          className="h-9 w-full sm:w-72"
          aria-label="Search material, declaration, repair line or session"
        />
        <FilterSelect
          value={filters.plant}
          onChange={setFilter("plant")}
          allLabel="All plants"
          options={I8_PLANTS.map((p) => ({ value: p.plantId, label: p.name }))}
          className="sm:w-48"
        />
        <FilterSelect
          value={filters.condition}
          onChange={setFilter("condition")}
          allLabel="All conditions"
          options={DECLARATION_CONDITIONS.map((c) => ({ value: c, label: c }))}
          className="sm:w-52"
        />
        <FilterSelect
          value={filters.link}
          onChange={setFilter("link")}
          allLabel="Any repair line status"
          options={DECLARATION_LINKS.map((l) => ({ value: l, label: DECLARATION_LINK_LABEL[l] }))}
          className="sm:w-52"
        />
        <ClearFiltersButton activeCount={activeFilters} onClear={() => setFilters(NO_DECLARATION_FILTERS)} />

        <div className="flex items-center gap-3 sm:ml-auto">
          <span className="text-xs text-muted-foreground">
            {formatCount(filtered.length)} of {formatCount(records.length)} declarations
          </span>
          <Button size="sm" variant="outline" onClick={exportExcel} disabled={filtered.length === 0}>
            <Download className="size-3.5" />
            Export Excel
          </Button>
        </div>
      </FilterBar>

      {records.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No declarations have been recorded yet. Use “Declare a part” when a repairable part comes off
          the machine.
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
                <TableHead>Session</TableHead>
                <TableHead>Declaration</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Action</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => {
                const link = declarationLinkOf(r, linesById)
                const amended = link === "AMENDED"
                return (
                  <TableRow key={r.id} className={cn("align-top", amended && "opacity-60")}>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="whitespace-nowrap text-foreground">{r.declaredAt}</span>
                        <span className="text-[10px] text-muted-foreground">{r.declaredBy}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <MaterialIdentity material={r.material} onOpen={openMaterial360} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{r.plant.name}</TableCell>
                    <TableCell className="text-right text-foreground">{formatCount(r.quantity)}</TableCell>
                    <TableCell>
                      <StatusBadge tone={DECLARATION_CONDITION_TONE[r.condition]}>{r.condition}</StatusBadge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {codeLabel(r.faultCategory)}
                    </TableCell>
                    <TableCell className="max-w-[260px] truncate text-muted-foreground" title={r.conditionDescription}>
                      {r.conditionDescription}
                      {r.evidenceReference && (
                        <span className="block truncate text-[10px]" title={r.evidenceReference}>
                          Evidence: {r.evidenceReference}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {r.serialNumber ?? UNKNOWN}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-0.5" title={DECLARATION_LINK_NOTE[link]}>
                        <StatusBadge tone={DECLARATION_LINK_TONE[link]}>{DECLARATION_LINK_LABEL[link]}</StatusBadge>
                        {r.repairLineIds.map((id) => (
                          <Link
                            key={id}
                            href={lineHref(id)}
                            className="text-[10px] text-muted-foreground hover:underline"
                          >
                            {id}
                          </Link>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-[11px] text-muted-foreground">
                      {r.sessionId ?? UNKNOWN}
                    </TableCell>
                    <TableCell>
                      <div className="flex max-w-[240px] flex-col gap-0.5">
                        <span className="whitespace-nowrap text-xs text-foreground">{r.id}</span>
                        {r.supersededBy && (
                          <span className="whitespace-nowrap text-[10px] text-muted-foreground">
                            replaced by {r.supersededBy}
                          </span>
                        )}
                        {r.supersedes && (
                          <span
                            className="line-clamp-2 text-[10px] text-muted-foreground"
                            title={r.amendmentReason}
                          >
                            amends {r.supersedes}
                            {r.amendmentReason ? ` — ${r.amendmentReason}` : ""}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {amended ? (
                        <span
                          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"
                          title={`Locked — superseded by ${r.supersededBy}. Kept unchanged as the audit trail.`}
                        >
                          <Lock className="size-3" />
                          Locked
                        </span>
                      ) : (
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => openAmend(r)}
                          title="Record an amendment that supersedes this declaration"
                        >
                          <PencilLine />
                          Amend
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {amending && (
        <DeclarationFormDialog
          key={formKey}
          open
          amend={amending}
          onClose={() => setAmending(undefined)}
        />
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
            selected === ALL ? allLabel : (options.find((o) => o.value === selected)?.label ?? selected)
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
