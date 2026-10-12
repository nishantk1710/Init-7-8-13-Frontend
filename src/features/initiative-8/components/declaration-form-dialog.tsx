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
import type { DeclarationCondition } from "@/features/initiative-8/types/repair"
import {
  CONDITIONS,
  RECOMMENDATION,
  parseAttestationQuantity,
} from "@/features/initiative-8/utils/attestation"
import { faultCategoryLabel } from "@/features/initiative-8/utils/declaration-log"
import { ApiError } from "@/lib/api/client"
import { createAttestation, getUniverseMaterial, toNumber } from "@/lib/api/i8"
import { formatCount } from "@/lib/utils"

/** A part the form is fixed to -- a repair line's material and plant. */
export type DeclarationTarget = {
  materialId: string
  plantId: string
  /** The line under the title, saying which part this is. */
  label: string
  defaultQuantity: string
  /** Under the quantity field, e.g. "2 under repair on this line." */
  quantityHint?: string
}

type PlantOption = { plantId: string; name: string }

/** What the material lookup found, for the line under the material field. */
type Lookup =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "found"; text: string }
  | { state: "error"; text: string }

/**
 * The condition-to-repair declaration form (FR-4) — the only write in I08.
 *
 * Two ways in, one form:
 *
 *   **From the part** (`target` absent) — the Declarations screen. The person
 *   types the material and picks the plant, because the FRS has the part
 *   declared when it comes off the machine, before any repair PO exists.
 *
 *   **From a repair line** (`target` set) — the repair detail page, for a line
 *   that went out undeclared. Material and plant are the line's.
 *
 * Mount it fresh for each opening (a new `key`), so a second declaration never
 * starts from the first one's half-typed fields.
 */
export function DeclarationFormDialog({
  open,
  onClose,
  faultCategories,
  target,
  plantOptions = [],
}: {
  open: boolean
  onClose: () => void
  /**
   * The configured fault-category list, served by the API. Never hard-coded
   * here: it is VZI's vocabulary and it will change, and the backend
   * validates against the same list it serves.
   */
  faultCategories: string[]
  target?: DeclarationTarget
  /** The plants the form offers when it is not fixed to a repair line. */
  plantOptions?: PlantOption[]
}) {
  const router = useRouter()
  const [materialId, setMaterialId] = useState("")
  const [plant, setPlant] = useState(plantOptions[0]?.plantId ?? "")
  const [lookup, setLookup] = useState<Lookup>({ state: "idle" })
  const [condition, setCondition] = useState<DeclarationCondition>("Repairable")
  const [description, setDescription] = useState("")
  const [faultCategory, setFaultCategory] = useState(faultCategories[0] ?? "")
  // Kept as the typed string so a half-typed "1." is not reformatted under the
  // cursor; parsed once, for the button and the POST.
  const [quantity, setQuantity] = useState(target?.defaultQuantity ?? "1")
  const [serialNumber, setSerialNumber] = useState("")
  const [evidence, setEvidence] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const parsedQuantity = parseAttestationQuantity(quantity)

  const part = target
    ? { materialId: target.materialId, plantId: target.plantId }
    : { materialId: materialId.trim(), plantId: plant }

  /**
   * Says which part was typed, before anything is recorded.
   *
   * A courtesy, not a gate: the backend refuses a material that is not
   * 80-series or not in the repairable universe, and its sentence is what the
   * person sees if they submit anyway. A failed lookup never blocks the form.
   */
  async function lookUp(plantId: string = plant) {
    const wanted = materialId.trim()
    if (!wanted) {
      setLookup({ state: "idle" })
      return
    }
    setLookup({ state: "loading" })
    try {
      const detail = await getUniverseMaterial(wanted)
      const here = detail.plants.find((p) => p.plant?.plantId === plantId)
      const stock = toNumber(here?.stockOnHand)
      setLookup({
        state: "found",
        text:
          (detail.material.description ?? detail.material.materialCode) +
          (stock !== undefined ? ` — ${formatCount(stock)} on hand at this plant` : ""),
      })
    } catch (error) {
      setLookup({
        state: "error",
        text:
          error instanceof ApiError && error.status === 404
            ? "Not found in the repairable universe — only 80-series parts can be declared."
            : "Could not look this material up. You can still record the declaration.",
      })
    }
  }

  /**
   * POST the declaration.
   *
   * It does not optimistically mark anything Completed: whether a repair line
   * picks this up is the backend's match to make, and `coverageNote` on the
   * response says, in words written for a person, what the write achieved.
   * It goes in the toast rather than being swallowed.
   *
   * It does not say "not written to SAP" as if that were a gap: the
   * declaration IS written, to a table the platform owns. SAP is never written.
   */
  async function declare() {
    if (!part.materialId || !part.plantId) {
      toast.error("Cannot declare this part", {
        description:
          "A declaration is recorded per material and plant, and one of them is missing.",
      })
      return
    }
    if (parsedQuantity === undefined) return

    setSubmitting(true)
    try {
      const created = await createAttestation({
        materialId: part.materialId,
        plant: part.plantId,
        quantity: parsedQuantity,
        conditionDescription: description.trim(),
        faultCategory,
        recommendation: RECOMMENDATION[condition],
        // Optional, and omitted rather than sent blank: an empty string on an
        // audit record reads as "the serial number is empty".
        serialNumber: serialNumber.trim() || undefined,
        evidenceReference: evidence.trim() || undefined,
      })

      // The API's own words about what the write covered.
      toast.success(`Declaration ${created.id} recorded`, {
        description: created.coverageNote ?? undefined,
        duration: 12000,
      })
      onClose()
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
      toast.error("The declaration was not recorded", { description: message, duration: 12000 })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{target ? "Declare condition" : "Declare a part"}</DialogTitle>
          <DialogDescription>
            {target
              ? target.label
              : "Assess the part when it comes off the machine, before it is sent anywhere. A repair PO raised for it later is matched to this declaration."}
          </DialogDescription>
        </DialogHeader>

        {!target && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground" htmlFor="declaration-material">
                Material number
              </label>
              <Input
                id="declaration-material"
                value={materialId}
                onChange={(e) => {
                  setMaterialId(e.target.value)
                  setLookup({ state: "idle" })
                }}
                onBlur={() => void lookUp(plant)}
                placeholder="e.g. 8000005632"
                inputMode="numeric"
                autoComplete="off"
              />
              <p
                className={
                  lookup.state === "error"
                    ? "text-[11px] text-destructive"
                    : "text-[11px] text-muted-foreground"
                }
              >
                {lookup.state === "loading"
                  ? "Looking up…"
                  : lookup.state === "found" || lookup.state === "error"
                    ? lookup.text
                    : "An 80-series part in the repairable universe."}
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground" htmlFor="declaration-plant">
                Plant
              </label>
              <Select
                value={plant}
                onValueChange={(v) => {
                  setPlant(v ?? "")
                  // The stock shown is per plant, so it is looked up again --
                  // for the plant just picked, which state has not caught up to.
                  if (lookup.state === "found") void lookUp(v ?? "")
                }}
              >
                <SelectTrigger id="declaration-plant" className="h-9 w-full sm:w-52">
                  <SelectValue placeholder="Select a plant">
                    {(selected: string) =>
                      plantOptions.find((p) => p.plantId === selected)?.name ?? selected
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {plantOptions.map((p) => (
                    <SelectItem key={p.plantId} value={p.plantId}>
                      {p.name} ({p.plantId})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

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
          {condition !== "Repairable" && (
            <p className="text-[11px] text-muted-foreground">
              Not worth repairing: no repair PO should follow. If one is raised anyway, its
              register line reads Flagged.
            </p>
          )}
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
                  {faultCategoryLabel(c)}
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
                : target?.quantityHint ?? "Units assessed."}
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

        {/* A reference, not an upload: file upload is descoped and the
            SharePoint library is not provisioned, so the platform does not
            pretend to hold the photo or report itself. */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted-foreground" htmlFor="attestation-evidence">
            Evidence reference <span className="italic">(optional)</span>
          </label>
          <Input
            id="attestation-evidence"
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            placeholder="Where the photos or inspection report are kept"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={() => void declare()}
            // The backend rejects a blank description or an unknown fault
            // category with a 422. Disabling here means the user is told
            // before the round trip rather than after it.
            disabled={
              submitting ||
              !part.materialId ||
              !part.plantId ||
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
  )
}
