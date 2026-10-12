"use client"

import { useId, useState } from "react"
import { toast } from "sonner"

import { SAPDocumentChip } from "@demo/components/shared/sap-document-chip"
import { Button } from "@demo/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@demo/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@demo/components/ui/select"
import { JUSTIFICATION_REASONS } from "@demo/features/initiative-8/data/justifications"
import { documentLabel } from "@demo/features/initiative-8/model/snapshot"
import { snapshotStore } from "@demo/features/initiative-8/state/snapshot-store"
import type { RepairException } from "@demo/features/initiative-8/types/repair"
import { codeLabel } from "@demo/features/initiative-8/utils/status"

/** "repair not economical" -> "Repair not economical", for the reason list. */
function reasonLabel(code: string): string {
  const words = codeLabel(code)
  return words.charAt(0).toUpperCase() + words.slice(1)
}

const TEXTAREA_CLASS =
  "w-full min-w-0 resize-y rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"

/**
 * Records why a new unit was bought although a repairable one existed (FR-7),
 * from the unjustified-acquisition item that asked for it.
 *
 * The entry names the purchase, so the check stops finding the item and the
 * queue resolves it itself, with the justification's id in its history. It is
 * logged as captured while chasing an exception — weeks after the decision,
 * which is different evidence from a reason given at reservation time. Nothing
 * is posted to SAP.
 */
export function RecordJustificationDialog({
  open,
  onClose,
  exception,
}: {
  open: boolean
  onClose: () => void
  exception: RepairException
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-lg">
        {/* The fields live in the popup, which unmounts on close, so every
            opening starts from an empty form. */}
        <JustificationForm exception={exception} onClose={onClose} />
      </DialogContent>
    </Dialog>
  )
}

function JustificationForm({
  exception,
  onClose,
}: {
  exception: RepairException
  onClose: () => void
}) {
  const reasonId = useId()
  const textId = useId()
  const [reasonCategory, setReasonCategory] = useState("")
  const [freeText, setFreeText] = useState("")

  const purchase = exception.acquisitionLine
  const valid = Boolean(purchase && reasonCategory && freeText.trim())

  function submit() {
    if (!purchase || !valid) return
    const entry = snapshotStore.recordJustification({
      materialId: exception.material.materialId,
      plantId: exception.plant.plantId,
      acquisitionLine: purchase,
      reasonCategory,
      freeText: freeText.trim(),
      exceptionId: exception.id,
    })
    toast.success(`Justification ${entry.id} recorded`, {
      description: `Names ${documentLabel(purchase)}, so ${exception.id} resolves itself. Not posted to SAP.`,
      duration: 10000,
    })
    onClose()
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Record justification</DialogTitle>
        <DialogDescription>
          {exception.material.materialId} — {exception.material.description}, {exception.plant.name}
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
          {purchase && (
            <div className="mb-1.5 flex items-center gap-2">
              <span className="font-medium text-foreground">Purchase</span>
              <SAPDocumentChip doc={purchase} />
            </div>
          )}
          {exception.detail}
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={reasonId}
            className="text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase"
          >
            Reason category
          </label>
          <Select value={reasonCategory || null} onValueChange={(v) => setReasonCategory(v ?? "")}>
            <SelectTrigger id={reasonId} className="h-9 w-full">
              <SelectValue placeholder="Choose a reason">
                {(value: string | null) => (value ? reasonLabel(value) : "Choose a reason")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {JUSTIFICATION_REASONS.map((reason) => (
                <SelectItem key={reason} value={reason}>
                  {reasonLabel(reason)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={textId}
            className="text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase"
          >
            Justification (required)
          </label>
          <textarea
            id={textId}
            value={freeText}
            onChange={(event) => setFreeText(event.target.value)}
            rows={4}
            placeholder="Why a new unit was bought although a repairable one existed…"
            className={TEXTAREA_CLASS}
          />
          <p className="text-[11px] text-muted-foreground">
            Kept in the justification log as captured while chasing this exception, recorded by you.
          </p>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={!valid}>
          Record justification
        </Button>
      </DialogFooter>
    </>
  )
}
