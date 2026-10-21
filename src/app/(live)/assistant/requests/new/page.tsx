import type { Metadata } from "next"

import { AssistantPageHeader } from "@/components/assistant/ai-visuals"
import { RequestBuilder } from "@/components/assistant/request/request-builder"
import { entryFromParams } from "@/lib/assistant/request/entry"

export const metadata: Metadata = {
  title: "New request — Spares AI",
}

/**
 * One request, one material or many.
 *
 * A link may name a material to start with (`?material=…&plant=…`, the same
 * parameters as the SAP BAdI link -- see `lib/assistant/request/entry.ts`):
 * it becomes line 1, and the requester can submit it alone or add more.
 */
export default async function NewRequestPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const entry = entryFromParams(await searchParams)
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="flex flex-col gap-5">
        <AssistantPageHeader
          title="New request"
          description="Add the material you need, or several. Each one is checked as it is added, and you answer only what it needs."
        />
        <RequestBuilder entry={entry} />
      </div>
    </div>
  )
}
