/**
 * An exception's owner as a person's name.
 *
 * With login off (non-prod), a session started without anybody typed in the
 * assistant's Requester box is saved under an anonymous system ID
 * (`UNAUTHENTICATED_LOCAL_USER`, `UNAUTHENTICATED-FRONTEND`). That is nobody's
 * name, so it reads "Not given" -- the same rule the I8 screens apply.
 * `null` (no owner at all) stays `null`: the board says "Unresolved" for it.
 */
export function ownerLabel(ownerId: string | null | undefined): string | null {
  if (!ownerId) return null
  return ownerId.toUpperCase().startsWith("UNAUTHENTICATED") ? "Not given" : ownerId
}
