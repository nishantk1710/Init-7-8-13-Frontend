"use client"

import { toast } from "sonner"

import { DownloadMenu } from "@/components/shared/download-menu"
import { getSession, type SessionTraceResponse } from "@/lib/api/assistant"
import { ApiError } from "@/lib/api/client"
import { downloadSession } from "@/lib/assistant/session-export"
import type { ExportFormat } from "@/lib/export-document"

/**
 * Download one session as Word, PDF or text. Pass `trace` where the page
 * already holds it; with `sessionId` alone (the "All done" card) the record is
 * read when the format is picked.
 */
export function SessionDownloadMenu(
  props: { trace: SessionTraceResponse; className?: string } | { sessionId: string; className?: string }
) {
  async function download(format: ExportFormat) {
    let trace: SessionTraceResponse
    if ("trace" in props) {
      trace = props.trace
    } else {
      try {
        trace = await getSession(props.sessionId)
      } catch (error) {
        toast.error("Could not load the session", {
          description: error instanceof ApiError ? error.detailText() : "The backend did not answer.",
        })
        return false
      }
    }
    return downloadSession(trace, format)
  }

  return <DownloadMenu onDownload={download} className={props.className} />
}
