"use client"

import { useRef, useState, useTransition } from "react"
import { Upload } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { uploadZmm065Action } from "@/features/initiative-13/actions"

/** Last month as `YYYY-MM` -- the report VZI usually uploads at month start. */
function previousMonth(): string {
  const now = new Date()
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

/**
 * VZI's monthly ZMM065 upload (FR-6). One site's report per upload; the plant
 * is read from the file by the backend, so there is no plant to choose here.
 *
 * Uploads are appended, never overwritten. When a report for that plant and
 * month already exists the backend answers 409, and this card offers to
 * replace it: a newer upload becomes the current one and the earlier one stays
 * in the history below.
 */
export function Zmm065UploadCard() {
  const formRef = useRef<HTMLFormElement>(null)
  const [isPending, startTransition] = useTransition()
  const [conflict, setConflict] = useState<string | null>(null)

  function submit(replace: boolean) {
    const form = formRef.current
    if (!form) return
    const formData = new FormData(form)
    formData.set("replace", replace ? "true" : "false")
    startTransition(async () => {
      const result = await uploadZmm065Action(formData)
      if (result.ok) {
        toast.success(result.message)
        setConflict(null)
        form.reset()
      } else if (result.conflict) {
        setConflict(result.message)
      } else {
        setConflict(null)
        toast.error(result.message)
      }
    })
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div>
        <h2 className="text-sm font-medium text-foreground">Upload monthly ZMM065 report</h2>
        <p className="text-xs text-muted-foreground">
          One site&apos;s ZMM065 aging export (.xlsx) per upload — Black Mountain (1300) and Gamsberg (1500)
          separately. The plant is read from the file. Validation then reconciles against the latest upload for
          each plant.
        </p>
      </div>
      <form
        ref={formRef}
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={(event) => {
          event.preventDefault()
          submit(false)
        }}
        onChange={() => setConflict(null)}
      >
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="zmm065-file">Report file</Label>
          <Input id="zmm065-file" name="file" type="file" accept=".xlsx,.xlsm" required disabled={isPending} />
        </div>
        <div className="flex flex-col gap-1.5 sm:w-44">
          <Label htmlFor="zmm065-month">Report month</Label>
          <Input
            id="zmm065-month"
            name="report_month"
            type="month"
            defaultValue={previousMonth()}
            required
            disabled={isPending}
          />
        </div>
        <Button type="submit" disabled={isPending}>
          <Upload className="size-3.5" />
          {isPending ? "Uploading…" : "Upload"}
        </Button>
      </form>
      {conflict && (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-foreground">{conflict}</p>
          <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={() => submit(true)}>
            Replace with this file
          </Button>
        </div>
      )}
    </section>
  )
}
