import { describe, expect, it } from "vitest"

import {
  DECLARATION_DISPLAY,
  declarationAction,
  declarationDisplay,
  declarationFormProblem,
  isWaitingForDeclaration,
  optionalText,
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
