import Link from "next/link"
import { Send } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * What a recommendation page shows once the recommendation has been sent for approval: where it is in the
 * chain, and that it is decided from the Action Center. There are no approval buttons here on purpose --
 * approving, adjusting, sending back, holding and rejecting happen on the Action Center.
 */
export function SentForApprovalNotice({
  pendingRole,
  step,
  steps,
}: {
  pendingRole: string
  /** 1-based position of the step now waiting. */
  step: number
  steps: number
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start gap-2 text-[13px] text-muted-foreground">
        <Send className="mt-0.5 size-3.5 shrink-0" />
        <p>
          Sent for approval — step {step} of {steps}, waiting for{" "}
          <span className="font-medium text-foreground">{pendingRole}</span>. It is reviewed and decided in the
          Action Center.
        </p>
      </div>
      <Link href="/actions" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "self-start")}>
        Open Action Center
      </Link>
    </div>
  )
}
