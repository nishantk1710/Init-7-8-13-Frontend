/**
 * Reading the query string of I08's server-paged screens -- Justifications,
 * Repair Declarations and Repair Exceptions -- which keep their filters and
 * page in the URL.
 *
 * A plain module rather than part of a client component: the server pages read
 * these, and anything exported from a "use client" file reaches a server
 * component as a client reference, not as its value.
 */

/** Next hands `searchParams` as possibly-repeated values. */
export type RawSearchParams = Record<string, string | string[] | undefined>

/**
 * One value, or undefined. A repeated parameter is a malformed link, not a
 * list to pick from -- the rule the I13 screens apply.
 */
export function single(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return undefined
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}
