// GET /api/users/names -- the people behind Entra object ids (app/api/users.py).
//
// Every author column the backend returns holds the actor's object id. Screens ask here for
// the name, through one directory per page that batches the ids on screen into a single
// request per tick and remembers every answer, so a table of 25 rows costs one call and a
// re-render none. An id the backend does not know (never signed in, or a placeholder from
// before sign-in existed) resolves to null, and the screen keeps showing the id.

import { apiFetch } from "@/lib/api/client"

export interface PersonName {
  oid: string
  name: string
  email: string
}

const ENTRA_OBJECT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** True for the 8-4-4-4-12 form Entra uses. Anything else (a placeholder, "U1", an email) is never looked up. */
export function isEntraObjectId(value: string | null | undefined): value is string {
  return typeof value === "string" && ENTRA_OBJECT_ID.test(value)
}

export async function fetchPersonNames(oids: string[]): Promise<Record<string, PersonName>> {
  if (oids.length === 0) return {}
  const query = new URLSearchParams()
  for (const oid of oids) query.append("oid", oid)
  const body = await apiFetch<{ names: Record<string, PersonName> }>(`/api/users/names?${query}`)
  return body.names ?? {}
}

type Fetcher = (oids: string[]) => Promise<Record<string, PersonName>>
type Resolve = (person: PersonName | null) => void

/**
 * Batching, remembering lookup of people by object id. `personDirectory` below serves the
 * whole page; tests build their own with a fake fetcher and call `flushNow()` instead of
 * waiting on the timer.
 */
export class PersonDirectory {
  private readonly known = new Map<string, PersonName | null>()
  private readonly waiting = new Map<string, Promise<PersonName | null>>()
  private readonly resolvers = new Map<string, Resolve>()
  private queue: string[] = []
  private flushScheduled = false

  constructor(
    private readonly fetcher: Fetcher = fetchPersonNames,
    private readonly batchSize = 200,
  ) {}

  /** What is already in hand: the person, null for an id the backend does not know, undefined when never asked. */
  peek(oid: string): PersonName | null | undefined {
    return this.known.get(oid.toLowerCase())
  }

  /**
   * Resolves with the person, or null when the backend does not know the id. Never rejects: a
   * failed request resolves null for that batch and is asked again the next time.
   */
  lookup(oid: string): Promise<PersonName | null> {
    const key = oid.toLowerCase()
    const had = this.known.get(key)
    if (had !== undefined) return Promise.resolve(had)
    let pending = this.waiting.get(key)
    if (!pending) {
      pending = new Promise<PersonName | null>((resolve) => this.resolvers.set(key, resolve))
      this.waiting.set(key, pending)
      this.queue.push(key)
      this.scheduleFlush()
    }
    return pending
  }

  private scheduleFlush(): void {
    if (this.flushScheduled) return
    this.flushScheduled = true
    // A timer, not a microtask: every component of one render commit queues its id first, so
    // one request covers the screen.
    setTimeout(() => {
      this.flushScheduled = false
      void this.flushNow()
    }, 0)
  }

  /** Sends everything queued, one request per batch. */
  async flushNow(): Promise<void> {
    while (this.queue.length > 0) {
      const batch = this.queue.splice(0, this.batchSize)
      let found = new Map<string, PersonName>()
      let ok = true
      try {
        const names = await this.fetcher(batch)
        found = new Map(Object.entries(names).map(([key, person]) => [key.toLowerCase(), person]))
      } catch {
        ok = false
      }
      for (const key of batch) {
        const person = found.get(key) ?? null
        if (ok) this.known.set(key, person)
        this.waiting.delete(key)
        this.resolvers.get(key)?.(ok ? person : null)
        this.resolvers.delete(key)
      }
    }
  }
}

export const personDirectory = new PersonDirectory()
