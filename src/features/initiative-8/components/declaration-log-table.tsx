"use client"

import { useMemo, useState } from "react"

import { ClearFiltersButton } from "@/components/shared/clear-filters-button"
import { FilterBar } from "@/components/shared/filter-bar"
import { MaterialIdentity } from "@/components/shared/material-identity"
import { StatusBadge } from "@/components/shared/status-badge"
import { TablePagination } from "@/components/shared/table-pagination"
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
import type { DeclarationLogRow } from "@/features/initiative-8/data/live-declarations"
import { usePaginatedRows } from "@/hooks/use-paginated-rows"
import { cn, downloadExcel } from "@/lib/utils"

/** The "no filter" value every dropdown here uses. */
const ALL = "all"
import { useMaterial360 } from "@/lib/material-360-context"

/**
 * What was actually declared — the other half of FR-4.
 *
 * The queue beside this answers "who still owes a declaration". This answers
 * "what was judged, by whom, on what", and it is the only place the FR-4
 * fields the queue has no room for are visible: quantity, fault category, the
 * condition description somebody typed, and the optional serial.
 *
 * ## Superseded rows are shown, not hidden
 *
 * An attestation is never edited or deleted — the database blocks both. A
 * correction is a NEW row pointing at the one it replaces, and the original
 * stays readable forever, because the chain IS the audit trail. Hiding the
 * amended row would leave a chain with a link missing, so both are listed and
 * the superseded one is marked.
 *
 * ## There is no Amend button
 *
 * There was one until 13-Oct-2026; it was removed on request. The API still
 * accepts `supersedes`, and existing chains still render — this screen simply
 * does not offer the action. Worth knowing before telling anyone a
 * declaration can be corrected: through the UI, it currently cannot.
 */
export type DeclarationLogTableProps = {
  rows: DeclarationLogRow[]
}

export function DeclarationLogTable({ rows: allRows }: DeclarationLogTableProps) {
  const { openMaterial360 } = useMaterial360()
  const [search, setSearch] = useState("")
  const [condition, setCondition] = useState<string>(ALL)
  const [plant, setPlant] = useState<string>(ALL)
  // Superseded rows are part of the audit trail and are listed by default.
  // Hiding them is a reading aid, never the default, because a chain with a
  // link quietly missing is worse than a longer list.
  const [inForceOnly, setInForceOnly] = useState(false)

  const conditions = useMemo(
    () => [...new Set(allRows.map((r) => r.condition).filter(Boolean))].sort(),
    [allRows],
  )
  const plants = useMemo(() => {
    const seen = new Map<string, string>()
    for (const r of allRows) {
      if (r.plant) seen.set(r.plant.plantId, r.plant.name ?? r.plant.plantId)
    }
    return [...seen.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [allRows])

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return allRows.filter((r) => {
      if (condition !== ALL && r.condition !== condition) return false
      if (plant !== ALL && r.plant?.plantId !== plant) return false
      if (inForceOnly && r.supersededBy) return false
      if (
        needle &&
        ![r.id, r.material.materialCode, r.material.description, r.conditionDescription, r.attestor, r.serialNumber, r.faultCategory]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(needle))
      ) {
        return false
      }
      return true
    })
  }, [allRows, search, condition, plant, inForceOnly])

  const { paged, page, pageSize, total, setPage } = usePaginatedRows(rows, {
    resetKey: [search, condition, plant, inForceOnly].join("|"),
  })

  const activeFilters = [
    search.trim() !== "",
    condition !== ALL,
    plant !== ALL,
    inForceOnly,
  ].filter(Boolean).length

  function exportExcel() {
    downloadExcel(
      "i08-declaration-log.xlsx",
      [
        "Declared At",
        "Material",
        "Description",
        "Plant",
        "Qty",
        "Condition",
        "Fault Category",
        "Condition Description",
        "Serial",
        "Declared By",
        "Declaration",
        "Amendment",
        "Superseded By",
      ],
      rows.map((r) => [
        r.attestedAt ?? "",
        r.material.materialCode,
        r.material.description ?? "",
        r.plant?.name ?? r.plant?.plantId ?? "",
        r.quantity,
        r.condition,
        r.faultCategory,
        r.conditionDescription,
        r.serialNumber ?? "",
        r.attestor,
        r.id,
        r.isAmendment ? "Yes" : "No",
        r.supersededBy ?? "",
      ])
    )
  }

  if (allRows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        No condition declarations have been recorded yet. Use &ldquo;Declare a
        part&rdquo; above, or the form on any repair line&rsquo;s detail page.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <FilterBar>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search material, declaration, description or serial"
          aria-label="Search declarations"
          className="h-9 w-full sm:w-80"
        />
        <LogSelect
          value={condition}
          onChange={setCondition}
          allLabel="All conditions"
          options={conditions.map((c) => ({ value: c, label: c }))}
          className="sm:w-56"
        />
        <LogSelect
          value={plant}
          onChange={setPlant}
          allLabel="All plants"
          options={plants.map(([id, name]) => ({ value: id, label: name }))}
          className="sm:w-44"
        />
        <LogSelect
          value={inForceOnly ? "yes" : ALL}
          onChange={(v) => setInForceOnly(v === "yes")}
          allLabel="Including superseded"
          options={[{ value: "yes", label: "In force only" }]}
          className="sm:w-52"
        />
        <ClearFiltersButton
          activeCount={activeFilters}
          onClear={() => {
            setSearch("")
            setCondition(ALL)
            setPlant(ALL)
            setInForceOnly(false)
          }}
        />
        <div className="flex items-center gap-3 sm:ml-auto">
          <span className="text-xs text-muted-foreground">
            {rows.length}
            {rows.length === allRows.length ? "" : ` of ${allRows.length}`} shown
          </span>
          <Button size="sm" variant="outline" onClick={exportExcel} disabled={rows.length === 0}>
            Export Excel
          </Button>
        </div>
      </FilterBar>

      <p className="text-xs text-muted-foreground">
        A record here is never edited or deleted. Where one was corrected, the
        correction is a new row pointing at the one it replaced and both stay
        listed &mdash; which is why a superseded row is marked rather than
        removed.
      </p>

      {rows.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No declarations match these filters.
        </div>
      )}

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
              <TableHead>Declared By</TableHead>
              <TableHead>Declaration</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.map((r) => (
              <TableRow
                key={r.id}
                className={r.supersededBy ? "opacity-60" : undefined}
              >
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {r.attestedAt ?? "—"}
                  <div className="flex flex-wrap gap-1">
                    {r.isAmendment && (
                      <StatusBadge tone="default">Amendment</StatusBadge>
                    )}
                    {r.supersededBy && (
                      <StatusBadge tone="warning">Superseded</StatusBadge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <MaterialIdentity
                    material={r.material}
                    onOpen={openMaterial360}
                  />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {r.plant?.name ?? r.plant?.plantId ?? "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums text-foreground">
                  {r.quantity}
                </TableCell>
                <TableCell className="text-foreground">{r.condition}</TableCell>
                <TableCell className="text-muted-foreground">
                  {r.faultCategory}
                </TableCell>
                <TableCell
                  className="max-w-[320px] truncate text-muted-foreground"
                  title={r.conditionDescription}
                >
                  {r.conditionDescription}
                </TableCell>
                {/* Optional, and optional on purpose: I08 works at
                    material-plant grain today and serial grain is where it is
                    going. Capturing it when somebody knows it costs nothing
                    now and is unrecoverable later. */}
                <TableCell className="text-muted-foreground">
                  {r.serialNumber ?? "—"}
                </TableCell>
                {/* There is no sign-in, so this is whatever the server
                    stamped. Shown as recorded rather than prettied up: a
                    placeholder that looks like a name is worse than one that
                    looks like a placeholder. */}
                <TableCell className="text-muted-foreground">
                  {r.attestor}
                </TableCell>
                {/* The id, because an amendment chain is read by following
                    one: a superseded row names what replaced it. */}
                <TableCell className="whitespace-nowrap font-mono text-[11px] text-muted-foreground">
                  {r.id}
                  {r.supersededBy && (
                    <div className="text-[10px]">superseded by {r.supersededBy}</div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <TablePagination
        page={page}
        pageSize={pageSize}
        total={total}
        count={paged.length}
        noun="declarations"
        onPageChange={setPage}
      />
    </div>
  )
}

/** One log dropdown: an "all" choice followed by the given options. */
function LogSelect({
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
