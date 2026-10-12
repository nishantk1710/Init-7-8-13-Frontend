"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { DeclarationFormDialog } from "@/features/initiative-8/components/declaration-form-dialog"
import type { RepairChain } from "@/features/initiative-8/types/repair"
import { defaultAttestationQuantity } from "@/features/initiative-8/utils/attestation"

/**
 * Declare a repair line's part from its detail page (FR-4).
 *
 * The fallback route. A part is meant to be declared on the Declarations
 * screen when it comes off the machine, before any repair PO exists; this is
 * for a line that went out without one. Same form, fixed to the line's
 * material and plant.
 */
export function DeclareConditionButton({
  chain,
  faultCategories,
}: {
  chain: RepairChain
  /** The configured fault-category list, served by the API. */
  faultCategories: string[]
}) {
  const [open, setOpen] = useState(false)
  // A fresh form for every opening -- see DeclarationFormDialog.
  const [formKey, setFormKey] = useState(0)

  // The live adapter spells a line with no plant as "—". A declaration is per
  // material and plant, so it cannot be recorded against one; the form says so.
  const plantId = chain.plant.plantId !== "—" ? chain.plant.plantId : ""

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          setFormKey((k) => k + 1)
          setOpen(true)
        }}
      >
        Declare condition
      </Button>

      <DeclarationFormDialog
        key={formKey}
        open={open}
        onClose={() => setOpen(false)}
        faultCategories={faultCategories}
        target={{
          materialId: chain.material.materialId,
          plantId,
          label: `${chain.material.materialId} — ${chain.material.description} (repair ${chain.id})`,
          defaultQuantity: defaultAttestationQuantity(chain.qtyUnderRepair),
          quantityHint:
            chain.qtyUnderRepair > 0 ? `${chain.qtyUnderRepair} under repair on this line.` : undefined,
        }}
      />
    </>
  )
}
