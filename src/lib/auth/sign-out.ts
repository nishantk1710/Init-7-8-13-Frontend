// Sign out, whichever sign-in is running (lib/auth/mode.ts).
//
// Microsoft sign-in: end the Auth.js session, then go to Entra's sign-out page
// so the Microsoft session ends too -- otherwise "Sign in with Microsoft" would
// sign the same person straight back in. Test sign-in: as before.
//
// Browser-only.

import { signOut as mockSignOut } from "@/lib/auth/mock-auth"
import { browserAuthMode } from "@/lib/auth/mode"

export async function signOutEverywhere(): Promise<void> {
  if (browserAuthMode() !== "entra") {
    mockSignOut()
    return
  }
  const { getSession, signOut } = await import("next-auth/react")
  const session = await getSession().catch(() => null)
  await signOut({ redirect: false })
  window.location.assign(session?.logoutUrl ?? "/login")
}
