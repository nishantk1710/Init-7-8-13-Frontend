// Step 9/10 -- I07 Quarterly Deep-Dive Report frontend.
//
// Unit test for formatDecimal, the one pure function in availability-value.tsx
// (AvailabilityValue itself is a React component; this codebase has no
// component-render test precedent or testing-library/jsdom dependency
// installed, so per the existing i7-api.test.ts philosophy -- unit-test the
// mapping/formatting logic for faithfulness rather than testing render
// output -- this file covers formatDecimal, which is exactly the piece
// responsible for never coercing a missing baseline/recommendation value to
// "0". AvailabilityValue's status-vs-value branching itself is a few lines
// of JSX read directly off `status`/`value` with no independent logic beyond
// what formatDecimal already covers; it is verified in this task by manual
// inspection of the component per the task's own scoping note.

import { describe, expect, it } from "vitest"

import { formatDecimal } from "./availability-value"

describe("formatDecimal", () => {
  it("never coerces null to the string '0' -- returns null instead", () => {
    expect(formatDecimal(null)).toBeNull()
  })

  it("never coerces undefined to '0' either", () => {
    expect(formatDecimal(undefined as unknown as null)).toBeNull()
  })

  it("parses a Decimal-as-string field the backend serializes, e.g. '502.7342'", () => {
    expect(formatDecimal("502.7342", 2)).toBe("502.73")
  })

  it("parses a plain JSON number the same way as a string", () => {
    expect(formatDecimal(502.7342, 2)).toBe("502.73")
  })

  it("renders a real zero value as '0', distinguishable from the null case by callers checking for null", () => {
    // A real zero baseline/recommendation value must still format to "0",
    // not be confused with "no data" -- that distinction is what the
    // null-vs-string-"0" contract exists to preserve.
    expect(formatDecimal(0)).toBe("0")
    expect(formatDecimal("0.000000")).toBe("0")
    expect(formatDecimal(0)).not.toBeNull()
  })

  it("returns null for a non-numeric string rather than fabricating a value or throwing", () => {
    expect(formatDecimal("not-a-number" as string)).toBeNull()
  })

  it("respects a custom decimals argument", () => {
    expect(formatDecimal("12.3456789", 4)).toBe("12.3457")
    expect(formatDecimal("12.3456789", 0)).toBe("12")
  })
})
