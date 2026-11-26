// A Min-Max to OAR conversion request on screen: its words, its place in the chain, and what the signed-in
// person may do. The rules themselves are the backend's; these tests pin what is offered and said.

import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

import {
  actionNeedsComment,
  availableActions,
  chainSteps,
  isRequestOpen,
  requestStatusLabel,
  requestStatusTone,
  requestSummary,
} from "@/features/initiative-7/utils/reverse-request-state"

const SRC = join(__dirname, "..", "..", "..")
const read = (relative: string) => readFileSync(join(SRC, relative), "utf8")
const I7 = "features/initiative-7"

const ROUTE = ["Inventory Controller", "Engineering Head", "Plant Head", "Commercial Head"]

describe("status wording", () => {
  it("names each status the way a planner reads it", () => {
    expect(requestStatusLabel("PENDING_APPROVAL")).toBe("Pending approval")
    expect(requestStatusLabel("SENT_BACK")).toBe("Sent back")
    expect(requestStatusLabel("HELD")).toBe("On hold")
    expect(requestStatusLabel("REJECTED")).toBe("Rejected")
    expect(requestStatusLabel("SAP_EXECUTION_PENDING")).toBe("Approved")
    expect(requestStatusLabel("SOMETHING_NEW")).toBe("SOMETHING_NEW")
  })

  it("colours approved green, rejected red, anything in progress amber", () => {
    expect(requestStatusTone("SAP_EXECUTION_PENDING")).toBe("success")
    expect(requestStatusTone("REJECTED")).toBe("danger")
    for (const status of ["PENDING_APPROVAL", "SENT_BACK", "HELD"]) expect(requestStatusTone(status)).toBe("warning")
  })

  it("summarises a request on one line for a list row", () => {
    expect(requestSummary("PENDING_APPROVAL", "Engineering Head")).toBe("Pending approval · waiting for Engineering Head")
    expect(requestSummary("HELD", "Plant Head")).toBe("On hold · waiting for Plant Head")
    expect(requestSummary("SAP_EXECUTION_PENDING", null)).toBe("Approved — SAP change pending")
    expect(requestSummary("REJECTED", null)).toBe("Conversion rejected")
  })
})

describe("which requests block another", () => {
  it("is open while in the chain or approved and waiting for SAP, and closed once rejected or never raised", () => {
    for (const status of ["PENDING_APPROVAL", "SENT_BACK", "HELD", "SAP_EXECUTION_PENDING"]) expect(isRequestOpen(status)).toBe(true)
    for (const status of ["REJECTED", null, undefined, ""]) expect(isRequestOpen(status)).toBe(false)
  })
})

describe("the chain", () => {
  it("shows the first role up next on a new request", () => {
    expect(chainSteps(ROUTE, 0, "PENDING_APPROVAL").map((s) => s.state)).toEqual(["current", "waiting", "waiting", "waiting"])
  })

  it("marks the roles that have approved and the one up now", () => {
    expect(chainSteps(ROUTE, 2, "PENDING_APPROVAL").map((s) => s.state)).toEqual(["done", "done", "current", "waiting"])
  })

  it("marks every role done once the last has approved", () => {
    expect(chainSteps(ROUTE, 4, "SAP_EXECUTION_PENDING").map((s) => s.state)).toEqual(["done", "done", "done", "done"])
  })

  it("shows no role as up now on a rejected request", () => {
    expect(chainSteps(ROUTE, 1, "REJECTED").map((s) => s.state)).toEqual(["done", "waiting", "waiting", "waiting"])
  })

  it("keeps the route's own order and names", () => {
    expect(chainSteps(ROUTE, 0, "PENDING_APPROVAL").map((s) => s.role)).toEqual(ROUTE)
  })
})

describe("what the person acting may do", () => {
  it("offers nothing to a role that does not hold the pending step", () => {
    expect(availableActions("PENDING_APPROVAL", "Engineering Head", "Inventory Controller")).toEqual([])
    expect(availableActions("PENDING_APPROVAL", "Engineering Head", "End User")).toEqual([])
    expect(availableActions("PENDING_APPROVAL", null, "Plant Head")).toEqual([])
  })

  it("offers approve, send back, hold and reject to the pending role, and never Adjust", () => {
    const offered = availableActions("PENDING_APPROVAL", "Plant Head", "Plant Head")
    expect(offered).toEqual(["APPROVE", "SEND_BACK", "HOLD", "REJECT"])
    expect(offered).not.toContain("ADJUST" as never)
  })

  it("offers only Release hold on a request that is on hold", () => {
    expect(availableActions("HELD", "Plant Head", "Plant Head")).toEqual(["RELEASE_HOLD"])
  })

  it("offers nothing on a request that has ended", () => {
    expect(availableActions("REJECTED", null, "Plant Head")).toEqual([])
    expect(availableActions("SAP_EXECUTION_PENDING", null, "Commercial Head")).toEqual([])
  })

  it("asks for a comment on reject, send back and hold, as the backend does", () => {
    expect(["REJECT", "SEND_BACK", "HOLD"].every((a) => actionNeedsComment(a as never))).toBe(true)
    expect(actionNeedsComment("APPROVE")).toBe(false)
    expect(actionNeedsComment("RELEASE_HOLD")).toBe(false)
  })
})

describe("the Convert to OAR section", () => {
  const section = read(`${I7}/components/min-max-to-oar-convert.tsx`)

  it("has a Convert to OAR button for an Eligible material with no open request", () => {
    expect(section).toContain("Convert to OAR")
    expect(section).toContain('row.conversion_eligibility !== "eligible"')
    expect(section).toContain("if (row.conversion_eligibility !== \"eligible\") return null")
    expect(section).toContain("{!open && (")
  })

  it("lets someone ask again after a rejection, and shows why it was rejected", () => {
    expect(section).toContain("The earlier request stays in the history. Asking again starts the approval chain again from its first role.")
    expect(section).toContain('entry.action === "REJECT"')
    expect(section).toContain("Reason: {rejectionReason}")
  })

  it("is laid out like the OAR panel's not-submitted state, with the Convert to OAR label kept", () => {
    expect(section).toContain("Not yet submitted — converting it to OAR starts the approval chain with the first role in its route.")
    expect(section).toMatch(/<Send className="size-3\.5" \/>\s*Convert to OAR/)
    expect(section).toMatch(/<CircleX className="size-3\.5" \/>\s*Reject\s*<\/Button>/)
    expect(section).toContain("border-destructive/40 text-destructive hover:bg-destructive/10")
    expect(section).toContain("Not adopting it? Reject it here with a reason -- it does not need to go through approval first.")
    expect(section).not.toContain("Send for approval")
  })

  it("rejects with a required reason, confirmed or cancelled, without going through the chain", () => {
    expect(section).toContain("Reason for rejecting (required)")
    expect(section).toContain("disabled={busy || rejectReason.trim().length === 0}")
    expect(section).toContain("Confirm reject")
    expect(section).toContain("Cancel")
    expect(section).toContain("await decline(rejectReason.trim())")
  })

  it("no longer asks for a comment when converting: the button just sends it", () => {
    expect(section).toContain("await submit()")
    expect(section).not.toContain("Why you are asking (optional)")
  })

  it("acts as the approval role the token holds, like the OAR decision panel", () => {
    expect(section).toContain("resolveActingRole")
    expect(section).toContain("useRoles()")
    expect(section).toContain("availableActions(current.status, current.pending_role, actingRole)")
  })

  it("will not send a reject, send back or hold without a comment", () => {
    expect(section).toContain("actionNeedsComment(action) && comment.trim() === \"\"")
  })

  it("shows the chain, the history, and that nothing is written to SAP", () => {
    expect(section).toContain("chainSteps(current.route, current.chain_index, current.status)")
    expect(section).toContain("<History entries={detail?.history ?? []} />")
    expect(section).toContain("nothing is written to SAP from this page")
  })
})

describe("what the page asks the backend", () => {
  it("raises and decides requests with POST, and reads their state with GET", () => {
    const api = read(`${I7}/services/reverse-conversion-requests-api.ts`)
    expect(api).toContain('"/v1/i7/reverse-conversion/requests"')
    expect(api).toContain("fetchReverseRequest")
    expect(api).toContain("`${REQUESTS_BASE}/${requestId}/actions`")
    expect(api).toContain("`${REQUESTS_BASE}/decline`")
    expect(api).toContain("actor_role: actorRole")
  })

  it("reloads from the backend after every write instead of assuming the outcome", () => {
    const hook = read(`${I7}/hooks/use-reverse-request.ts`)
    expect(hook).toContain("await call()\n        await load()")
    expect(hook).toContain("onChanged?.()")
  })

  it("the table shows where a request stands under the Eligible badge", () => {
    const table = read(`${I7}/components/min-max-to-oar-table.tsx`)
    expect(table).toContain("requestSummary(row.conversion_request.status, row.conversion_request.pending_role)")
  })

  it("the page says when the recommendation was last rebuilt", () => {
    const panels = read(`${I7}/components/min-max-to-oar-panels.tsx`)
    expect(panels).toContain("Last rebuilt")
    expect(panels).toContain("anchor.generated_at")
  })
})

describe("where the Convert to OAR block sits, and when it cannot be used", () => {
  const detail = read(`${I7}/components/min-max-to-oar-detail.tsx`)
  const section = read(`${I7}/components/min-max-to-oar-convert.tsx`)
  const hook = read(`${I7}/hooks/use-reverse-request.ts`)

  it("is below the material's own figures (criticality, lead time ... unit price), not above them", () => {
    expect(detail.indexOf("<ConvertToOarSection")).toBeGreaterThan(detail.indexOf('<Fact label="Unit price (ZAR)">'))
    expect(detail.indexOf("<ConvertToOarSection")).toBeGreaterThan(detail.indexOf("</dl>", detail.indexOf('<Fact label="Criticality">')))
  })

  it("keeps the alternative card next to the recommended card, above the figures", () => {
    expect(detail.indexOf("If you keep it on Min-Max")).toBeLessThan(detail.indexOf('<Fact label="Criticality">'))
  })

  it("offers no buttons when the server has no conversion-request endpoints, and says so without the raw URL", () => {
    expect(hook).toContain("failure instanceof ApiError && failure.status === 404")
    expect(section).toContain("Conversion requests are not available on this server yet")
    expect(section).toContain("The conversion request could not be loaded")
    // The buttons are only in the branch where the request loaded.
    expect(section.indexOf("unavailable ? (")).toBeLessThan(section.indexOf("Convert to OAR\n                </Button>"))
  })
})
