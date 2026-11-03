import { describe, expect, it } from "vitest"

import type { ApiLinkJob, ApiLinkJobStep, LinkJobStepStatus } from "@/lib/api/assistant-requests"

import { EXPECTATION, headline, isActive, progressOf, shouldReload, stepperSteps } from "./link-job"

const KEYS = ["queue", "delta", "link", "i13", "i08"] as const

function job(statuses: LinkJobStepStatus[], overrides: Partial<ApiLinkJob> = {}): ApiLinkJob {
  const steps: ApiLinkJobStep[] = KEYS.map((key, i) => ({
    key,
    label: `Step ${key}`,
    status: statuses[i] ?? "pending",
    startedAt: null,
    finishedAt: null,
    detail: null,
  }))
  return {
    id: 7,
    requestId: "RRXVC7GKT6",
    status: "running",
    step: "delta",
    steps,
    requestedAt: "2026-11-03T09:00:00Z",
    startedAt: null,
    finishedAt: null,
    links: null,
    error: null,
    created: true,
    ...overrides,
  }
}

describe("isActive", () => {
  it("is true only while queued or running", () => {
    expect(isActive(job([], { status: "queued" }))).toBe(true)
    expect(isActive(job([], { status: "running" }))).toBe(true)
    expect(isActive(job([], { status: "succeeded" }))).toBe(false)
    expect(isActive(job([], { status: "failed" }))).toBe(false)
    expect(isActive(job([], { status: "abandoned" }))).toBe(false)
    expect(isActive(null)).toBe(false)
  })
})

describe("progressOf", () => {
  it("counts finished steps out of five", () => {
    expect(progressOf(job(["done", "active"]))).toBe(20)
    expect(progressOf(job(["done", "done", "done", "active"]))).toBe(60)
    expect(progressOf(job(["done", "skipped", "pending"]))).toBe(40)
  })

  it("is 100 once the job succeeded, whatever the steps say", () => {
    expect(progressOf(job(["done", "done", "done", "done", "done"], { status: "succeeded" }))).toBe(100)
  })
})

describe("headline", () => {
  it("names the step being worked on", () => {
    expect(headline(job(["done", "active"]))).toBe("Step 2 of 5: Step delta")
  })

  it("says it is waiting before anything started", () => {
    expect(headline(job([], { status: "queued" }))).toBe("Waiting to start")
  })

  it("reports the outcome with the link count", () => {
    expect(headline(job([], { status: "succeeded", links: 2 }))).toBe("Done: 2 reservation items linked")
    expect(headline(job([], { status: "succeeded", links: 1 }))).toBe("Done: 1 reservation item linked")
    expect(headline(job([], { status: "succeeded", links: 0 }))).toBe("Done: no reservation names this request yet")
    expect(headline(job([], { status: "failed" }))).toBe("Stopped: a step failed")
    expect(headline(job([], { status: "abandoned" }))).toBe("Stopped: the job was interrupted")
  })
})

describe("stepperSteps", () => {
  it("maps the API statuses onto the stepper's, a failed step in red", () => {
    const steps = stepperSteps(job(["done", "failed", "pending", "skipped"]))
    expect(steps.map((s) => s.status)).toEqual(["done", "rejected", "pending", "skipped", "pending"])
    expect(steps[1].tone).toBe("danger")
    expect(steps[0].tone).toBe("default")
  })

  it("carries the step's detail as the meta line", () => {
    const j = job(["done"])
    j.steps[0].detail = "Started"
    expect(stepperSteps(j)[0].meta).toBe("Started")
    expect(stepperSteps(j)[1].meta).toBeUndefined()
  })
})

describe("shouldReload", () => {
  it("reloads the request when the link step has just finished", () => {
    expect(shouldReload(job(["done", "done", "active"]), job(["done", "done", "done", "active"]))).toBe(true)
  })

  it("reloads when the job has just ended, and not on every poll", () => {
    const running = job(["done", "done", "done", "active"])
    expect(shouldReload(running, job(["done", "done", "done", "active"]))).toBe(false)
    expect(shouldReload(running, job(["done", "done", "done", "failed"], { status: "failed" }))).toBe(true)
    expect(shouldReload(running, job(["done", "done", "done", "done", "done"], { status: "succeeded" }))).toBe(true)
  })

  it("never reloads for a different job or on the first sight of one", () => {
    expect(shouldReload(null, job(["done", "done", "done"]))).toBe(false)
    expect(shouldReload(job(["done"], { id: 6 }), job(["done", "done", "done"], { id: 7 }))).toBe(false)
  })
})

describe("the expectation line", () => {
  it("tells the person when the link shows and that the window can be closed", () => {
    expect(EXPECTATION).toContain("after step 3")
    expect(EXPECTATION).toContain("close this window")
    expect(EXPECTATION).not.toMatch(/\bI\s?0?(7|8|13)\b/i)
  })
})
