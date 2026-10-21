import type { Metadata } from "next"

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
    <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="flex flex-col gap-5">
        <AssistantPageHeader title={`Request ${requestId}`} description="What was decided for each material, and how to quote it in SAP." />
        <RequestSummary requestId={requestId} />
      </div>
    </div>
  )
}
