"use client"

import { useState, useTransition } from "react"
import { Download, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"

/**
 * An Excel export that fetches every matching row when pressed.
 *
 * The tables beside these buttons hold one page of 25 rows, so an export of
 * "what is on screen" would be one page. `onExport` asks the server for all of
 * them (see `export-actions.ts`) and builds the workbook; the button says it
 * is working meanwhile, and says so when it fails rather than downloading an
 * empty file.
 */
export function ExportButton({
  label,
  onExport,
}: {
  label: string
  onExport: () => Promise<void>
}) {
  const [isPending, startTransition] = useTransition()
  const [failed, setFailed] = useState(false)

  return (
    <div className="flex items-center gap-2">
      {failed && <span className="text-xs text-destructive">Export failed — try again.</span>}
      <Button
        size="sm"
        variant="outline"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            setFailed(false)
            try {
              await onExport()
            } catch {
              setFailed(true)
            }
          })
        }
      >
        {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
        {isPending ? "Preparing…" : label}
      </Button>
    </div>
  )
}
