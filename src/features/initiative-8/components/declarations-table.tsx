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
import {
  DECLARATION_STATUSES,
  DECLARATION_STATUS_TONE,
} from "@/features/initiative-8/utils/status"
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

  const [status, setStatus] = useState<string>(ALL)
  const [plant, setPlant] = useState<string>(ALL)
  const [outstandingOnly, setOutstandingOnly] = useState(false)

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

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (status !== ALL && row.status !== status) return false
      if (plant !== ALL && row.plant?.plantId !== plant) return false
      if (outstandingOnly && row.status === "Completed") return false
      return true
    })
  }, [rows, status, plant, outstandingOnly])

  function exportCsv() {
    downloadCsv(
      "i08-declaration-queue.csv",
      [
        "Material",
        "Description",
        "Plant",
        "Repair Line",
        "Requisition",
        "Requester Code",
        "Status",
        "Condition",
        "Declared By",
        "Declared At",
        "Next Action",
      ],
      filtered.map((row) => [
        row.material.materialCode,
        row.material.description ?? "",
        row.plant?.name ?? row.plant?.plantId ?? "",
        row.relatedRepairId,
        row.purchaseRequisition ?? "",
        row.requester ?? "",
        row.status,
        row.condition ?? "",
        row.declaredBy ?? "",
        row.declaredAt ?? "",
        row.nextAction,
      ])
    )
  }

  const activeFilters = [status !== ALL, plant !== ALL, outstandingOnly].filter(
    Boolean
  ).length

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
          partial queue, not an empty one — narrow by plant or status to see the
          rest.
        </div>
      )}

      <FilterBar>
        <Select value={status} onValueChange={(v) => setStatus(v ?? ALL)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All statuses">
              {(value: string) => (value === ALL ? "All statuses" : value)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {DECLARATION_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

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

        <Select
          value={outstandingOnly ? "yes" : ALL}
          onValueChange={(v) => setOutstandingOnly(v === "yes")}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All declarations">
              {(value: string) =>
                value === "yes" ? "Outstanding only" : "All declarations"
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All declarations</SelectItem>
            <SelectItem value="yes">Outstanding only</SelectItem>
          </SelectContent>
        </Select>

        <ClearFiltersButton
          activeCount={activeFilters}
          onClear={() => {
            setStatus(ALL)
            setPlant(ALL)
            setOutstandingOnly(false)
          }}
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
                <TableHead>Repair Line</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Condition</TableHead>
                <TableHead>Declared By</TableHead>
                <TableHead>Declared At</TableHead>
                <TableHead>Next Action</TableHead>
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
                  <TableCell className="text-muted-foreground">
                    {row.relatedRepairId}
                    {row.hasActiveRepair && (
                      <StatusBadge tone="warning" className="ml-2">
                        Open
                      </StatusBadge>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={DECLARATION_STATUS_TONE[row.status]}>
                      {row.status}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.condition ?? "—"}
                  </TableCell>
                  {/* No sign-in exists, so this is whatever the server stamped
                      -- UNAUTHENTICATED_LOCAL_USER on every row written so far
                      (audit §11.3). Shown as recorded rather than prettied up. */}
                  <TableCell className="text-muted-foreground">
                    {row.declaredBy ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.declaredAt ?? "—"}
                  </TableCell>
                  <TableCell
                    className="max-w-[320px] truncate text-muted-foreground"
                    title={row.nextAction}
                  >
                    {row.nextAction}
                  </TableCell>
                  {/* Declare it from here. The form used to live only on the
                      repair detail page, which meant working this queue was a
                      round trip per row: open the repair, declare, come back,
                      find your place again. */}
                  <TableCell className="text-right">
                    {row.status !== "Completed" && (
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
                    )}
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
