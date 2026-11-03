"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Link2, Loader2, RefreshCw } from "lucide-react"
import { toast } from "sonner"

import { AlertBanner } from "@/components/shared/alert-banner"
import { WorkflowStepper } from "@/components/shared/workflow-stepper"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { getLinkReservation, startLinkReservation, type ApiLinkJob } from "@/lib/api/assistant-requests"
import { ApiError } from "@/lib/api/client"
import { EXPECTATION, headline, isActive, progressOf, shouldReload, stepperSteps } from "@/lib/assistant/request/link-job"
import { formatInstant } from "@/lib/assistant/trace-format"

/** How often the window asks how the job is doing while it runs. */
const POLL_MS = 4_000

/**
 * "Link reservation": pull the latest SAP data, link this request's reservations,
 * rebuild the two views -- and a window that follows the job step by step.
 *
 * The job lives on the backend; this only starts it and watches it, so a page
 * refresh, another tab or a colleague all see the same progress. While a job is
 * running the button turns into "Linking…" and reopens the window.
 */
export function LinkReservation({ requestId, onLinked }: { requestId: string; onLinked: () => void }) {
  const [job, setJob] = useState<ApiLinkJob | null>(null)
  const [open, setOpen] = useState(false)
  const [starting, setStarting] = useState(false)
  const previous = useRef<ApiLinkJob | null>(null)
  const active = isActive(job)

  const take = useCallback(
    (next: ApiLinkJob) => {
      if (shouldReload(previous.current, next)) onLinked()
      previous.current = next
      setJob(next)
    },
    [onLinked]
  )

  // A job may already be running (started before this page loaded, or by someone else).
  useEffect(() => {
    let stopped = false
    getLinkReservation(requestId)
      .then((found) => {
        if (!stopped && found) {
          previous.current = found
          setJob(found)
        }
      })
      .catch(() => {
        /* nothing to show yet; the button still works */
      })
    return () => {
      stopped = true
    }
  }, [requestId])

  // While it runs, ask how it is going; the page reloads its own data when the link lands.
  useEffect(() => {
    if (!active) return
    let busy = false
    const timer = setInterval(() => {
      if (busy || document.hidden) return
      busy = true
      getLinkReservation(requestId)
        .then((found) => found && take(found))
        .catch(() => {
          /* keep waiting; the next tick asks again */
        })
        .finally(() => {
          busy = false
        })
    }, POLL_MS)
    return () => clearInterval(timer)
  }, [active, requestId, take])

  async function start() {
    setStarting(true)
    try {
      const started = await startLinkReservation(requestId)
      previous.current = started
      setJob(started)
      setOpen(true)
      if (!started.created) {
        toast.info("Already running", { description: "A Link reservation job for this request is in progress." })
      }
    } catch (error) {
      toast.error("Could not start", {
        description: error instanceof ApiError ? error.detailText() : "The backend did not answer.",
      })
    }
    setStarting(false)
  }

  return (
    <>
      <Button
        type="button"
        size="lg"
        className="min-h-11 px-4 font-semibold"
        disabled={starting}
        onClick={active ? () => setOpen(true) : start}
      >
        {starting || active ? <Loader2 className="animate-spin" /> : <Link2 />}
        {active ? "Linking… view progress" : "Link reservation"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="size-4" /> Link reservation
            </DialogTitle>
            <DialogDescription>{EXPECTATION}</DialogDescription>
          </DialogHeader>

          {job && <Progress job={job} />}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Close
            </Button>
            {job && !isActive(job) && (
              <Button type="button" variant="outline" disabled={starting} onClick={start}>
                {starting ? <Loader2 className="animate-spin" /> : <RefreshCw />} Run again
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function Progress({ job }: { job: ApiLinkJob }) {
  const percent = progressOf(job)
  const running = isActive(job)
  return (
    <div className="flex flex-col gap-4" data-testid="link-job-progress">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="flex items-center gap-2 font-medium text-foreground">
            {running && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {headline(job)}
          </span>
          <span className="text-xs text-muted-foreground">{percent}%</span>
        </div>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-label="Link reservation progress"
          className="h-2 w-full overflow-hidden rounded-full bg-muted"
        >
          <div
            className={`h-full rounded-full transition-[width] duration-500 ${
              job.status === "failed" || job.status === "abandoned" ? "bg-destructive" : "bg-action"
            }`}
            style={{ width: `${percent}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground">
          Started {formatInstant(job.requestedAt)}
          {job.finishedAt ? ` · finished ${formatInstant(job.finishedAt)}` : ""}
        </span>
      </div>

      {job.status === "failed" && job.error && <AlertBanner tone="critical" title="The job stopped">{job.error}</AlertBanner>}
      {job.status === "abandoned" && job.error && <AlertBanner tone="warning" title="The job was interrupted">{job.error}</AlertBanner>}

      <WorkflowStepper title="Steps" steps={stepperSteps(job)} />
    </div>
  )
}
