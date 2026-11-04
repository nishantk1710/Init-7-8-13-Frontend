import { afterEach, describe, expect, it, vi } from "vitest"

import {
  resolveTestActor,
  resolveTestApprovalRole,
  TEST_USER_ACTORS,
  TEST_USER_APPROVAL_ROLES,
  testUserActorsEnabled,
} from "@/lib/auth/test-actors"

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("resolveTestActor", () => {
  it("maps a listed test username to its GUID, ignoring case and spaces", () => {
    expect(resolveTestActor("engineering.manager")).toBe("00000000-0000-0000-0000-000000000002")
    expect(resolveTestActor("  Admin ")).toBe("00000000-0000-0000-0000-000000000009")
  })

  it("lets a username that is itself a GUID stand for that person", () => {
    expect(resolveTestActor("00000000-0000-0000-0000-000000000004")).toBe("00000000-0000-0000-0000-000000000004")
  })

  it("returns null for anyone else, so the caller falls back as before", () => {
    expect(resolveTestActor("simone")).toBeNull()
    expect(resolveTestActor("chardon.links")).toBeNull()
    expect(resolveTestActor("not-a-guid")).toBeNull()
    expect(resolveTestActor("")).toBeNull()
    expect(resolveTestActor(null)).toBeNull()
    expect(resolveTestActor(undefined)).toBeNull()
  })

  it("only ever sends GUIDs, because the backend refuses any other identity as a notification recipient", () => {
    for (const guid of Object.values(TEST_USER_ACTORS)) expect(guid).toMatch(GUID)
  })

  it("gives each test person a different GUID", () => {
    const guids = Object.values(TEST_USER_ACTORS)
    expect(new Set(guids).size).toBe(guids.length)
  })

  it("is valid as a sign-up username (2-40 letters, digits, dots, dashes, underscores)", () => {
    for (const username of Object.keys(TEST_USER_ACTORS)) expect(username).toMatch(/^[a-z0-9._-]{2,40}$/)
  })
})

describe("resolveTestApprovalRole", () => {
  it("gives each approval step's test user that step's role, ignoring case and spaces", () => {
    expect(resolveTestApprovalRole("end.user")).toBe("End User")
    expect(resolveTestApprovalRole(" Engineering.Manager ")).toBe("Engineering Manager")
    expect(resolveTestApprovalRole("warehouse.supervisor")).toBe("Warehouse Supervisor")
    expect(resolveTestApprovalRole("commercial.head")).toBe("Commercial Head")
  })

  it("follows a GUID username back to the listed person's role", () => {
    expect(resolveTestApprovalRole("00000000-0000-0000-0000-000000000002")).toBe("Engineering Manager")
  })

  it("has no role for admin, requester, hod, strangers and blanks, so the panel keeps its default", () => {
    for (const username of ["admin", "requester", "hod", "simone", "00000000-0000-0000-0000-000000000099", "", null, undefined]) {
      expect(resolveTestApprovalRole(username)).toBeNull()
    }
  })

  it("only lists usernames that are also test people, and only the eight real approval roles", () => {
    for (const username of Object.keys(TEST_USER_APPROVAL_ROLES)) expect(TEST_USER_ACTORS[username]).toBeDefined()
    expect(new Set(Object.values(TEST_USER_APPROVAL_ROLES)).size).toBe(8)
  })
})

describe("testUserActorsEnabled", () => {
  it("is off unless the build sets NEXT_PUBLIC_TEST_USER_ACTORS to exactly true", () => {
    expect(testUserActorsEnabled()).toBe(false)
    vi.stubEnv("NEXT_PUBLIC_TEST_USER_ACTORS", "false")
    expect(testUserActorsEnabled()).toBe(false)
    vi.stubEnv("NEXT_PUBLIC_TEST_USER_ACTORS", "1")
    expect(testUserActorsEnabled()).toBe(false)
    vi.stubEnv("NEXT_PUBLIC_TEST_USER_ACTORS", "true")
    expect(testUserActorsEnabled()).toBe(true)
  })
})
