/**
 * What the Link reservation window shows for a job, worked out from the API's
 * row. Pure, so the wording and the progress maths are tested without React.
 */

import type { ApiLinkJob, ApiLinkJobStep, LinkJobStepKey } from "@/lib/api/assistant-requests"
import type { WorkflowStep } from "@/components/shared/workflow-stepper"

/** The job is still going: the page keeps asking how it is doing. */
export function isActive(job: ApiLinkJob | null | undefined): boolean {
  return job?.status === "queued" || job?.status === "running"
}

/** How much of the job is behind it, 0-100, counting finished steps. */
export function progressOf(job: ApiLinkJob): number {
  if (job.status === "succeeded") return 100
  const total = job.steps.length || 1
  const done = job.steps.filter((s) => s.status === "done" || s.status === "skipped").length
  return Math.round((done / total) * 100)
}

/** "Step 2 of 5" while running; the outcome afterwards. */
export function headline(job: ApiLinkJob): string {
  if (job.status === "succeeded") {
    return job.links ? `Done: ${job.links} reservation item${job.links === 1 ? "" : "s"} linked` : "Done: no reservation names this request yet"
  }
  if (job.status === "failed") return "Stopped: a step failed"
  if (job.status === "abandoned") return "Stopped: the job was interrupted"
  const index = job.steps.findIndex((s) => s.status === "active")
  if (index < 0) return job.status === "queued" ? "Waiting to start" : "Finishing"
  return `Step ${index + 1} of ${job.steps.length}: ${job.steps[index].label}`
}

/** The steps as the stepper draws them. */
export function stepperSteps(job: ApiLinkJob): WorkflowStep[] {
  return job.steps.map((step) => ({
    id: step.key,
    label: step.label,
    status: stepStatus(step),
    meta: step.detail ?? undefined,
    tone: step.status === "failed" ? "danger" : "default",
  }))
}

function stepStatus(step: ApiLinkJobStep): WorkflowStep["status"] {
  switch (step.status) {
    case "done":
      return "done"
    case "active":
      return "active"
    case "failed":
      return "rejected"
    case "skipped":
      return "skipped"
    default:
      return "pending"
  }
}

/** The one line under the title: what the person can expect, in time. */
export const EXPECTATION =
  "The reservation link appears after step 3, usually within a few minutes. The two rebuilds that follow can take over an hour on production data; you can close this window and the page updates when they finish."

function statusOf(job: ApiLinkJob | null | undefined, key: LinkJobStepKey): string | undefined {
  return job?.steps.find((s) => s.key === key)?.status
}

/**
 * Whether the request page should reload its data between two polls: when the link
 * step has just finished (the chips can show the reservation now), and when the job
 * has just ended either way.
 */
export function shouldReload(previous: ApiLinkJob | null | undefined, next: ApiLinkJob): boolean {
  if (previous?.id !== next.id) return false
  const linkedNow = statusOf(previous, "link") !== "done" && statusOf(next, "link") === "done"
  const endedNow = isActive(previous) && !isActive(next)
  return linkedNow || endedNow
}
