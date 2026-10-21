"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { ActException } from "@/lib/api/i13"

/**
 * The requester's structured answer to an exception — FR-7's "reason category
 * plus free text", FR-9's confirmation step.
 *
 * ## This writes, and it cannot be taken back
 *
 * It posts to an append-only table. There is no edit and no delete: a
 * correction is a new record, and nothing in this application offers PUT,
 * PATCH or DELETE anywhere. So the dialog says so above the button rather than
 * letting somebody find out afterwards.
 *
 * ## Where the reason categories come from
 *
 * The backend, with the justification list. They are VZI's vocabulary and they
 * will change — seven placeholders are configured today and the real list is
 * still an open item — so a hard-coded set here would go stale silently and
 * would disagree with what the backend validates against.
 */
export function ConfirmExceptionDialog({
  exception,
  reasonCategories,
  submitting,
  onCancel,
  onSubmit,
}: {
  exception: ActException
  reasonCategories: string[]
  submitting: boolean
  onCancel: () => void
  onSubmit: (formData: FormData) => void
}) {
  const [reasonCategory, setReasonCategory] = useState("")
  const [freeText, setFreeText] = useState("")

  const ready = reasonCategory.trim().length > 0 && freeText.trim().length > 0

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!ready || submitting) return
    const formData = new FormData()
    formData.set("reasonCategory", reasonCategory)
    formData.set("freeText", freeText)
    onSubmit(formData)
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !submitting && onCancel()}>
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Confirm exception</DialogTitle>
            <DialogDescription>
              {exception.material} at plant {exception.plant} — {exception.reason}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reasonCategory">Reason category</Label>
            {reasonCategories.length > 0 ? (
              <Select
                value={reasonCategory}
                onValueChange={(value) => setReasonCategory(value ?? "")}
              >
                <SelectTrigger id="reasonCategory" className="h-9">
                  <SelectValue placeholder="Choose a reason" />
                </SelectTrigger>
                <SelectContent>
                  {reasonCategories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              // The list is served with the justification log. If that call
              // failed, saying so beats an empty dropdown that looks broken.
              <p className="text-xs text-muted-foreground">
                The reason categories could not be loaded, so a confirmation
                cannot be recorded right now — the backend validates against the
                same list it serves.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="freeText">What happened</Label>
            <Textarea
              id="freeText"
              value={freeText}
              onChange={(event) => setFreeText(event.target.value)}
              placeholder="Why this material was not consumed as planned, in your own words."
              rows={4}
              maxLength={2000}
            />
            <p className="text-[11px] text-muted-foreground">
              Recorded against this exception permanently. Corrections are new
              records — nothing here can be edited or removed afterwards.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!ready || submitting}>
              {submitting ? "Recording…" : "Record confirmation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
