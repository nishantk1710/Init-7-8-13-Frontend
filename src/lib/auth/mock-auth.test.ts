import { describe, expect, it } from "vitest"

import {
  DEFAULT_LANDING,
  isPublicPath,
  isValidUsername,
  safeNext,
  UAT_USERS,
  usernameFromName,
} from "./mock-auth"

describe("isPublicPath", () => {
  it("lets the login and sign-up pages through", () => {
    expect(isPublicPath("/login")).toBe(true)
    expect(isPublicPath("/signup")).toBe(true)
  })

  it("gates everything else, including look-alikes", () => {
    expect(isPublicPath("/")).toBe(false)
    expect(isPublicPath("/home")).toBe(false)
    expect(isPublicPath("/loginx")).toBe(false)
    expect(isPublicPath("/profile")).toBe(false)
  })
})

describe("safeNext", () => {
  it("keeps a path on this site, query included", () => {
    expect(safeNext("/approvals?tab=mine")).toBe("/approvals?tab=mine")
  })

  it("refuses anything that would leave the site", () => {
    expect(safeNext("https://example.com")).toBe(DEFAULT_LANDING)
    expect(safeNext("//example.com")).toBe(DEFAULT_LANDING)
    expect(safeNext("/\\example.com")).toBe(DEFAULT_LANDING)
  })

  it("falls back when empty or pointing at the auth pages", () => {
    expect(safeNext(undefined)).toBe(DEFAULT_LANDING)
    expect(safeNext("")).toBe(DEFAULT_LANDING)
    expect(safeNext("/login?next=/home")).toBe(DEFAULT_LANDING)
  })
})

describe("usernames", () => {
  it("suggests a username from a name", () => {
    expect(usernameFromName("Lynn Boyce")).toBe("lynn.boyce")
    expect(usernameFromName("  Jacobus  Matthys ")).toBe("jacobus.matthys")
  })

  it("accepts every UAT username", () => {
    for (const user of UAT_USERS) expect(isValidUsername(user.username)).toBe(true)
  })

  it("rejects what cannot travel in the cookie", () => {
    expect(isValidUsername("a")).toBe(false)
    expect(isValidUsername("has space")).toBe(false)
    expect(isValidUsername("semi;colon")).toBe(false)
  })
})
