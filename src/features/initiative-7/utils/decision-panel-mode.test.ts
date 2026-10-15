// "Chain complete" must only ever mean an approval chain was actually finished.
//
// It used to appear on a recommendation that had not been calculated (status NOT_EVALUABLE):
// nothing was submitted, so no approver was waiting, and "nobody waiting" was read as "done".

import { describe, expect, it } from "vitest"

import { decisionPanelMode } from "./decision-panel-mode"

describe("decisionPanelMode", () => {
  it("says a recommendation that was never calculated is not reviewable, never complete", () => {
    expect(decisionPanelMode("NOT_EVALUABLE", null)).toBe("not-reviewable")
  })

  it("offers submission for a calculated recommendation that has not been sent", () => {
    expect(decisionPanelMode("READY_FOR_REVIEW", "End User")).toBe("ready-to-submit")
    expect(decisionPanelMode("READY_FOR_REVIEW", null)).toBe("ready-to-submit")
  })

  it("shows the approval steps while someone is waiting to decide", () => {
    expect(decisionPanelMode("PENDING_APPROVAL", "Plant Head")).toBe("awaiting-approval")
    expect(decisionPanelMode("SENT_BACK", "End User")).toBe("awaiting-approval")
    expect(decisionPanelMode("HELD", "Plant Head")).toBe("awaiting-approval")
  })

  it("shows a rejected recommendation as rejected", () => {
    expect(decisionPanelMode("REJECTED", null)).toBe("rejected")
  })

  it.each(["APPROVED", "SAP_EXECUTION_PENDING", "SAP_EXECUTED", "ADOPTED", "PARTIALLY_ADOPTED", "NOT_ADOPTED"])(
    "says the chain is complete for %s",
    (status) => {
      expect(decisionPanelMode(status, null)).toBe("chain-complete")
    },
  )

  it.each(["", "ADJUSTED", "SOMETHING_NEW", "Pending Review"])(
    "does not claim completion for %j with nobody waiting",
    (status) => {
      expect(decisionPanelMode(status, null)).toBe("no-pending-step")
    },
  )

  it("never reports complete unless the status says the chain was approved", () => {
    const statuses = [
      "NOT_EVALUABLE", "READY_FOR_REVIEW", "PENDING_APPROVAL", "SENT_BACK", "HELD", "REJECTED", "ADJUSTED", "",
    ]
    for (const status of statuses) {
      expect(decisionPanelMode(status, null)).not.toBe("chain-complete")
    }
  })

  it("is not fooled by the label the table shows (the original bug)", () => {
    // The panel used to be handed "Pending Review" / "Rejected" and compare them with backend codes.
    expect(decisionPanelMode("Pending Review", null)).not.toBe("chain-complete")
    expect(decisionPanelMode("Rejected", null)).not.toBe("chain-complete")
  })
})

import { panelContentFor } from "./decision-panel-mode"

describe("panelContentFor: sending is on the recommendation page, deciding is on the Action Center", () => {
  it("offers Send for approval on a recommendation page, and nothing to decide", () => {
    expect(panelContentFor("ready-to-submit", "recommendation")).toBe("submit-button")
  })

  it("never offers Send for approval on the Action Center", () => {
    expect(panelContentFor("ready-to-submit", "action-center")).toBe("not-submitted-note")
  })

  it("gives no approval buttons on a recommendation page once it is sent: it points to the Action Center", () => {
    expect(panelContentFor("awaiting-approval", "recommendation")).toBe("sent-notice")
  })

  it("gives the approval buttons only on the Action Center", () => {
    expect(panelContentFor("awaiting-approval", "action-center")).toBe("decision-controls")
  })

  it("shows the same final states on both: rejected, chain complete, not reviewable, nothing pending", () => {
    for (const mode of ["rejected", "chain-complete", "not-reviewable", "no-pending-step"] as const) {
      expect(panelContentFor(mode, "recommendation")).toBe(mode)
      expect(panelContentFor(mode, "action-center")).toBe(mode)
    }
  })

  it("never puts decision controls on a recommendation page, for any state", () => {
    const modes = ["not-reviewable", "ready-to-submit", "awaiting-approval", "rejected", "chain-complete", "no-pending-step"] as const
    for (const mode of modes) expect(panelContentFor(mode, "recommendation")).not.toBe("decision-controls")
  })
})
