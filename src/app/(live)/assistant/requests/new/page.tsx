import type { Metadata } from "next"

import { AssistantPageHeader } from "@/components/assistant/ai-visuals"
import { RequestBuilder } from "@/components/assistant/request/request-builder"

export const metadata: Metadata = {
  title: "New multi-material request — Spares AI",
}

/**
 * Demo only: one request, many materials.
 *
 * Runs entirely in the browser on the mock catalogue in
 * `lib/assistant/request/catalogue.ts`. No backend route exists for it yet.
 */
export default function NewRequestPage() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="flex flex-col gap-5">
        <AssistantPageHeader
          title="New multi-material request"
          description="Add every material you need. Each one is checked as it is added, and you answer only what it needs."
        />
        <RequestBuilder />
      </div>
    </div>
  )
}
