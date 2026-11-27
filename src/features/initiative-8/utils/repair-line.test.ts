import { describe, expect, it } from "vitest"

import type { RepairChain } from "@/features/initiative-8/types/repair"
import { repairPrLabel } from "@/features/initiative-8/utils/repair-line"
import { requestedAgoShort } from "@/features/initiative-8/utils/repair-request"

/**
 * How a register row names itself, in the list and its export: what tells
 * seven rows of one material apart. The PR rather than the PO since
 * 27-Nov-2026 -- one heading cannot mean a PO on one row and a PR on the next.
 */

type LineParts = Pick<RepairChain, "lineKind" | "repairPO" | "repairPR">

const poRow: LineParts = {
  lineKind: "PO",
  repairPR: { type: "PR", documentNumber: "2000029034", line: "10" },
  repairPO: { type: "PO", documentNumber: "4500001719", line: "10" },
}

const prRow: LineParts = {
  lineKind: "PR",
  repairPR: { type: "PR", documentNumber: "2000028756", line: "10" },
}

describe("repairPrLabel", () => {
  it("names a PO line by the PR it was raised from, not by its PO", () => {
    expect(repairPrLabel(poRow)).toBe("2000029034/10")
  })

  it("names a PR row by that PR, with no prefix to tell it apart", () => {
    expect(repairPrLabel(prRow)).toBe("2000028756/10")
  })

  it("leaves out an item SAP did not send", () => {
    expect(repairPrLabel({ ...prRow, repairPR: { type: "PR", documentNumber: "2000028756" } })).toBe("2000028756")
  })

  it("falls back to the PO, marked, where SAP has no PR for the line", () => {
    // The API sends an empty document number, not a missing field.
    expect(repairPrLabel({ ...poRow, repairPR: { type: "PR", documentNumber: "" } })).toBe("PO 4500001719/10")
  })

  it("says nothing rather than something wrong when the row has neither", () => {
    expect(repairPrLabel({ lineKind: "PR", repairPR: { type: "PR", documentNumber: "  " } })).toBe("—")
  })
})

describe("requestedAgoShort", () => {
  it("fits a narrow column, where the long form was cut off", () => {
    expect(requestedAgoShort(456)).toBe("456 d ago")
    expect(requestedAgoShort(1500)).toBe("1,500 d ago")
    expect(requestedAgoShort(0)).toBe("today")
    expect(requestedAgoShort(-3)).toBe("today")
  })
})
