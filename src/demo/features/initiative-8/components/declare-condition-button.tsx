"use client"

import { useState } from "react"
import { toast } from "sonner"

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
import { FAULT_CATEGORIES } from "@demo/features/initiative-8/data/declarations"
import { REFERENCE_DATE } from "@demo/features/initiative-8/data/repair-chains"
import type { DeclarationCondition, RepairChain } from "@demo/features/initiative-8/types/repair"

const CONDITIONS: DeclarationCondition[] = ["Repairable", "Beyond Economical Repair", "Scrap"]

/** The quantity field as a positive number, or undefined so the button can say no. */
function parseQuantity(input: string): number | undefined {
  const trimmed = input.trim()
  if (trimmed === "") return undefined
  const value = Number(trimmed)
  return Number.isFinite(value) && value > 0 ? value : undefined
}

/** What a declaration changes on the line, as the backend would compute it. */
export type DeclarationUpdate = Pick<
  RepairChain,
  "declarationStatus" | "condition" | "declaredBy" | "declaredAt" | "declarationNextAction"
>

/**
 * The condition-to-repair declaration form — the Snapshot copy of live's.
 *
 * It lived on the Declaration Queue until 08-Oct-2026 and now sits on the
 * repair detail page, as in live. The Snapshot never calls the backend, so the
 * declaration is held by the page that opened the form (`onDeclared`) and is
 * gone on reload, exactly as the old queue's was. Repairable reads Completed;
 * anything else reads Flagged — assessed as not repairable, sent anyway — the
 * same rule the backend applies.
 */
export function DeclareConditionButton({
  chain,
  onDeclared,
}: {
  chain: RepairChain
  onDeclared: (update: DeclarationUpdate) => void
}) {
  const [open, setOpen] = useState(false)
  const [condition, setCondition] = useState<DeclarationCondition>("Repairable")
  const [description, setDescription] = useState("")
  const [faultCategory, setFaultCategory] = useState(FAULT_CATEGORIES[0])
  const [quantity, setQuantity] = useState("1")
  const [serialNumber, setSerialNumber] = useState("")
  const parsedQuantity = parseQuantity(quantity)

  function openForm() {
    setCondition("Repairable")
    setDescription("")
    setFaultCategory(FAULT_CATEGORIES[0])
    setQuantity(String(chain.qtyUnderRepair > 0 ? chain.qtyUnderRepair : 1))
    setSerialNumber("")
    setOpen(true)
  }

  function confirmDeclaration() {
    const repairable = condition === "Repairable"
    onDeclared({
      declarationStatus: repairable ? "Completed" : "Flagged",
      condition,
      declaredBy: "You",
      declaredAt: REFERENCE_DATE,
      declarationNextAction: repairable
        ? "None. The condition was declared and the part was found repairable."
        : `Assessed as ${condition} but sent for repair anyway — confirm with the attestor before the unit comes back.`,
    })
    toast.success(`Declared ${chain.material.materialId} as "${condition}" — not posted to SAP.`)
    setOpen(false)
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
            <Select value={faultCategory} onValueChange={(v) => setFaultCategory(v ?? FAULT_CATEGORIES[0])}>
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
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={confirmDeclaration}
              disabled={description.trim() === "" || parsedQuantity === undefined}
            >
              Confirm declaration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
