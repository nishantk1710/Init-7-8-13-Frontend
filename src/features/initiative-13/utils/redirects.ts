import type { RawSearchParams } from "@/features/initiative-13/utils/search-params"

/**
 * Build the target of a retired route's redirect, keeping the query it arrived
 * with so a shared filtered link still lands filtered.
 *
 * `overrides` win over incoming values — a retired `/usage-patterns?view=x`
 * must still land on the usage tab. Repeated values are kept as repeated;
 * whether they mean anything is the target page's call, not the redirect's.
 */
export function redirectTarget(
  pathname: string,
  raw: RawSearchParams,
  overrides: Record<string, string> = {}
): string {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(raw)) {
    if (key in overrides || value === undefined) continue
    for (const item of Array.isArray(value) ? value : [value]) query.append(key, item)
  }
  for (const [key, value] of Object.entries(overrides)) query.set(key, value)
  const qs = query.toString()
  return qs ? `${pathname}?${qs}` : pathname
}
