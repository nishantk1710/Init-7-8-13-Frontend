import { describe, expect, it } from "vitest"

import { ownerLabel } from "@/features/initiative-13/utils/owner-label"

describe("ownerLabel", () => {
  it("keeps a person's name", () => {
    expect(ownerLabel("VZI_requester")).toBe("VZI_requester")
  })

  it("reads an anonymous system ID as Not given", () => {
    expect(ownerLabel("UNAUTHENTICATED-FRONTEND")).toBe("Not given")
    expect(ownerLabel("UNAUTHENTICATED_LOCAL_USER")).toBe("Not given")
  })

  it("leaves no owner as no owner", () => {
    expect(ownerLabel(null)).toBeNull()
    expect(ownerLabel("")).toBeNull()
  })
})
