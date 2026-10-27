import type { Metadata } from "next"
import Link from "next/link"
import { Plus } from "lucide-react"

import { AssistantPageHeader } from "@/components/assistant/ai-visuals"
import { RequestList } from "@/components/assistant/request/request-list"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "Requests — Spares AI",
}

/** Demo only: multi-material requests made in this browser. */
export default function RequestsPage() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        <AssistantPageHeader
          plain
          title="Requests"
          description="Every request, one material or several, each under one reference."
          actions={
            <Link
              href="/assistant/requests/new"
              className={cn(buttonVariants({ size: "lg" }), "min-h-11 px-5 text-base font-semibold")}
            >
              <Plus aria-hidden /> New request
            </Link>
          }
        />
        <RequestList />
      </div>
    </div>
  )
}
