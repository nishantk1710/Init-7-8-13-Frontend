"use client"

import { useRouter } from "next/navigation"
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
import { Input } from "@/components/ui/input"
import { parseAttestationQuantity } from "@/features/initiative-8/data/live-declarations"
import type { DeclarationCondition, DeclarationItem, DeclarationStatus } from "@/features/initiative-8/types/repair"
import { DECLARATION_STATUS_TONE } from "@/features/initiative-8/utils/status"
import { ApiError } from "@/lib/api/client"
import { createAttestation } from "@/lib/api/i8"
import { useMaterial360 } from "@/lib/material-360-context"

const ALL = "all"
const STATUSES: DeclarationStatus[] = ["Required", "Pending", "Completed", "Flagged"]
const CONDITIONS: DeclarationCondition[] = ["Repairable", "Beyond Economical Repair", "Scrap"]

/** The UI's condition wording -> the API's recommendation enum. */
const RECOMMENDATION: Record<
  DeclarationCondition,
  "REPAIRABLE" | "BEYOND_ECONOMICAL_REPAIR" | "SCRAP"
> = {
  Repairable: "REPAIRABLE",
  "Beyond Economical Repair": "BEYOND_ECONOMICAL_REPAIR",
  Scrap: "SCRAP",
}

export type DeclarationQueueTableProps = {
  /** Rows to render — always from the backend. No fixture fallback: an empty
   *  queue is a real answer, and a failure is reported through `loadError`. */
  items?: DeclarationItem[]
  /**
   * The configured fault-category list, served by the API alongside the data.
   * Never hard-coded here: it is VZI's vocabulary and it will change, and the
   * backend validates against the same list it serves.
   */
  faultCategories?: string[]
  /** Set when the rows could not be loaded. Rendered as a visible failure,
   *  never as an empty queue -- "nothing to declare" is the most misleading
   *  possible way to report a failed request on this screen. */
  loadError?: string | null
}

export function DeclarationQueueTable({
  items = [],
  faultCategories = [],
  loadError = null,
}: DeclarationQueueTableProps = {}) {
  const router = useRouter()
  const { openMaterial360 } = useMaterial360()
  const [status, setStatus] = useState<DeclarationStatus | typeof ALL>(ALL)
  const [dialogFor, setDialogFor] = useState<string | null>(null)
  const [condition, setCondition] = useState<DeclarationCondition>("Repairable")
  // The two fields the real attestation form needs beyond the condition.
  // Collected only under `live`, because only there do they go anywhere.
  const [description, setDescription] = useState("")
  const [faultCategory, setFaultCategory] = useState(faultCategories[0] ?? "")
  // Kept as the typed string so a half-typed "1." is not reformatted under the
  // cursor; parsed once, for the button and the POST.
  const [quantity, setQuantity] = useState("1")
  const [serialNumber, setSerialNumber] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const parsedQuantity = parseAttestationQuantity(quantity)

  // The rows ARE the server's answer: the declaration status is computed from
  // the attestation table, and after a write router.refresh() re-runs the
  // server component and hands down fresh props. Rendering those directly is
  // both simpler and more honest than mirroring them into state -- a local
  // copy could only ever drift from, or briefly contradict, the backend's own
  // answer.
  const filtered = useMemo(
    () => items.filter((r) => status === ALL || r.status === status),
    [items, status]
  )

  const activeRow = items.find((r) => r.id === dialogFor) ?? null

  function openDialog(row: DeclarationItem) {
    setCondition("Repairable")
    setDescription("")
    setFaultCategory(faultCategories[0] ?? "")
    // What the register says is still out on this line; 1 when it does not
    // know, or the unit is already back.
    setQuantity(String(row.quantityUnderRepair ?? 1))
    setSerialNumber("")
    setDialogFor(row.id)
  }

  /**
   * POST the attestation. The only write in I08.
   *
   * Three things this deliberately does NOT do.
   *
   * **It does not optimistically mark the row Completed.** The status is
   * computed by the backend from a material + plant + date-window match, and a
   * successful POST very often does NOT move it: the attestation is stamped
   * with the server clock, and every line in this July-2026 extract was raised
   * months earlier, outside the window. Showing "Completed" anyway would be the
   * UI asserting something the API has just told us is false.
   *
   * **It does not hide that.** `coverageNote` on the response explains, in
   * words written to be shown to a person, what the write achieved and why the
   * queue may not have moved. It goes in the toast rather than being swallowed,
   * because a silent no-op is exactly what makes the next person widen the
   * matching window until the screen stops looking broken.
   *
   * **It does not say "Simulated, not yet written to SAP".** The first half is
   * false -- the attestation IS written, to a table the platform owns. The
   * second half is still true and still worth saying, so the message says
   * precisely that instead.
   */
  async function declare() {
    if (!activeRow) return

    const plant = activeRow.plant?.plantId
    if (!plant) {
      // An attestation is per material-plant. Recording one against a guessed
      // plant would put a site on an audit record that never named one.
      toast.error("Cannot declare this row", {
        description:
          "The queue row carries no plant, and an attestation is recorded per material and plant.",
      })
      return
    }

    if (parsedQuantity === undefined) return

    setSubmitting(true)
    try {
      const created = await createAttestation({
        materialId: activeRow.material.materialId,
        plant,
        quantity: parsedQuantity,
        conditionDescription: description.trim(),
        faultCategory,
        recommendation: RECOMMENDATION[condition],
        // Optional, and omitted rather than sent blank: an empty string on an
        // audit record reads as "the serial number is empty".
        serialNumber: serialNumber.trim() || undefined,
      })

      // The API's own words about what the write covered.
      toast.success(`Attestation ${created.id} recorded`, {
        description: created.coverageNote ?? undefined,
        duration: 12000,
      })
      setDialogFor(null)
      // Re-read from the server so the queue shows the truth rather than a
      // guess. The status is the backend's to compute, not ours to assume.
      router.refresh()
    } catch (error) {
      // The backend's own sentence -- "8000004665 is not in the repairable
      // universe", "plant must be 1300 or 1500" -- rather than "POST … failed
      // with 422", which tells the person nothing they can act on.
      const message =
        error instanceof ApiError
          ? error.detailText()
          : error instanceof Error
            ? error.message
            : String(error)
      toast.error("The attestation was not recorded", { description: message, duration: 12000 })
    } finally {
      setSubmitting(false)
    }
  }

  if (loadError) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-destructive/40 bg-destructive/5 p-8 text-center text-sm"
      >
        <p className="font-medium text-foreground">The declaration queue could not be loaded.</p>
        <p className="mt-1 text-muted-foreground">{loadError}</p>
        <p className="mt-3 text-xs text-muted-foreground">
          This is not an empty queue — it is a failed request. Check that the
          backend is running and that NEXT_PUBLIC_API_BASE_URL points at it.
        </p>
      </div>
    )
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
                  {/* Null on every live row: the SAP table that would decide
                      Manual vs MRP-generated covers 521 of 1,201 repair
                      requisitions and every one reads "created from an order",
                      which is neither. Shown as unknown rather than guessed. */}
                  <TableCell>
                    {r.source === "Manual" || r.source === "MRP-generated" ? (
                      <StatusBadge tone={r.source === "MRP-generated" ? "warning" : "default"}>
                        {r.source}
                      </StatusBadge>
                    ) : (
                      <span className="text-xs text-muted-foreground">{r.source}</span>
                    )}
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
                {faultCategories.map((c) => (
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
            <Button variant="outline" onClick={() => setDialogFor(null)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              onClick={() => void declare()}
              // The backend rejects a blank description or an unknown fault
              // category with a 422. Disabling here means the user is told
              // before the round trip rather than after it.
              disabled={
                submitting ||
                description.trim() === "" ||
                faultCategory === "" ||
                parsedQuantity === undefined
              }
            >
              {submitting ? "Recording…" : "Confirm declaration"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
