import type { Metadata } from "next"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { AssistantPageHeader } from "@/components/assistant/ai-visuals"
import { RequestSummary } from "@/components/assistant/request/request-summary"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ requestId: string }>
}): Promise<Metadata> {
  const { requestId } = await params
  return { title: `Request ${requestId} — Spares AI` }
}

/** Demo only: a submitted request. It lives in the browser, so it is read there. */
export default async function RequestPage({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params
  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-page p-4 sm:p-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Link
            href="/assistant/requests"
            className="inline-flex min-h-11 w-fit items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft aria-hidden className="size-4" />
            All requests
          </Link>
          <AssistantPageHeader
            plain
            title={`Request ${requestId}`}
            description="What was decided for each material, and how to quote it in SAP."
          />
        </div>
        <RequestSummary requestId={requestId} />
      </div>
    </div>
  )
}
