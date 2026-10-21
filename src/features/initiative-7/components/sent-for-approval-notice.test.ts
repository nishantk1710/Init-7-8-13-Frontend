// After Send for approval a recommendation page shows where the recommendation is and points to the Action
// Center. It must not offer any approval action.

import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { SentForApprovalNotice } from "./sent-for-approval-notice"

const html = renderToStaticMarkup(
  createElement(SentForApprovalNotice, { pendingRole: "Inventory Controller", step: 1, steps: 4 }),
)

describe("SentForApprovalNotice", () => {
  it("says it was sent, which step is waiting, and for whom", () => {
    expect(html).toContain("Sent for approval")
    expect(html).toContain("step 1 of 4")
    expect(html).toContain("Inventory Controller")
  })

  it("says it is decided in the Action Center and links there", () => {
    expect(html).toContain("decided in the")
    expect(html).toContain("Action Center")
    expect(html).toContain('href="/actions"')
    expect(html).toContain("Open Action Center")
  })

  it("offers no approval action", () => {
    for (const action of ["Approve", "Reject", "Send back", "Adjust", "Hold"]) expect(html).not.toContain(action)
  })
})
