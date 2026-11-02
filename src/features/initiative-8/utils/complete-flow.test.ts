import { describe, expect, it } from "vitest"

import type { RepairChain } from "@/features/initiative-8/types/repair"
import {
  CHECKS_BEFORE_COMPLETE_FLOW,
  exceptionTypesShown,
  withoutCompleteFlow,
} from "@/features/initiative-8/utils/complete-flow"

const EVERY_TYPE = [
  "MISSING_ATTESTATION",
  "REPAIR_PR_NOT_DECLARED",
  "REPAIRED_AGAINST_ASSESSMENT",
  "DECLARED_NO_REPAIR_PR",
  "OVERDUE_REPAIR",
  "UNJUSTIFIED_ACQUISITION",
  "MISSING_SESSION_ID",
]

describe("exceptionTypesShown", () => {
  it("shows every type, in order, with the complete flow on", () => {
    expect(exceptionTypesShown(EVERY_TYPE, true)).toEqual(EVERY_TYPE)
  })

  it("shows only the checks from before the flow when it is off", () => {
    expect(exceptionTypesShown(EVERY_TYPE, false)).toEqual(["MISSING_ATTESTATION", "OVERDUE_REPAIR"])
    expect(CHECKS_BEFORE_COMPLETE_FLOW).toEqual(["MISSING_ATTESTATION", "OVERDUE_REPAIR"])
  })

  it("still shows a type that holds items, so nothing raised is unreachable", () => {
    const counts = { MISSING_ATTESTATION: 3, OVERDUE_REPAIR: 0, UNJUSTIFIED_ACQUISITION: 2, MISSING_SESSION_ID: 0 }
    expect(exceptionTypesShown(EVERY_TYPE, false, { counts })).toEqual([
      "MISSING_ATTESTATION",
      "OVERDUE_REPAIR",
      "UNJUSTIFIED_ACQUISITION",
    ])
  })

  it("keeps the selected type, so a stale link still names its tab", () => {
    expect(exceptionTypesShown(EVERY_TYPE, false, { selected: "REPAIR_PR_NOT_DECLARED" })).toEqual([
      "MISSING_ATTESTATION",
      "REPAIR_PR_NOT_DECLARED",
      "OVERDUE_REPAIR",
    ])
  })

  it("does not change the list it was given", () => {
    const types = [...EVERY_TYPE]
    exceptionTypesShown(types, false)
    expect(types).toEqual(EVERY_TYPE)
  })
})

describe("withoutCompleteFlow", () => {
  const chain = {
    id: "4500001052-10",
    stockOnHand: 5,
    usableStock: 3,
    damagedStock: 2,
    stockConditionKnown: true,
    declarationSessionId: "S-1",
    declarationLink: "REFERENCE",
    declarationStatus: "Completed",
  } as unknown as RepairChain

  it("takes out the stock split, the session and the R-reference link", () => {
    const shown = withoutCompleteFlow(chain)
    expect(shown.usableStock).toBeUndefined()
    expect(shown.damagedStock).toBeUndefined()
    expect(shown.stockConditionKnown).toBeUndefined()
    expect(shown.declarationSessionId).toBeUndefined()
    expect(shown.declarationLink).toBeUndefined()
  })

  it("keeps everything else, the stock total included", () => {
    const shown = withoutCompleteFlow(chain)
    expect(shown.id).toBe("4500001052-10")
    expect(shown.stockOnHand).toBe(5)
    expect(shown.declarationStatus).toBe("Completed")
  })

  it("keeps the links that do not come from the complete flow", () => {
    for (const link of ["BOUND", "WINDOW"] as const) {
      expect(withoutCompleteFlow({ ...chain, declarationLink: link }).declarationLink).toBe(link)
    }
  })

  it("leaves the line it was given alone", () => {
    withoutCompleteFlow(chain)
    expect(chain.usableStock).toBe(3)
    expect(chain.declarationSessionId).toBe("S-1")
  })
})
