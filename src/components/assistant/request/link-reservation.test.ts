/**
 * The Link reservation button is on the request page and talks to the backend's
 * job routes. Source-reading checks (the component is interactive, and the suite
 * has no DOM), the way page-loaders-wired.test.ts checks its wiring.
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8")
const page = read("src/components/assistant/request/request-summary.tsx")
const component = read("src/components/assistant/request/link-reservation.tsx")
const api = read("src/lib/api/assistant-requests.ts")

describe("Link reservation wiring", () => {
  it("is in the request page's action row and reloads the request when the link lands", () => {
    expect(page).toContain('from "@/components/assistant/request/link-reservation"')
    expect(page).toContain("<LinkReservation requestId={request.requestId} onLinked={reload} />")
  })

  it("starts the job and polls the same route the backend serves", () => {
    expect(api).toContain("/link-reservation`")
    expect(api).toMatch(/startLinkReservation[\s\S]*apiPost<ApiLinkJob>/)
    expect(api).toMatch(/getLinkReservation[\s\S]*apiFetch<ApiLinkJob>/)
    expect(component).toContain("startLinkReservation(requestId)")
    expect(component).toContain("getLinkReservation(requestId)")
  })

  it("keeps polling only while the job is active, and not in a hidden tab", () => {
    expect(component).toContain("if (!active) return")
    expect(component).toContain("document.hidden")
  })

  it("shows the progress bar, the steps and the outcome, and offers to run again", () => {
    expect(component).toContain('role="progressbar"')
    expect(component).toContain("<WorkflowStepper")
    expect(component).toContain("Run again")
    expect(component).toContain("Already running")
  })

  it("never names a module to the person", () => {
    const shown = component.match(/"[^"]*"/g)?.join(" ") ?? ""
    expect(shown).not.toMatch(/\bI\s?0?(7|8|13)\b/)
  })
})
