import { describe, expect, it } from "vitest"

import type { RepairChain } from "@/features/initiative-8/types/repair"
import { repairLineLabel } from "@/features/initiative-8/utils/repair-line"
import { requestedAgoShort } from "@/features/initiative-8/utils/repair-request"

/**
 * The repair line as the register, its export and the notification log write
 * it (28-Oct-2026): what tells seven rows of one material apart.
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

describe("repairLineLabel", () => {
  it("writes a PO row as its PO and item, the way SAP people do", () => {
    expect(repairLineLabel(poRow)).toBe("4500001719/10")
  })

  it("writes a PR row as its PR, marked PR", () => {
    expect(repairLineLabel(prRow)).toBe("PR 2000028756/10")
  })

  it("treats a row with no PO as a PR row, whatever it says", () => {
    expect(repairLineLabel({ ...prRow, lineKind: "PO" })).toBe("PR 2000028756/10")
  })

  it("leaves out an item SAP did not send", () => {
    expect(repairLineLabel({ ...poRow, repairPO: { type: "PO", documentNumber: "4500001719" } })).toBe("4500001719")
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
