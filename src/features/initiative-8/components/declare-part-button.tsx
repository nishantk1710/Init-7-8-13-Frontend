"use client"

import { useState } from "react"
import { ClipboardCheck } from "lucide-react"

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
import { DeclarationFormDialog } from "@/features/initiative-8/components/declaration-form-dialog"

/**
 * "Declare a part" — a declaration with no repair line (FR-4).
 *
 * ## Why this exists
 *
 * The form was reachable only from a repair line until 12-Oct-2026, which made
 * the declaration look like a step inside the repair process. It is the gate
 * before it. FR-4 assesses a part when it comes off the machine, and the two
 * cases that matter most never reach a repair line at all: a part judged Scrap
 * or Beyond Economical Repair is not sent anywhere, so if the only way to
 * record an assessment is from a repair PO, those judgements are never
 * captured — exactly the ones worth having.
 *
 * ## Why it asks for a material number rather than offering a picker
 *
 * The repairable universe is 3,604 materials and nobody scrolls that. There is
 * no material search endpoint in I08's API, so a typed number validated by the
 * backend is the honest version: `POST /attestations` already refuses anything
 * outside the repairable universe and says why, in words meant for a person.
 * A picker over a list this screen does not have would be a worse lie than a
 * text field.
 */
export function DeclarePartButton({
  plantOptions,
  faultCategories,
}: {
  plantOptions: { plantId: string; name: string }[]
  faultCategories: string[]
}) {
  const [picking, setPicking] = useState(false)
  const [materialId, setMaterialId] = useState("")
  const [plantId, setPlantId] = useState(plantOptions[0]?.plantId ?? "")
  const [target, setTarget] = useState<{ materialId: string; plantId: string } | null>(null)
  // A fresh form per opening — see DeclareConditionButton.
  const [formKey, setFormKey] = useState(0)

  function open() {
    setMaterialId("")
    setPlantId(plantOptions[0]?.plantId ?? "")
    setPicking(true)
  }

  function next() {
    const clean = materialId.trim()
    if (!clean || !plantId) return
    setFormKey((k) => k + 1)
    setTarget({ materialId: clean, plantId })
    setPicking(false)
  }

  const plantName = plantOptions.find((p) => p.plantId === plantId)?.name ?? plantId

  return (
    <>
      <Button size="sm" onClick={open}>
        <ClipboardCheck className="size-3.5" />
        Declare a part
      </Button>

      <Dialog open={picking} onOpenChange={(o) => !o && setPicking(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Declare a part</DialogTitle>
            <DialogDescription>
              Record a condition assessment against a part and plant. No repair line is
              needed — a part judged Scrap or Beyond Economical Repair never gets one.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground" htmlFor="declare-material">
              Material number
            </label>
            <Input
              id="declare-material"
              value={materialId}
              onChange={(e) => setMaterialId(e.target.value)}
              placeholder="8000005632"
              onKeyDown={(e) => {
                if (e.key === "Enter") next()
              }}
            />
            <p className="text-[11px] text-muted-foreground">
              An 80-series repairable material. Leading zeroes do not matter — the
              backend normalises the number before it compares anything, and refuses a
              part that is not in the repairable universe.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground">Plant</label>
            <Select value={plantId} onValueChange={(v) => setPlantId(v ?? "")}>
              <SelectTrigger className="h-9 w-full">
                <SelectValue placeholder="Select a plant" />
              </SelectTrigger>
              <SelectContent>
                {plantOptions.map((p) => (
                  <SelectItem key={p.plantId} value={p.plantId}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPicking(false)}>
              Cancel
            </Button>
            <Button onClick={next} disabled={materialId.trim() === "" || plantId === ""}>
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {target && (
        <DeclarationFormDialog
          key={formKey}
          open
          onClose={() => setTarget(null)}
          target={{
            materialId: target.materialId,
            plantId: target.plantId,
            label: `${target.materialId} at ${plantName} — no repair line`,
            defaultQuantity: "1",
          }}
          faultCategories={faultCategories}
        />
      )}
    </>
  )
}
