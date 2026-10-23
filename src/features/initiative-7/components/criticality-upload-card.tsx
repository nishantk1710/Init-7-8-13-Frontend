"use client"

import { useRef, useState, useTransition } from "react"
import { Check, Upload } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn, formatCount } from "@/lib/utils"
import { uploadCriticalityReport } from "@/features/initiative-7/services/criticality-reports-api"
import type { CriticalityPlant, CriticalityUploadResult } from "@/features/initiative-7/types/criticality-reports"
import { formatMonth, previousMonth, thisMonth } from "@/features/initiative-7/utils/criticality-reports"
import { sapPlantLabel } from "@/lib/shared-data/sap-plants"

/**
 * Upload one plant's monthly criticality report (ZMM065).
 *
 * The uploader picks the plant and the month; the file's own Plant column must
 * agree, or the backend refuses it. Every upload is kept. A second file for a
 * plant and month that already has one is answered 409, and this card offers
 * to replace it -- the newer file becomes current for that month and the
 * earlier one stays in the history.
 */
export function CriticalityUploadCard({
  plants,
  onUploaded,
}: {
  plants: CriticalityPlant[] | null
  onUploaded: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [plant, setPlant] = useState<string>("")
  const [month, setMonth] = useState<string>(() => previousMonth())
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<CriticalityUploadResult | null>(null)
  const [conflict, setConflict] = useState<string | null>(null)
  const [refusal, setRefusal] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // The first plant until somebody picks one -- derived, not copied into
  // state in an effect.
  const selectedPlant = plant || plants?.[0]?.code || ""
  const canSubmit = Boolean(selectedPlant && month && file) && !isPending

  function clearMessages() {
    setConflict(null)
    setRefusal(null)
  }

  function submit(replace: boolean) {
    if (!file || !selectedPlant || !month) return
    startTransition(async () => {
      const outcome = await uploadCriticalityReport({ plant: selectedPlant, reportMonth: month, file, replace })
      if (outcome.kind === "stored") {
        setResult(outcome.result)
        clearMessages()
        setFile(null)
        if (fileRef.current) fileRef.current.value = ""
        toast.success(`${formatMonth(outcome.result.upload.reportMonth)} report uploaded for ${sapPlantLabel(selectedPlant)}.`)
        onUploaded()
      } else if (outcome.kind === "conflict") {
        setResult(null)
        setRefusal(null)
        setConflict(outcome.message)
      } else {
        setResult(null)
        setConflict(null)
        setRefusal(outcome.message)
      }
    })
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border-2 border-action/40 bg-card p-4 shadow-lg">
      <div>
        <h2 className="text-sm font-medium text-foreground">Upload a report</h2>
        <p className="text-xs text-muted-foreground">The file&apos;s own plant must match the plant you pick.</p>
      </div>

      <form
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={(event) => {
          event.preventDefault()
          submit(false)
        }}
      >
        <div className="flex flex-col gap-1.5 sm:w-56">
          <Label htmlFor="criticality-plant">Plant</Label>
          <Select
            value={selectedPlant}
            onValueChange={(value) => {
              setPlant(value ?? "")
              clearMessages()
            }}
            disabled={!plants || isPending}
          >
            <SelectTrigger id="criticality-plant" className="h-9 w-full">
              <SelectValue placeholder={plants ? "Choose a plant" : "Loading plants…"}>
                {(value: string) => (value ? sapPlantLabel(value) : "Choose a plant")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="blue-scope">
              {(plants ?? []).map((p) => (
                <SelectItem key={p.code} value={p.code}>
                  {sapPlantLabel(p.code)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5 sm:w-44">
          <Label htmlFor="criticality-month">Month</Label>
          <Input
            id="criticality-month"
            type="month"
            value={month}
            max={thisMonth()}
            onChange={(event) => {
              setMonth(event.target.value)
              clearMessages()
            }}
            required
            disabled={isPending}
          />
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="criticality-file">Report file</Label>
          <Input
            ref={fileRef}
            id="criticality-file"
            type="file"
            accept=".xlsx,.xlsm"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null)
              clearMessages()
            }}
            required
            disabled={isPending}
          />
        </div>
        <Button type="submit" disabled={!canSubmit}>
          <Upload className="size-3.5" />
          {isPending ? "Uploading…" : "Upload"}
        </Button>
      </form>

      <p className="text-xs text-muted-foreground">
        Needs the columns Mat.Code, Plant and Criticality. The right sheet is found by its column names, so pivot
        sheets and a junk first row are fine.
      </p>

      {conflict && (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-foreground">{conflict}</p>
          <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={() => submit(true)}>
            Replace with this file
          </Button>
        </div>
      )}
      {refusal && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs whitespace-pre-line text-destructive">
          {refusal}
        </p>
      )}
      {result && <UploadResultPanel result={result} />}
    </section>
  )
}

/** What one upload did -- the panel under the form after a success. */
export function UploadResultPanel({ result }: { result: CriticalityUploadResult }) {
  const plant = sapPlantLabel(result.upload.plant)
  const month = formatMonth(result.upload.reportMonth)
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-success/30 bg-success/5 px-3 py-2">
      <p className="flex items-center gap-1.5 text-sm text-foreground">
        <Check className="size-4 text-success" />
        {result.isCurrent ? (
          <span>
            Uploaded — <span className="font-medium">{month}</span> is now the current report for {plant}
          </span>
        ) : (
          <span>
            Uploaded — {month} is kept for {plant}.{" "}
            <span className="font-medium">{formatMonth(result.currentMonth)}</span> stays current; this file only
            fills materials newer reports leave out.
          </span>
        )}
      </p>
      <div className="flex flex-wrap gap-1.5">
        <Chip>{formatCount(result.rowsRead)} rows read</Chip>
        <Chip>
          {result.tiers} tier{result.tiers === 1 ? "" : "s"}
        </Chip>
        <Chip>
          {formatCount(result.duplicates)} duplicate{result.duplicates === 1 ? "" : "s"}
        </Chip>
        <Chip tone={result.blankTiers > 0 ? "warning" : "default"}>
          {formatCount(result.blankTiers)} blank tier{result.blankTiers === 1 ? "" : "s"}
        </Chip>
        <Chip tone="success">File plant {result.filePlant} ✓ matches</Chip>
      </div>
      {result.replacedUploadId !== null && (
        <p className="text-xs text-muted-foreground">
          Replaced the earlier {month} upload for this plant; it stays in the history.
        </p>
      )}
    </div>
  )
}

function Chip({
  tone = "default",
  children,
}: {
  tone?: "default" | "warning" | "success"
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(
        "rounded-full border px-2.5 py-0.5 text-xs font-medium tabular-nums",
        tone === "warning" && "border-warning/40 bg-warning/10 text-warning",
        tone === "success" && "border-success/40 bg-success/10 text-success",
        tone === "default" && "border-border bg-background text-foreground"
      )}
    >
      {children}
    </span>
  )
}
