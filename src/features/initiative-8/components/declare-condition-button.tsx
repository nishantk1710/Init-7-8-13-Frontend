"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { DeclarationCondition, RepairChain } from "@/features/initiative-8/types/repair"
import {
  CONDITIONS,
  RECOMMENDATION,
  defaultAttestationQuantity,
  parseAttestationQuantity,
} from "@/features/initiative-8/utils/attestation"
import { ApiError } from "@/lib/api/client"
import { createAttestation } from "@/lib/api/i8"

/**
 * The condition-to-repair attestation form (FR-4) — the only write in I08.
 *
 * It lived on the Declaration Queue until 08-Oct-2026. That screen was the
 * register's own lines with different columns, so it was folded into the
 * register, and the form moved here, to the repair detail page: the page that
 * shows the evidence somebody should read before declaring. Same fields, same
 * POST, same messages.
 */
export function DeclareConditionButton({
  chain,
  faultCategories,
}: {
  chain: RepairChain
  /**
   * The configured fault-category list, served by the API. Never hard-coded
   * here: it is VZI's vocabulary and it will change, and the backend
   * validates against the same list it serves.
   */
  faultCategories: string[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [condition, setCondition] = useState<DeclarationCondition>("Repairable")
  const [description, setDescription] = useState("")
  const [faultCategory, setFaultCategory] = useState(faultCategories[0] ?? "")
  // Kept as the typed string so a half-typed "1." is not reformatted under the
  // cursor; parsed once, for the button and the POST.
  const [quantity, setQuantity] = useState("1")
  const [serialNumber, setSerialNumber] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const parsedQuantity = parseAttestationQuantity(quantity)

  // The live adapter spells a line with no plant as "—". An attestation is per
  // material and plant, so it cannot be recorded against one.
  const plant = chain.plant.plantId !== "—" ? chain.plant.plantId : undefined

  function openForm() {
    setCondition("Repairable")
    setDescription("")
    setFaultCategory(faultCategories[0] ?? "")
    setQuantity(defaultAttestationQuantity(chain.qtyUnderRepair))
    setSerialNumber("")
    setOpen(true)
  }

  /**
   * POST the attestation.
   *
   * Three things this deliberately does NOT do.
   *
   * **It does not optimistically mark the line Completed.** The status is
   * computed by the backend from a material + plant + date-window match, and a
   * successful POST very often does NOT move it: the attestation is stamped
   * with the server clock, and every line in the July-2026 extract was raised
   * months earlier, outside the window. Showing "Completed" anyway would be the
   * UI asserting something the API has just told us is false.
   *
   * **It does not hide that.** `coverageNote` on the response explains, in
   * words written to be shown to a person, what the write achieved and why the
   * status may not have moved. It goes in the toast rather than being
   * swallowed, because a silent no-op is exactly what makes the next person
   * widen the matching window until the screen stops looking broken.
   *
   * **It does not say "Simulated, not yet written to SAP".** The attestation IS
   * written, to a table the platform owns; it is not written to SAP.
   */
  async function declare() {
    if (!plant) {
      toast.error("Cannot declare this line", {
        description:
          "The repair line carries no plant, and an attestation is recorded per material and plant.",
      })
      return
    }
    if (parsedQuantity === undefined) return

    setSubmitting(true)
    try {
      const created = await createAttestation({
        materialId: chain.material.materialId,
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
      setOpen(false)
      // Re-read from the server so the page shows the truth rather than a
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

  return (
    <>
      <Button size="sm" variant="outline" onClick={openForm}>
        Declare condition
      </Button>

      <Dialog open={open} onOpenChange={(next) => !next && setOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Declare condition</DialogTitle>
            <DialogDescription>
              {`${chain.material.materialId} — ${chain.material.description} (repair ${chain.id})`}
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
            {faultCategories.length === 0 && (
              <p className="text-[11px] text-destructive">
                The fault-category list could not be loaded, so nothing can be recorded. Reload
                the page to try again.
              </p>
            )}
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
                  : chain.qtyUnderRepair > 0
                    ? `${chain.qtyUnderRepair} under repair on this line.`
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
            <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
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
    </>
  )
}
