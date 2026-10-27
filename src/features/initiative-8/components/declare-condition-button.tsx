"use client"

import { useState } from "react"
import { SquarePen } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DeclarationFormDialog,
  type DeclarationTarget,
} from "@/features/initiative-8/components/declaration-form-dialog"
import type { RepairChain } from "@/features/initiative-8/types/repair"
import { defaultAttestationQuantity } from "@/features/initiative-8/utils/attestation"
import { isPrOnly } from "@/features/initiative-8/utils/status"

/**
 * "Declare condition" for one repair line.
 *
 * The form itself lives in `DeclarationFormDialog`, which this hands a target.
 * It was all one component until 12-Oct-2026, when the declarations queue
 * needed the same form per row and the part-first entry point needed it with
 * no repair line at all.
 *
 * Renders nothing on a repair requested with no PO yet (`targetOf` refuses
 * it): the screens already hide it there, and this is the backstop.
 */
export function DeclareConditionButton({
  chain,
  faultCategories,
  label = "Declare condition",
  variant = "outline",
  size = "sm",
  icon = false,
  supersedes,
}: {
  chain: RepairChain
  faultCategories: string[]
  label?: string
  variant?: "outline" | "default" | "ghost" | "link"
  /** `lg` where it is the page's main action, on the repair page. */
  size?: "sm" | "lg"
  icon?: boolean
  /** Set to amend an existing declaration rather than record a first one. */
  supersedes?: string
}) {
  const [open, setOpen] = useState(false)
  // A fresh form every time it is opened: a half-typed description from a
  // line somebody backed out of must not reappear against a different part.
  const [formKey, setFormKey] = useState(0)
  const target = targetOf(chain, supersedes)
  if (target === null) return null

  return (
    <>
      <Button
        size={size}
        variant={variant}
        className={size === "lg" ? "px-3.5" : undefined}
        onClick={() => {
          setFormKey((k) => k + 1)
          setOpen(true)
        }}
      >
        {icon && <SquarePen className="size-4" />}
        {label}
      </Button>
      {open && (
        <DeclarationFormDialog
          key={formKey}
          open
          onClose={() => setOpen(false)}
          target={target}
          faultCategories={faultCategories}
        />
      )}
    </>
  )
}

/**
 * One repair line as a declaration target, or null for a repair requested
 * with no PO yet.
 *
 * Refused rather than sent without a line: a declaration from a repair line
 * that names no PO would land as a part-level one, matched on material, plant
 * and a date window, and read as if it were this line's. The backend refuses a
 * declaration on a repair request too (since 27-Oct-2026), until declaring on
 * the PR is built.
 */
export function targetOf(chain: RepairChain, supersedes?: string): DeclarationTarget | null {
  if (isPrOnly(chain)) return null
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
