import type { Metadata } from "next"
import { connection } from "next/server"

import { AssistantPageHeader } from "@/components/assistant/ai-visuals"
import { RequestBuilder } from "@/components/assistant/request/request-builder"
import { entryFromParams } from "@/lib/assistant/request/entry"
import { loadCompleteFlowFromFeatures } from "@/lib/i08-features"

export const metadata: Metadata = {
  title: "New request — Spares AI",
}

/**
 * One request, one material or many.
 *
 * A link may name a material to start with (`?material=…&plant=…`, the same
 * parameters as the SAP BAdI link -- see `lib/assistant/request/entry.ts`):
 * it becomes line 1, and the requester can submit it alone or add more.
 * `?draft=<id>` resumes a draft saved in this browser instead.
 */
export default async function NewRequestPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  // The complete-flow switch is read per request, never frozen at build time.
  await connection()
  const params = await searchParams
  const completeFlow = await loadCompleteFlowFromFeatures()
  const entry = entryFromParams(params)
  const draftId = typeof params.draft === "string" && params.draft ? params.draft : null
  return (
    <div className="nav-blue-scope min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        <AssistantPageHeader
          plain
          title="New request"
          description="Add the material you need, or several. Each one is checked as it is added, and you answer only what it needs."
        />
        {/* Keyed by draft: opening another draft from this page starts a fresh builder. */}
        <RequestBuilder key={draftId ?? "new"} entry={entry} draftId={draftId} completeFlow={completeFlow} />
      </div>
    </div>
  )
}
