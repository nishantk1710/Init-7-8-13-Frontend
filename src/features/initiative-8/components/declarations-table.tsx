"use client"

import { useMemo, useState } from "react"

import { ClearFiltersButton } from "@/components/shared/clear-filters-button"
import { FilterBar } from "@/components/shared/filter-bar"
import { MaterialIdentity } from "@/components/shared/material-identity"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
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
} from "@/features/initiative-8/types/repair"
import { REPAIR_STATUS_TONE } from "@/features/initiative-8/utils/status"
import { DeclarationFormDialog } from "@/features/initiative-8/components/declaration-form-dialog"
import { downloadCsv } from "@/lib/utils"
import { useMaterial360 } from "@/lib/material-360-context"

const ALL = "all"

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
  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (row.status === "Completed") return false
      if (plant !== ALL && row.plant?.plantId !== plant) return false
      return true
    })
  }, [rows, plant])

  function exportCsv() {
    downloadCsv(
      "i08-declaration-queue.csv",
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

  const activeFilters = plant !== ALL ? 1 : 0

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
        <Button size="sm" variant="outline" onClick={exportCsv}>
          Export CSV
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
        <Select value={plant} onValueChange={(v) => setPlant(v ?? ALL)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All plants">
              {(value: string) =>
                value === ALL
                  ? "All plants"
                  : (plants.find(([id]) => id === value)?.[1] ?? value)
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All plants</SelectItem>
            {plants.map(([id, name]) => (
              <SelectItem key={id} value={id}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <ClearFiltersButton
          activeCount={activeFilters}
          onClear={() => setPlant(ALL)}
        />
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
