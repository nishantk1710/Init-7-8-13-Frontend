/**
 * Who the backend records as the author of everything this app writes.
 *
 * ## Why this is a file and not a string literal
 *
 * Every write the assistant makes lands in an **append-only** table — sessions,
 * turns, justifications, consumption plans, quantity suggestions. Postgres
 * triggers block UPDATE and DELETE on all five. So the name attached to a row
 * is the name that row carries forever, and a wrong one cannot be corrected.
 *
 * The backend takes the author from the `X-Actor-Id` header and never from the
 * request body (`app/api/i13/deps.py::get_current_actor`), so that identity is
 * not simply whatever a payload claims. This module is the one place that
 * header is decided. When Entra lands, `currentActorId()` reads a token claim
 * and nothing else in the app changes.
 *
 * ## The placeholder problem this is deliberately NOT hiding
 *
 * There are already **three** different names for "nobody is signed in" reaching
 * append-only tables in this system:
 *
 *   - `"unknown-actor"`            — `get_current_actor`'s default when the
 *                                    header is absent. Every assistant, ACT and
 *                                    justification write with no header gets this.
 *   - `"UNAUTHENTICATED_LOCAL_USER"` — what `app/assistant/session.py:79` uses
 *                                    when a requester is passed as None. The API
 *                                    path never reaches it, because the header
 *                                    dependency already substituted the default.
 *   - `"UNAUTHENTICATED_LOCAL_USER"` — hardcoded again, independently, in
 *                                    `app/api/i8/router.py:133`, which ignores
 *                                    `X-Actor-Id` entirely. Attestations always
 *                                    get this one whatever we send.
 *
 * Sending a header from here settles the first two for everything this app
 * writes. It cannot settle the third — that is a backend change (ask O-1).
 *
 * The value is deliberately loud rather than plausible. A row stamped
 * `UNAUTHENTICATED-<something>` is obviously provisional; a row stamped
 * `jsmith` when nobody signed in is a false audit record, which is worse than
 * no record at all.
 */

/**
 * The actor id sent on every request.
 *
 * Override in development with `NEXT_PUBLIC_ACTOR_ID` — useful for walking two
 * sessions through the assistant as two different people without auth. Next
 * inlines `NEXT_PUBLIC_*` at build time, so a change needs a dev-server restart.
 */
export const ACTOR_ID_HEADER = "X-Actor-Id"

const FALLBACK_ACTOR_ID = "UNAUTHENTICATED-FRONTEND"

/**
 * Who we claim to be. Never returns empty: an empty header is indistinguishable
 * from no header, which would silently hand the row back to the backend default
 * and undo the point of this module.
 */
export function currentActorId(): string {
  const configured = process.env.NEXT_PUBLIC_ACTOR_ID?.trim()
  return configured && configured.length > 0 ? configured : FALLBACK_ACTOR_ID
}

/**
 * True when the id is a placeholder rather than a real signed-in person.
 *
 * Screens that display an author use this to mark the value as provisional.
 * Showing `UNAUTHENTICATED-FRONTEND` in the same typeface as a real name trains
 * people to read it as one.
 */
export function isPlaceholderActor(actorId: string): boolean {
  return (
    actorId === FALLBACK_ACTOR_ID ||
    actorId === "unknown-actor" ||
    actorId === "UNAUTHENTICATED_LOCAL_USER" ||
    actorId.startsWith("UNAUTHENTICATED")
  )
}
