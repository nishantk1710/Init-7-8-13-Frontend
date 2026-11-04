// NONPROD TEST AID, off unless NEXT_PUBLIC_TEST_USER_ACTORS=true at build time.
//
// With the backend's sign-in off, the notification inbox is the inbox of whoever the
// X-Actor-Id header names (app/api/notifications/inbox.py), and that header is one fixed
// value per build (lib/api/actor.ts). So signing in as another test user shows the same
// inbox, and nobody can check that the right person got the right notice.
//
// When this is on, the test sign-in's username decides the header instead:
//
//   * a username listed below sends that GUID, and
//   * a username that is itself a GUID sends itself (sign up as 00000000-0000-0000-0000-000000000002).
//
// Nothing else changes: still NOT authentication, still no roles, and the backend still
// trusts the header only because its own sign-in is off. The GUIDs are the test people
// whose notification_recipients rows were registered for the notification test. Real
// colleagues' names are deliberately not mapped, so no real person is recorded as acting
// in a role. Sign up with these usernames in each browser (/signup).
//
// Retire with the test sign-in when Entra sign-in is on. Never set the flag in production.
//
// Kept free of imports and browser globals so it can be unit-tested in the node environment.

/** Test username -> the GUID the backend treats as that person. */
export const TEST_USER_ACTORS: Readonly<Record<string, string>> = {
  "end.user": "00000000-0000-0000-0000-000000000001",
  "engineering.manager": "00000000-0000-0000-0000-000000000002",
  "commercial.manager": "00000000-0000-0000-0000-000000000003",
  "warehouse.supervisor": "00000000-0000-0000-0000-000000000004",
  "plant.head": "00000000-0000-0000-0000-000000000005",
  "inventory.controller": "00000000-0000-0000-0000-000000000006",
  "engineering.head": "00000000-0000-0000-0000-000000000007",
  "commercial.head": "00000000-0000-0000-0000-000000000008",
  admin: "00000000-0000-0000-0000-000000000009",
  requester: "00000000-0000-0000-0000-000000000011",
  hod: "00000000-0000-0000-0000-000000000012",
}

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/** True when the build has the test mapping switched on. */
export function testUserActorsEnabled(): boolean {
  // The literal property access is what lets Next inline the value at build time.
  return process.env.NEXT_PUBLIC_TEST_USER_ACTORS === "true"
}

/** The GUID for a test username, or null when it is neither listed nor a GUID. */
export function resolveTestActor(username: string | null | undefined): string | null {
  const key = (username ?? "").trim().toLowerCase()
  if (!key) return null
  const listed = TEST_USER_ACTORS[key]
  if (listed) return listed
  return GUID.test(key) ? key : null
}
