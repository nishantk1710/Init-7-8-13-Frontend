import { describe, expect, it } from "vitest"

import {
  DECLARATION_DISPLAY,
  declarationAction,
  declarationDisplay,
  declarationFormProblem,
  declarationLinkLabel,
  emptyQueueText,
  exceptionDeclarationAction,
  isWaitingForDeclaration,
  optionalText,
  queueRowLine,
  repairLineOfId,
  waitingCount,
} from "@/features/initiative-8/utils/declaration"

describe("declarationDisplay", () => {
  it("Historical is muted and says why", () => {
    expect(DECLARATION_DISPLAY.Historical).toEqual({
      tone: "muted",
      label: "Historical",
      hint: "Raised before declarations began",
    })
    expect(declarationDisplay("Historical").label).toBe("Historical")
  })

  it("an unknown status reads as itself", () => {
    expect(declarationDisplay("Odd")).toEqual({ tone: "warn", label: "Odd" })
    expect(declarationDisplay("Completed").label).toBe("Declared")
  })
})

describe("declarationAction", () => {
  it("a declared line offers Amend, whatever its status", () => {
    expect(declarationAction("Completed", "ATT-1")).toBe("amend")
    expect(declarationAction("Flagged", "ATT-1")).toBe("amend")
    expect(declarationAction("Historical", "ATT-1")).toBe("amend")
  })

  it("an undeclared Historical line offers nothing; Required offers Declare", () => {
    expect(declarationAction("Historical", undefined)).toBeNull()
    expect(declarationAction("Required", null)).toBe("declare")
  })
})

describe("declarationAction on the Historical tab", () => {
  it("offers Declare on a Historical line there, voluntarily, and Amend once declared", () => {
    expect(declarationAction("Historical", undefined, { voluntary: true })).toBe("declare")
    expect(declarationAction("Historical", "ATT-1", { voluntary: true })).toBe("amend")
  })
})

describe("emptyQueueText", () => {
  it("says what is true when every open line is Historical", () => {
    // It used to say "Every repair line has a condition declaration" while
    // 211 open lines had none.
    expect(emptyQueueText(211, "27 Oct 2026")).toEqual({
      title: "Nothing to declare",
      body:
        "The 211 open lines were raised before declarations began on 27 Oct 2026. " +
        "They are under Historical, where any of them can still be declared.",
    })
  })

  it("leaves out a date it was not given, and counts one line as one", () => {
    expect(emptyQueueText(1, undefined).body).toBe(
      "The 1 open line was raised before declarations began. They are under Historical, where any of them can still be declared.",
    )
  })

  it("says nothing is waiting when there are no Historical lines, or their count is unknown", () => {
    expect(emptyQueueText(0, "27 Oct 2026").body).toBe("Nothing is waiting. New repair lines appear here when SAP raises them.")
    expect(emptyQueueText(undefined, undefined).title).toBe("Nothing to declare")
  })
})

describe("waiting", () => {
  it("counts Required only", () => {
    expect(isWaitingForDeclaration("Required")).toBe(true)
    expect(isWaitingForDeclaration("Flagged")).toBe(false)
    expect(isWaitingForDeclaration("Historical")).toBe(false)
    expect(waitingCount({ outstanding: 12, byStatus: { Required: 9, Flagged: 3 } })).toBe(9)
    expect(waitingCount({ outstanding: 12, byStatus: {} })).toBe(12)
  })
})

describe("declarationFormProblem", () => {
  const ok = {
    description: "Seal weeping",
    faultCategory: "SEAL_FAILURE",
    quantityValid: true,
    attestorName: "T. Mokoena",
    amending: false,
    amendmentReason: "",
  }

  it("a complete form has no problem", () => {
    expect(declarationFormProblem(ok)).toBeUndefined()
  })

  it("the typed name is required", () => {
    expect(declarationFormProblem({ ...ok, attestorName: "  " })).toBe("Type your name.")
  })

  it("an amendment needs a reason", () => {
    expect(declarationFormProblem({ ...ok, amending: true })).toBe("Say why this declaration is being amended.")
    expect(declarationFormProblem({ ...ok, amending: true, amendmentReason: "Wrong fault" })).toBeUndefined()
  })

  it("optional text is omitted when blank", () => {
    expect(optionalText("  ")).toBeUndefined()
    expect(optionalText(" Photo 4411 ")).toBe("Photo 4411")
  })
})

describe("declarationLinkLabel", () => {
  it("says how the declaration was matched", () => {
    expect(declarationLinkLabel("BOUND")).toBe("Declared")
    expect(declarationLinkLabel("REFERENCE")).toBe("Linked through the R-reference on the repair order")
    expect(declarationLinkLabel("WINDOW")).toBe("Matched by part and date")
  })

  it("claims nothing for no link or one it does not know", () => {
    expect(declarationLinkLabel(undefined)).toBeUndefined()
    expect(declarationLinkLabel(null)).toBeUndefined()
    expect(declarationLinkLabel("SOMETHING_NEW")).toBeUndefined()
  })
})

describe("repairLineOfId", () => {
  it("reads a PO line id", () => {
    expect(repairLineOfId("4100067718-10")).toEqual({
      repairDocument: "4100067718",
      repairItem: "10",
      repairDocumentType: "PO",
    })
  })

  it("reads a PR row id as the repair PR", () => {
    expect(repairLineOfId("PR-0010012345-00010")).toEqual({
      repairDocument: "0010012345",
      repairItem: "00010",
      repairDocumentType: "PR",
    })
  })

  it("binds nothing without an item", () => {
    expect(repairLineOfId(undefined)).toEqual({})
    expect(repairLineOfId("4100067718")).toEqual({})
  })
})

describe("queueRowLine", () => {
  it("binds a PO row to its repair PO line", () => {
    expect(
      queueRowLine({
        relatedRepairId: "4100067718-10",
        repairPO: { documentNumber: "4100067718", line: "10" },
      }),
    ).toEqual({ repairDocument: "4100067718", repairItem: "10", repairDocumentType: "PO" })
  })

  it("binds a PR row to its open repair PR", () => {
    expect(queueRowLine({ relatedRepairId: "PR-0010012345-00010" })).toEqual({
      repairDocument: "0010012345",
      repairItem: "00010",
      repairDocumentType: "PR",
    })
  })

  it("binds nothing on a row that names neither", () => {
    expect(queueRowLine({ relatedRepairId: "4100067718-10" })).toEqual({})
  })
})

describe("exceptionDeclarationAction", () => {
  const base = { stillDetected: true, preAutomation: false, plant: { plantId: "1300" } }

  it("offers Declare on the checks a first declaration clears", () => {
    expect(exceptionDeclarationAction({ ...base, type: "MISSING_ATTESTATION" })).toBe("declare")
    expect(exceptionDeclarationAction({ ...base, type: "REPAIR_PR_NOT_DECLARED" })).toBe("declare")
  })

  it("offers Amend on the checks about a declaration, when it is named", () => {
    expect(exceptionDeclarationAction({ ...base, type: "REPAIRED_AGAINST_ASSESSMENT", declarationId: "a1" })).toBe(
      "amend",
    )
    expect(exceptionDeclarationAction({ ...base, type: "DECLARED_NO_REPAIR_PR", declarationId: "a1" })).toBe("amend")
    expect(exceptionDeclarationAction({ ...base, type: "DECLARED_NO_REPAIR_PR" })).toBeNull()
  })

  it("offers nothing on a historical, cleared, plantless or other item", () => {
    expect(exceptionDeclarationAction({ ...base, type: "MISSING_ATTESTATION", preAutomation: true })).toBeNull()
    expect(exceptionDeclarationAction({ ...base, type: "MISSING_ATTESTATION", stillDetected: false })).toBeNull()
    expect(exceptionDeclarationAction({ ...base, type: "MISSING_ATTESTATION", plant: undefined })).toBeNull()
    expect(exceptionDeclarationAction({ ...base, type: "OVERDUE_REPAIR" })).toBeNull()
    expect(exceptionDeclarationAction({ ...base, type: "MISSING_SESSION_ID" })).toBeNull()
  })
})
