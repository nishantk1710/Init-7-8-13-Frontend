"use client"

import { useState } from "react"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { DeclarationFormDialog } from "@/features/initiative-8/components/declaration-form-dialog"

/**
 * "Declare a part" — the Declarations screen's way in (FR-4).
 *
 * Starts from the part, not from a repair line: the FRS has the condition
 * declared before dispatch, when no repair PO exists yet to start from.
 */
export function DeclarePartButton({
  faultCategories,
  plantOptions,
}: {
  faultCategories: string[]
  plantOptions: { plantId: string; name: string }[]
}) {
  const [open, setOpen] = useState(false)
  // A fresh form for every opening -- see DeclarationFormDialog.
  const [formKey, setFormKey] = useState(0)

  return (
    <>
      <Button
        size="sm"
        onClick={() => {
          setFormKey((k) => k + 1)
          setOpen(true)
        }}
      >
        <Plus className="size-3.5" />
        Declare a part
      </Button>

      <DeclarationFormDialog
        key={formKey}
        open={open}
        onClose={() => setOpen(false)}
        faultCategories={faultCategories}
        plantOptions={plantOptions}
      />
    </>
  )
}
