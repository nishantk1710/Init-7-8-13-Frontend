"use client"

import { useState } from "react"
import { ChevronDown, Download, Loader2 } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { EXPORT_FORMATS, type ExportFormat } from "@/lib/export-document"

/** "Download ▾" with Word, PDF and text; `onDownload` builds and saves the file. */
export function DownloadMenu({
  onDownload,
  className,
}: {
  onDownload: (format: ExportFormat) => Promise<unknown>
  className?: string
}) {
  const [busy, setBusy] = useState(false)

  async function download(format: ExportFormat) {
    setBusy(true)
    try {
      await onDownload(format)
    } finally {
      setBusy(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={buttonVariants({ variant: "outline", size: "sm", className })} disabled={busy}>
        {busy ? <Loader2 className="animate-spin" /> : <Download />}
        Download
        <ChevronDown className="opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {EXPORT_FORMATS.map(({ format, label }) => (
          <DropdownMenuItem key={format} onClick={() => download(format)}>
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
