"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"

import { ClearFiltersButton } from "@demo/components/shared/clear-filters-button"
import { FilterBar } from "@demo/components/shared/filter-bar"
import { MaterialIdentity } from "@demo/components/shared/material-identity"
import { SAPDocumentChip } from "@demo/components/shared/sap-document-chip"
import { StatusBadge } from "@demo/components/shared/status-badge"
import { Button } from "@demo/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@demo/components/ui/dialog"
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
import { DECLARATIONS, FAULT_CATEGORIES } from "@demo/features/initiative-8/data/declarations"
import { REFERENCE_DATE } from "@demo/features/initiative-8/data/repair-chains"
import type { DeclarationCondition, DeclarationItem, DeclarationStatus } from "@demo/features/initiative-8/types/repair"
import { DECLARATION_STATUSES, DECLARATION_STATUS_TONE } from "@demo/features/initiative-8/utils/status"
import { useMaterial360 } from "@demo/lib/material-360-context"

const ALL = "all"
const CONDITIONS: DeclarationCondition[] = ["Repairable", "Beyond Economical Repair", "Scrap"]

/** The quantity field as a positive number, or undefined so the button can say no. */
function parseQuantity(input: string): number | undefined {
  const trimmed = input.trim()
  if (trimmed === "") return undefined
  const value = Number(trimmed)
  return Number.isFinite(value) && value > 0 ? value : undefined
}

export function DeclarationQueueTable() {
  const { openMaterial360 } = useMaterial360()
  const [rows, setRows] = useState<DeclarationItem[]>(DECLARATIONS)
  const [status, setStatus] = useState<DeclarationStatus | typeof ALL>(ALL)
  const [dialogFor, setDialogFor] = useState<string | null>(null)
  const [condition, setCondition] = useState<DeclarationCondition>("Repairable")
  const [description, setDescription] = useState("")
  const [faultCategory, setFaultCategory] = useState(FAULT_CATEGORIES[0])
  const [quantity, setQuantity] = useState("1")
  const [serialNumber, setSerialNumber] = useState("")
  const parsedQuantity = parseQuantity(quantity)

  const filtered = useMemo(
    () => rows.filter((r) => status === ALL || r.status === status),
    [rows, status]
  )

  const activeRow = rows.find((r) => r.id === dialogFor) ?? null

  function openDialog(row: DeclarationItem) {
    setCondition("Repairable")
    setDescription("")
    setFaultCategory(FAULT_CATEGORIES[0])
    setQuantity(String(row.quantityUnderRepair ?? 1))
    setSerialNumber("")
    setDialogFor(row.id)
  }

  function confirmDeclaration() {
    if (!activeRow) return
    setRows((prev) =>
      prev.map((r) =>
        r.id === activeRow.id
          ? {
              ...r,
              status: "Completed" as const,
              condition,
              declaredBy: "You",
              declaredAt: REFERENCE_DATE,
              nextAction:
                condition === "Repairable"
                  ? "None — condition declared, PR may proceed."
                  : condition === "Beyond Economical Repair"
                    ? "Route to new-unit procurement — repair not economical."
                    : "Route to disposal — unit declared scrap.",
            }
          : r
      )
    )
    toast.success(`Declared ${activeRow.material.materialId} as "${condition}" — not posted to SAP.`)
    setDialogFor(null)
  }

  return (
    <div className="flex flex-col gap-4">
      <FilterBar>
        <Select value={status} onValueChange={(v) => setStatus(v as DeclarationStatus | typeof ALL)}>
          <SelectTrigger className="h-9 w-full sm:w-48">
            <SelectValue placeholder="Declaration status">
              {(value: string) => (value === ALL ? "All declaration statuses" : value)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All declaration statuses</SelectItem>
            {DECLARATION_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <ClearFiltersButton activeCount={status === ALL ? 0 : 1} onClear={() => setStatus(ALL)} />
      </FilterBar>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No declarations match this filter.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PR</TableHead>
                <TableHead>Material</TableHead>
                <TableHead>Requester</TableHead>
                <TableHead>Active Repair?</TableHead>
                <TableHead>Declaration Status</TableHead>
                <TableHead>Declared By</TableHead>
                <TableHead>Declared At</TableHead>
                <TableHead>Next Action</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <SAPDocumentChip doc={r.pr} />
                  </TableCell>
                  <TableCell>
                    <MaterialIdentity material={r.material} onOpen={openMaterial360} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{r.requester}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.hasActiveRepair ? "Yes" : "No"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={DECLARATION_STATUS_TONE[r.status]}>{r.status}</StatusBadge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{r.declaredBy ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{r.declaredAt ?? "—"}</TableCell>
                  <TableCell className="max-w-[240px] truncate text-muted-foreground" title={r.nextAction}>
                    {r.nextAction}
                  </TableCell>
                  <TableCell>
                    {r.status !== "Completed" ? (
                      <Button size="xs" variant="outline" onClick={() => openDialog(r)}>
                        Declare condition
                      </Button>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">Declared</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogFor !== null} onOpenChange={(open) => !open && setDialogFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Declare condition</DialogTitle>
            <DialogDescription>
              {activeRow
                ? `${activeRow.material.materialId} — ${activeRow.material.description} (${activeRow.pr.documentNumber})`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground">Condition</label>
            <Select value={condition} onValueChange={(v) => setCondition(v as DeclarationCondition)}>
              <SelectTrigger className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONDITIONS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground" htmlFor="fault-category">
              Fault category
            </label>
            <Select value={faultCategory} onValueChange={(v) => setFaultCategory(v ?? "")}>
              <SelectTrigger id="fault-category" className="h-9 w-full">
                <SelectValue placeholder="Select a fault category" />
              </SelectTrigger>
              <SelectContent>
                {FAULT_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c.replace(/_/g, " ").toLowerCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground" htmlFor="condition-description">
              Condition description
            </label>
            <textarea
              id="condition-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is wrong with it, and what did you measure?"
              className="w-full rounded-md border border-border bg-background p-2 text-sm"
            />
            <p className="text-[11px] text-muted-foreground">
              Required. This is the part a human reads — it is recorded as an
              audit record and cannot be edited afterwards, only superseded.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground" htmlFor="attestation-quantity">
                Quantity
              </label>
              <Input
                id="attestation-quantity"
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                aria-invalid={parsedQuantity === undefined}
              />
              <p className="text-[11px] text-muted-foreground">
                {parsedQuantity === undefined
                  ? "Must be greater than 0."
                  : activeRow?.quantityUnderRepair !== undefined
                    ? `${activeRow.quantityUnderRepair} under repair on this line.`
                    : "Units assessed."}
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground" htmlFor="attestation-serial">
                Serial number <span className="italic">(optional)</span>
              </label>
              <Input
                id="attestation-serial"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                placeholder="As stamped on the unit"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogFor(null)}>
              Cancel
            </Button>
            <Button
              onClick={confirmDeclaration}
              disabled={
                description.trim() === "" || faultCategory === "" || parsedQuantity === undefined
              }
            >
              Confirm declaration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
