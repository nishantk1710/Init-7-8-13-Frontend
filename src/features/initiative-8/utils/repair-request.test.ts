import { describe, expect, it } from "vitest"

import { stageLabel } from "@/features/initiative-8/utils/format"
import {
  NO_PO_YET,
  REPAIR_REQUESTED,
  repairRequestBanner,
  repairRequestsNote,
  requestedAgo,
  requesterText,
} from "@/features/initiative-8/utils/repair-request"

/**
 * How a repair requested with no PO yet reads (27-Oct-2026). One module, so
 * the register, its Excel file, the repair page and the Overview say the same
 * thing.
 */

describe("the words", () => {
  it("calls the PR stage Repair requested, everywhere stages are named", () => {
    expect(stageLabel("PR Raised")).toBe("Repair requested")
    expect(REPAIR_REQUESTED).toBe("Repair requested")
    expect(stageLabel("PO Issued")).toBe("PO issued")
  })

  it("says No PO yet, the same as the due-date filter", () => {
    expect(NO_PO_YET).toBe("No PO yet")
  })
})

describe("requestedAgo", () => {
  it("counts days since the request", () => {
    expect(requestedAgo(0)).toBe("requested today")
    expect(requestedAgo(1)).toBe("requested 1 day ago")
    expect(requestedAgo(12)).toBe("requested 12 days ago")
    expect(requestedAgo(1500)).toBe("requested 1,500 days ago")
  })

  it("reads a date after the reference date as today, never as negative days", () => {
    expect(requestedAgo(-2)).toBe("requested today")
  })
})

describe("requesterText", () => {
  it("shows code and department name when the name is known", () => {
    expect(requesterText({ requester: "10305", requesterName: "Engineering" })).toBe("10305 · Engineering")
  })

  it("shows the bare code when it is not, never a guessed name", () => {
    expect(requesterText({ requester: "10305" })).toBe("10305")
  })

  it("shows nothing when there is no requester", () => {
    expect(requesterText({ requesterName: "Engineering" })).toBeUndefined()
  })
})

describe("repairRequestBanner", () => {
  it("names the department, with its name when known", () => {
    const banner = repairRequestBanner({ daysOpen: 12, requester: "10305", requesterName: "Engineering" })
    expect(`${banner.lead} ${banner.rest}`).toBe(
      "No PO yet. Repair requested 12 days ago by department 10305 (Engineering).",
    )
  })

  it("names the code alone when the name is not known", () => {
    expect(repairRequestBanner({ daysOpen: 1, requester: "10305" }).rest).toBe(
      "Repair requested 1 day ago by department 10305.",
    )
  })

  it("leaves the department out when there is none", () => {
    expect(repairRequestBanner({ daysOpen: 0 }).rest).toBe("Repair requested today.")
  })
})

describe("repairRequestsNote", () => {
  it("counts the requests when the backend serves them", () => {
    expect(repairRequestsNote(true, 3)).toBe("+3 repairs requested, no PO yet")
    expect(repairRequestsNote(true, 1)).toBe("+1 repair requested, no PO yet")
    expect(repairRequestsNote(true, 1250)).toBe("+1,250 repairs requested, no PO yet")
  })

  it("says nothing while the switch is off, whatever was counted", () => {
    expect(repairRequestsNote(false, 3)).toBeUndefined()
  })

  it("says nothing for none, or for a count an older backend never made", () => {
    expect(repairRequestsNote(true, 0)).toBeUndefined()
    expect(repairRequestsNote(true, undefined)).toBeUndefined()
  })
})
