"use client"

import { useState } from "react"
import { ChevronDown, Download, Loader2 } from "lucide-react"

import {
  downloadRequest,
  REQUEST_EXPORT_FORMATS,
  type RequestExportFormat,
} from "@/components/assistant/request/request-export"
import { buttonVariants } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { ApiRequest } from "@/lib/api/assistant-requests"

/** Download the request summary as Word, PDF or text. */
export function RequestDownloadMenu({ request }: { request: ApiRequest }) {
  const [busy, setBusy] = useState<RequestExportFormat | null>(null)

  async function download(format: RequestExportFormat) {
    setBusy(format)
    await downloadRequest(request, format)
    setBusy(null)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={buttonVariants({ variant: "outline", size: "sm" })} disabled={busy !== null}>
        {busy ? <Loader2 className="animate-spin" /> : <Download />}
        Download
        <ChevronDown className="opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {REQUEST_EXPORT_FORMATS.map(({ format, label }) => (
          <DropdownMenuItem key={format} onClick={() => download(format)}>
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
