"use client"

import { useEffect, useState } from "react"

import { isEntraObjectId, personDirectory, type PersonName } from "@/lib/api/people"

export interface UsePersonName {
  /** The person once known; null for an id the backend does not know, or one that is not an object id. */
  person: PersonName | null
  /** Their display name, their e-mail when the token carried no name, or null while unknown. */
  name: string | null
  /** True while the first answer for this id is on its way. */
  loading: boolean
}

/**
 * The person behind an author id, from the backend's user directory (GET /api/users/names).
 *
 *     const { name } = usePersonName(entry.actor_id)
 *     <span>{name ?? entry.actor_id}</span>
 *
 * Ids that are not Entra object ids (placeholders such as UNAUTHENTICATED-FRONTEND, "U1") are
 * never sent. Lookups across the whole page are batched and remembered (lib/api/people.ts).
 */
export function usePersonName(id: string | null | undefined): UsePersonName {
  const lookupable = isEntraObjectId(id)
  // Read during render, never set in an effect: the directory already knows most ids after
  // the first screen, and that answer must not lag a render behind.
  const cached = lookupable ? personDirectory.peek(id) : null
  const [fetched, setFetched] = useState<{ id: string; person: PersonName | null } | null>(null)

  useEffect(() => {
    if (!lookupable || personDirectory.peek(id) !== undefined) return
    let live = true
    void personDirectory.lookup(id).then((person) => {
      if (live) setFetched({ id, person })
    })
    return () => {
      live = false
    }
  }, [id, lookupable])

  const person = cached !== undefined ? cached : fetched !== null && fetched.id === id ? fetched.person : undefined
  const name = person ? person.name.trim() || person.email.trim() || null : null
  return { person: person ?? null, name, loading: lookupable && person === undefined }
}
