"use client"

import { useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Bell, ClipboardList, Link2 } from "lucide-react"

import { CopyReferenceButton } from "@/components/assistant/request/request-parts"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { ApiRequest } from "@/lib/api/assistant-requests"
import { awaitingReservation } from "@/lib/assistant/request/record"

/** Added by the builder when it opens the request it just created; removed once the window is shown. */
export const CREATED_PARAM = "created"

/** The address the builder opens after submitting: the request, marked as just created. */
export function createdRequestPath(requestId: string): string {
  return `/assistant/requests/${requestId}?${CREATED_PARAM}=1`
}

/**
 * Shown once, right after a request is submitted: what to do in SAP, and that
 * the requester will be notified when the reservation is linked -- or reminded
 * after a day if it is not. Not shown when no line will be reserved.
 *
 * The flag is taken off the address when the window is closed, so a refresh or
 * the back button does not show it again.
 */
export function RequestCreatedDialog({ request }: { request: ApiRequest }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [dismissed, setDismissed] = useState(false)
  const waiting = awaitingReservation(request).length
  const open = !dismissed && searchParams.has(CREATED_PARAM) && waiting > 0

  function close() {
    setDismissed(true)
    const params = new URLSearchParams(searchParams.toString())
    params.delete(CREATED_PARAM)
    const rest = params.toString()
    router.replace(rest ? `${pathname}?${rest}` : pathname, { scroll: false })
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Request {request.requestId} is recorded</DialogTitle>
          <DialogDescription>
            {waiting} line{waiting === 1 ? "" : "s"} still need{waiting === 1 ? "s" : ""} a reservation in SAP.
          </DialogDescription>
        </DialogHeader>
        <ol className="flex flex-col gap-4 text-sm">
          <Step icon={ClipboardList} title="Create the reservation in SAP">
            Create one reservation for this request and type{" "}
            <span className="font-mono font-semibold text-foreground">{request.requestId}</span> into its header text.
          </Step>
          <Step icon={Link2} title="We link it to this request">
            The link is made when the next SAP data is loaded. To link it sooner, press Link reservation on this page.
          </Step>
          <Step icon={Bell} title="We notify you">
            You&rsquo;ll get a notification once the reservation is linked. If it isn&rsquo;t linked within a day,
            we&rsquo;ll send you a reminder.
          </Step>
        </ol>
        <DialogFooter className="gap-2 sm:justify-between [&_[data-slot=button]]:min-h-11">
          <CopyReferenceButton value={request.requestId} />
          <Button type="button" variant="outline" size="lg" className="px-5 font-semibold" onClick={close}>
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Step({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Bell
  title: string
  children: React.ReactNode
}) {
  return (
    <li className="flex gap-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-action/10 text-action">
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="font-semibold text-foreground">{title}</span>
        <span className="text-muted-foreground">{children}</span>
      </span>
    </li>
  )
}
