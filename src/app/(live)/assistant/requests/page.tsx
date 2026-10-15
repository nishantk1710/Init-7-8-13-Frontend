import type { Metadata } from "next"

import { AssistantPageHeader } from "@/components/assistant/ai-visuals"
import { RequestList } from "@/components/assistant/request/request-list"

export const metadata: Metadata = {
  title: "Multi-material requests — Spares AI",
}

/** Demo only: multi-material requests made in this browser. */
export default function RequestsPage() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="flex flex-col gap-5">
        <AssistantPageHeader
          title="Multi-material requests"
          description="Several materials checked in one go, under one reference."
        />
        <RequestList />
      </div>
    </div>
  )
}
