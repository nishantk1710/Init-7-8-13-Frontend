"use client"

import { useMemo, useState } from "react"

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
import type {
  DeclarationQueueRow,
  DeclarationQueueSummary,
  RepairStatus,
} from "@/features/initiative-8/types/repair"
import { REPAIR_STATUS_TONE } from "@/features/initiative-8/utils/status"
import { DeclarationFormDialog } from "@/features/initiative-8/components/declaration-form-dialog"
import { cn, downloadExcel, formatCount } from "@/lib/utils"
import { useMaterial360 } from "@/lib/material-360-context"

const ALL = "all"

/**
 * The repair lifecycle, in order, so the status filter offers PR Raised before
 * Closed rather than in whatever order the rows happened to arrive. Taken from
 * the tone map so there is one list of repair statuses in this module, not two.
 */
const REPAIR_STATUS_ORDER = Object.keys(REPAIR_STATUS_TONE) as RepairStatus[]

export type DeclarationsTableProps = {
  rows: DeclarationQueueRow[]
  summary: DeclarationQueueSummary
  /** Set when the page loop stopped before reading every row. */
  truncated?: boolean
  /**
   * The attestation form's fault categories, so a line can be declared from
   * this row rather than by navigating to the repair and back.
   *
   * Empty when that fetch failed: the form then says so and cannot submit,
   * which is better than offering a list it invented.
   */
  faultCategories?: string[]
}

export function DeclarationsTable({
  rows,
  summary,
  truncated = false,
  faultCategories = [],
}: DeclarationsTableProps) {
  const { openMaterial360 } = useMaterial360()
  const [declaring, setDeclaring] = useState<DeclarationQueueRow | null>(null)
  // A fresh form per opening, so a half-typed description cannot reappear
  // against a different part.
  const [formKey, setFormKey] = useState(0)

  const [plant, setPlant] = useState<string>(ALL)
  // Where the REPAIR stands, not the declaration: every row here is
  // undeclared, and a part still at the vendor is a different kind of
  // outstanding from one already back on the shelf.
  const [repairStatus, setRepairStatus] = useState<string>(ALL)
  const [vendor, setVendor] = useState<string>(ALL)
  const [search, setSearch] = useState("")

  // FR-10 asks for a plant filter on every screen, and the register is the
  // only one that had one. Built from the rows rather than hard-coded: the
  // plant scope is a backend setting (1300 and 1500 today) and a list typed
  // out here would be a second place to change it.
  const plants = useMemo(() => {
    const seen = new Map<string, string>()
    for (const row of rows) {
      if (row.plant) seen.set(row.plant.plantId, row.plant.name ?? row.plant.plantId)
    }
    return [...seen.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [rows])

  // Only the statuses the queue actually holds, for the same reason the plant
  // list is built from the rows: a filter offering a value that matches
  // nothing reads as a broken filter.
  const repairStatuses = useMemo(() => {
    const seen = new Set(rows.map((row) => row.repairStatus).filter(Boolean) as RepairStatus[])
    return REPAIR_STATUS_ORDER.filter((status) => seen.has(status))
  }, [rows])

  // Name when LFA1 gave one, else the code -- whatever the row carries. Rows
  // with neither (no PO header on the repair line) match no vendor and drop
  // out once one is picked, which is the honest answer: the vendor is not
  // known from this data rather than being some other vendor.
  const vendors = useMemo(() => {
    const seen = new Set(rows.map((row) => row.vendor).filter(Boolean) as string[])
    return [...seen].sort((a, b) => a.localeCompare(b))
  }, [rows])

  // Outstanding only, and not as a default somebody can switch off.
  //
  // The heading above this table says "still owed a declaration", and since
  // 13-Oct the columns carry no declaration status at all. A Completed row
  // would be indistinguishable from an undeclared one and would still offer a
  // "Declare condition" button, which is why this is a scope rather than a
  // filter.
  //
  // "Outstanding" is the backend's own test -- Required or Flagged, anything
  // not Completed -- so this table and the "Repair lines undeclared" tile
  // above it count the same rows. A Flagged line was declared NOT repairable
  // and sent for repair anyway; it still wants somebody's attention, and the
  // tile already counts it.
  const scoped = useMemo(() => rows.filter((row) => row.status !== "Completed"), [rows])

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return scoped.filter((row) => {
      if (plant !== ALL && row.plant?.plantId !== plant) return false
      if (repairStatus !== ALL && row.repairStatus !== repairStatus) return false
      if (vendor !== ALL && row.vendor !== vendor) return false
      // Material code and description because that is what somebody is
      // holding a part number for; repair line and requisition because that
      // is what somebody arrives from a spreadsheet with.
      if (
        needle &&
        ![
          row.material.materialCode,
          row.material.description,
          row.relatedRepairId,
          row.purchaseRequisition,
        ]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(needle))
      ) {
        return false
      }
      return true
    })
  }, [scoped, plant, repairStatus, vendor, search])

  function exportExcel() {
    downloadExcel(
      "i08-declaration-queue.xlsx",
      // Wider than the table on purpose, the same way the register's export
      // is: the screen is for working the queue, the file is for somebody
      // slicing it in Excel, and the repair line and requisition are what
      // they need to join it to anything else.
      [
        "Material",
        "Description",
        "Plant",
        "Vendor",
        "Repair Status",
        "Repair Line",
        "Requisition",
        "Requester Code",
        "Declaration Status",
        "Raised",
      ],
      filtered.map((row) => [
        row.material.materialCode,
        row.material.description ?? "",
        row.plant?.name ?? row.plant?.plantId ?? "",
        row.vendor ?? "",
        row.repairStatus ?? "",
        row.relatedRepairId,
        row.purchaseRequisition ?? "",
        row.requester ?? "",
        row.status,
        row.createdAt ?? "",
      ])
    )
  }

  const activeFilters =
    [plant, repairStatus, vendor].filter((v) => v !== ALL).length +
    (search.trim() === "" ? 0 : 1)

  function clearFilters() {
    setPlant(ALL)
    setRepairStatus(ALL)
    setVendor(ALL)
    setSearch("")
  }

  return (
    <div className="flex flex-col gap-4">
      {/* The counts are over the whole queue, never over the filtered view:
          "how much of the register is undeclared" must not change because
          somebody looked at one plant. */}
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground">
          <strong className="text-foreground">{summary.outstanding}</strong> of{" "}
          {summary.total} repair lines are waiting on a condition declaration.{" "}
          {summary.byStatus.Flagged ? (
            <>
              <strong className="text-foreground">{summary.byStatus.Flagged}</strong>{" "}
              flagged.{" "}
            </>
          ) : null}
          <span className="text-xs">
            Matched within ±{summary.attestationWindowDays} days of the repair line.
          </span>
        </div>
        <Button size="sm" variant="outline" onClick={exportExcel}>
          Export Excel
        </Button>
      </div>

      {truncated && (
        <div
          role="alert"
          className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-foreground"
        >
          Showing the first {rows.length} of {summary.total} rows. This is a
          partial queue, not an empty one — narrow by plant to see the rest.
        </div>
      )}

      <FilterBar>
        <FilterSelect
          value={plant}
          onChange={setPlant}
          allLabel="All plants"
          options={plants.map(([id, name]) => ({ value: id, label: name }))}
          className="sm:w-44"
        />
        <FilterSelect
          value={repairStatus}
          onChange={setRepairStatus}
          allLabel="All repair statuses"
          options={repairStatuses.map((s) => ({ value: s, label: s }))}
          className="sm:w-44"
        />
        <FilterSelect
          value={vendor}
          onChange={setVendor}
          allLabel="All vendors"
          options={vendors.map((v) => ({ value: v, label: v }))}
          className="sm:w-52"
        />

        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search material, repair line, PR…"
          aria-label="Search the declaration queue"
          className="h-9 w-full sm:w-64"
        />

        <ClearFiltersButton activeCount={activeFilters} onClear={clearFilters} />

        {/* How much of the queue is in front of you. The counts in the band
            above are over the whole queue on purpose, so without this a
            filtered view gives no number at all. */}
        <span className="text-xs text-muted-foreground sm:ml-auto">
          {formatCount(filtered.length)} of {formatCount(scoped.length)} rows
        </span>
      </FilterBar>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No declarations match these filters.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead>Plant</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Repair Status</TableHead>
                <TableHead>Raised</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Action</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <MaterialIdentity
                      material={row.material}
                      onOpen={openMaterial360}
                    />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.plant?.name ?? row.plant?.plantId ?? "—"}
                  </TableCell>
                  {/* Name when LFA1 gave one, else the code, else neither.
                      455 repair lines carry no PO header, so "not known from
                      this data" is a real answer and gets said. */}
                  <TableCell className="max-w-[180px] truncate text-muted-foreground">
                    {row.vendor ?? "—"}
                  </TableCell>
                  {/* The REPAIR's status, not the declaration's. Whether the
                      part is still out changes how urgent an undeclared line
                      is, and every row here is undeclared by definition. */}
                  <TableCell>
                    {row.repairStatus ? (
                      <StatusBadge tone={REPAIR_STATUS_TONE[row.repairStatus]}>
                        {row.repairStatus}
                      </StatusBadge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.createdAt ?? "—"}
                  </TableCell>
                  {/* Declare it from here. The form used to live only on the
                      repair detail page, which meant working this queue was a
                      round trip per row: open the repair, declare, come back,
                      find your place again. */}
                  <TableCell className="text-right">
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => {
                        setFormKey((k) => k + 1)
                        setDeclaring(row)
                      }}
                    >
                      Declare condition
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {declaring && (
        <DeclarationFormDialog
          key={formKey}
          open
          onClose={() => setDeclaring(null)}
          target={{
            materialId: declaring.material.materialId,
            plantId: declaring.plant?.plantId,
            label: `${declaring.material.materialCode} - ${declaring.material.description} at ${declaring.plant?.name ?? "an unknown plant"} (repair ${declaring.relatedRepairId})`,
            defaultQuantity: "1",
            // FR-4's link to the repair PO. Working a queue row declares THAT
            // line, so it is named outright rather than left to a date window
            // that these lines are far too old to satisfy.
            repairDocument: declaring.repairPO?.documentNumber,
            repairItem: declaring.repairPO?.line,
          }}
          faultCategories={faultCategories}
        />
      )}
    </div>
  )
}

/**
 * One filter dropdown, with "all" as a first-class option rather than an empty
 * value.
 *
 * A near-copy of the register's control of the same name. It is copied rather
 * than imported because that one is private to `repair-register-table.tsx`,
 * and lifting it out would put this change into a file it otherwise has no
 * business in -- the two should be merged into `components/shared/` the next
 * time either is touched for its own sake.
 */
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
              : (options.find((o) => o.value === selected)?.label ?? selected)
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
