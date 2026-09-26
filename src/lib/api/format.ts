/**
 * Wire-value helpers shared by every initiative's API client.
 *
 * These began life inside `lib/api/i8.ts`, which is where the problems they
 * solve were first met. They are not about repairs: an ISO date and a decimal
 * sent as a string cross the wire the same way on `/api/i13` and
 * `/api/assistant`, and Initiative 13 importing them from `lib/api/i8` would
 * make one initiative's module a dependency of another's for no reason. So they
 * live here and `i8.ts` re-exports them, unchanged, for the callers that
 * already import them from there.
 */

/**
 * An ISO date from an API as the display string this app uses everywhere.
 *
 * The backends send `"2026-07-28"` and every screen renders `28 Jul 2026`.
 * Returns the placeholder for null — never "Invalid Date", and never today's
 * date, which is the failure mode that makes a missing date look like a
 * present one.
 */
export function formatApiDate(iso: string | null | undefined, fallback = "—"): string {
  if (!iso) return fallback
  const parsed = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return fallback
  return parsed.toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })
}

/**
 * An ISO timestamp as a display string, date and time.
 *
 * Separate from `formatApiDate` because a timestamp must not be truncated to a
 * date silently: `detectedAt` and `calculatedAt` are the fields a reader uses
 * to judge how stale a screen is, and "today" is a very different answer from
 * "today at 04:00".
 */
export function formatApiDateTime(
  iso: string | null | undefined,
  fallback = "—"
): string {
  if (!iso) return fallback
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return fallback
  return parsed.toLocaleString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/**
 * A decimal the API sent as a string, as a number — or `undefined`.
 *
 * Decimals cross the wire as strings so that quantities and prices do not lose
 * precision in JSON. `undefined` is preserved rather than coerced to 0: for
 * stock on hand, a planned quantity or a received quantity, the difference
 * between "unknown" and "zero" is the whole point. A zero received quantity
 * means nothing arrived; an unknown one means nobody recorded what did.
 */
export function toNumber(value: string | number | null | undefined): number | undefined {
  if (value === null || value === undefined || value === "") return undefined
  const parsed = Number(value)
  return Number.isNaN(parsed) ? undefined : parsed
}

/**
 * The same, for a field where zero genuinely is the right default.
 *
 * Use it for **counts** — how many consumptions, how many storage locations —
 * where the backend sends 0 and means 0, and an absent value means the same
 * thing. Never use it for a quantity or a measure; that is what `toNumber` is
 * for, and the two are not interchangeable.
 */
export function toCount(value: string | number | null | undefined): number {
  return toNumber(value) ?? 0
}

/**
 * A backend string as one of a closed set of UI values, or a stated fallback.
 *
 * The guard exists for the day one side adds a value the other has not seen.
 * Without it an unrecognised status goes straight into a `Record<Union, Tone>`
 * lookup and renders as `undefined` — or crashes the table, depending on what
 * the consumer does with it. With it, the row renders with the fallback and the
 * screen stays usable.
 */
export function oneOf<T extends string>(
  value: string | null | undefined,
  allowed: readonly T[],
  fallback: T
): T {
  return allowed.includes(value as T) ? (value as T) : fallback
}

/** `null` -> `undefined`, so "the source does not know" reads one way. Never a default. */
export function orUndefined<T>(value: T | null | undefined): T | undefined {
  return value ?? undefined
}
