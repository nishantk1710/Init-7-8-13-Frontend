"use client"

import { useEffect, useMemo, useState } from "react"

import { fetchMe, type Me } from "@/lib/auth/me"
import { hasAnyRole, type Role } from "@/lib/auth/roles"

// One GET /api/me per page load, shared by every component that asks.
let pending: Promise<Me> | null = null

function loadMe(): Promise<Me> {
  pending ??= fetchMe().catch((error) => {
    pending = null // try again next time
    throw error
  })
  return pending
}

export interface UseRoles {
  /** The user's Spares.* roles (empty while loading or when /api/me failed). */
  roles: string[]
  loading: boolean
  /** /api/me could not be read -- treat as no roles. */
  failed: boolean
  /** False while the backend's sign-in is off: then every role is held. */
  authEnabled: boolean
  /** True when the user holds at least one of `needed`. False while loading. */
  hasRole: (...needed: Role[]) => boolean
}

/**
 * The signed-in user's roles, for enabling only what they may do.
 *
 *     const { hasRole } = useRoles()
 *     <Button disabled={!hasRole(ROLES.STORES)} title={requiredRolesText(ROLES.STORES)}>
 *
 * A convenience only: the backend refuses anything the roles do not allow.
 */
export function useRoles(): UseRoles {
  const [me, setMe] = useState<Me | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let live = true
    loadMe()
      .then((value) => live && setMe(value))
      .catch(() => live && setFailed(true))
    return () => {
      live = false
    }
  }, [])

  return useMemo(() => {
    const roles = me?.roles ?? []
    return {
      roles,
      loading: me === null && !failed,
      failed,
      authEnabled: me?.authEnabled ?? false,
      hasRole: (...needed: Role[]) => (me ? !me.authEnabled || hasAnyRole(roles, ...needed) : false),
    }
  }, [me, failed])
}
