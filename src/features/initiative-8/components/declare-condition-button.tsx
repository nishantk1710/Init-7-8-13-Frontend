"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  DeclarationFormDialog,
  type DeclarationTarget,
} from "@/features/initiative-8/components/declaration-form-dialog"
import type { RepairChain } from "@/features/initiative-8/types/repair"
import { defaultAttestationQuantity } from "@/features/initiative-8/utils/attestation"

/**
 * "Declare condition" for one repair line.
 *
 * The form itself lives in `DeclarationFormDialog`, which this hands a target.
 * It was all one component until 12-Oct-2026, when the declarations queue
 * needed the same form per row and the part-first entry point needed it with
 * no repair line at all.
 */
export function DeclareConditionButton({
  chain,
  faultCategories,
  label = "Declare condition",
  variant = "outline",
  supersedes,
}: {
  chain: RepairChain
  faultCategories: string[]
  label?: string
  variant?: "outline" | "default" | "ghost"
  /** Set to amend an existing declaration rather than record a first one. */
  supersedes?: string
}) {
  const [open, setOpen] = useState(false)
  // A fresh form every time it is opened: a half-typed description from a
  // line somebody backed out of must not reappear against a different part.
  const [formKey, setFormKey] = useState(0)

  return (
    <>
      <Button
        size="sm"
        variant={variant}
        onClick={() => {
          setFormKey((k) => k + 1)
          setOpen(true)
        }}
      >
        {label}
      </Button>
      {open && (
        <DeclarationFormDialog
          key={formKey}
          open
          onClose={() => setOpen(false)}
          target={targetOf(chain, supersedes)}
          faultCategories={faultCategories}
        />
      )}
    </>
  )
}

/** One repair line as a declaration target. */
export function targetOf(chain: RepairChain, supersedes?: string): DeclarationTarget {
  return {
    materialId: chain.material.materialId,
    // The live adapter spells a line with no plant as "—". An attestation is
    // per material and plant, so it cannot be recorded against one.
    plantId: chain.plant.plantId !== "—" ? chain.plant.plantId : undefined,
    label: `${chain.material.materialId} — ${chain.material.description} (repair ${chain.id})`,
    defaultQuantity: defaultAttestationQuantity(chain.qtyUnderRepair),
    qtyUnderRepair: chain.qtyUnderRepair,
    supersedes,
    // FR-4's link to the repair PO. The id was already in the label as prose;
    // this sends it as data, which is what makes the line read as declared
    // rather than waiting on a date window it cannot satisfy.
    //
    // Taken from `repairPO` rather than splitting `chain.id`: the backend
    // builds both from the same EBELN/EBELP, and splitting a string on a
    // hyphen guesses at a document number that may one day contain one.
    repairDocument: chain.repairPO?.documentNumber,
    repairItem: chain.repairPO?.line,
  }
}
