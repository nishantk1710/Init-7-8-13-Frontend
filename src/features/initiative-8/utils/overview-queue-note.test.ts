import { describe, expect, it } from "vitest"

import { queueNote } from "@/features/initiative-8/utils/overview-view"

/**
 * An Overview card that opens a queue must not open a longer list than it
 * counted without saying so. The register narrows by plant, vendor and
 * criticality; the queues do not.
 */
describe("queueNote", () => {
  it("says nothing when the queue can narrow the way the Overview did", () => {
    expect(queueNote({}, "declarations")).toBeUndefined()
    expect(queueNote({}, "exceptions")).toBeUndefined()
    // The declaration queue narrows by a vendor code.
    expect(queueNote({ vendor: "100234" }, "declarations")).toBeUndefined()
  })

  it("names criticality for both queues: neither has it", () => {
    expect(queueNote({ criticality: "IMPACT" }, "declarations")).toContain("criticality")
    expect(queueNote({ criticality: "none" }, "exceptions")).toContain("criticality")
  })

  it("names the vendor for the exception queue, which narrows by plant alone", () => {
    expect(queueNote({ vendor: "100234" }, "exceptions")).toContain("vendor")
  })

  it("names the vendor for the declaration queue only when it is `none`", () => {
    expect(queueNote({ vendor: "none" }, "declarations")).toContain("vendor")
  })

  it("joins what is lost", () => {
    expect(queueNote({ vendor: "100234", criticality: "IMPACT" }, "exceptions")).toBe(
      "The queue does not narrow by vendor or criticality, so it opens wider than this count.",
    )
  })
})
