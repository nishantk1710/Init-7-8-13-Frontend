"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"

import { FilterBar } from "@/components/shared/filter-bar"
import { MaterialIdentity } from "@/components/shared/material-identity"
import { SAPDocumentChip } from "@/components/shared/sap-document-chip"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { DECLARATIONS } from "@/features/initiative-8/data/declarations"
import type { DeclarationCondition, DeclarationItem, DeclarationStatus } from "@/features/initiative-8/types/repair"
import { DECLARATION_STATUS_TONE } from "@/features/initiative-8/utils/status"
import { useMaterial360 } from "@/lib/material-360-context"

const ALL = "all"
const STATUSES: DeclarationStatus[] = ["Required", "Pending", "Completed", "Flagged"]
const CONDITIONS: DeclarationCondition[] = ["Repairable", "Beyond Economical Repair", "Scrap"]
const TODAY = "3 Sep 2026"

export function DeclarationQueueTable() {
  const { openMaterial360 } = useMaterial360()
  const [rows, setRows] = useState<DeclarationItem[]>(DECLARATIONS)
  const [status, setStatus] = useState<DeclarationStatus | typeof ALL>(ALL)
  const [dialogFor, setDialogFor] = useState<string | null>(null)
  const [condition, setCondition] = useState<DeclarationCondition>("Repairable")

  const filtered = useMemo(
    () => rows.filter((r) => status === ALL || r.status === status),
    [rows, status]
  )

  const activeRow = rows.find((r) => r.id === dialogFor) ?? null

  function openDialog(id: string) {
    setCondition("Repairable")
    setDialogFor(id)
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
              declaredAt: TODAY,
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
    toast.success(`Declared ${activeRow.material.materialId} as "${condition}" — Simulated, not yet written to SAP.`)
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
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
                <TableHead>Source</TableHead>
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
                  <TableCell>
                    <StatusBadge tone={r.source === "MRP-generated" ? "warning" : "default"}>
                      {r.source}
                    </StatusBadge>
                  </TableCell>
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
                      <Button size="xs" variant="outline" onClick={() => openDialog(r.id)}>
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogFor(null)}>
              Cancel
            </Button>
            <Button onClick={confirmDeclaration}>Confirm declaration</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
