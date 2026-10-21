import { describe, expect, it } from "vitest"

import { sessionIdentity } from "./trace-format"

describe("sessionIdentity", () => {
  it("is the session ID for a stand-alone session", () => {
    expect(sessionIdentity({ sessionId: "S8K2M4P6Q9", reference: "S8K2M4P6Q9" })).toEqual({
      label: "S8K2M4P6Q9",
      sapText: "S8K2M4P6Q9",
      requestId: null,
      lineNo: null,
    })
  })

  it("shows R…/n for a request line but types the bare request ID into SAP", () => {
    expect(
      sessionIdentity({ sessionId: "S8K2M4P6Q9", requestId: "R5B61EQBGQ", lineNo: 2, reference: "R5B61EQBGQ/2" })
    ).toEqual({ label: "R5B61EQBGQ/2", sapText: "R5B61EQBGQ", requestId: "R5B61EQBGQ", lineNo: 2 })
  })

  it("builds the line label when the backend sends no reference", () => {
    expect(sessionIdentity({ sessionId: "S8K2M4P6Q9", requestId: "R5B61EQBGQ", lineNo: 3 }).label).toBe(
      "R5B61EQBGQ/3"
    )
  })
})
