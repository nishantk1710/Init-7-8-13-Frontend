import { describe, expect, it } from "vitest"

import { DECLARATION_DISPLAY, declarationDisplay, declarationLinkLabel } from "@/features/initiative-8/utils/declaration"

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
