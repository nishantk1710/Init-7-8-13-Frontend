// GET /api/me -- who the backend thinks is calling (app/api/me.py).

import { apiFetch } from "@/lib/api/client"

export interface Me {
  /** Entra object ID; with sign-in off on the backend, the X-Actor-Id value. */
  oid: string
  name: string
  email: string
  /** The Spares.* roles in the user's token; every role while the backend's sign-in is off. */
  roles: string[]
  /** False while AUTH_ENABLED is off on the backend. */
  authEnabled: boolean
  isApplication: boolean
}

export function fetchMe(): Promise<Me> {
  return apiFetch<Me>("/me")
}
