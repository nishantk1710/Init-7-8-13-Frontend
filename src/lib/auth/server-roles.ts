// Roles in SERVER components: the same GET /api/me, made with the request's
// own access token (lib/api/token.ts), once per request.
//
//     const roles = await getRoles()
//     const canAttest = hasAnyRole(roles, ROLES.STORES)

import { cache } from "react"

import { fetchMe, type Me } from "@/lib/auth/me"

export const getMe = cache((): Promise<Me> => fetchMe())

/** The user's Spares.* roles; every role while the backend's sign-in is off. */
export async function getRoles(): Promise<string[]> {
  return (await getMe()).roles
}
