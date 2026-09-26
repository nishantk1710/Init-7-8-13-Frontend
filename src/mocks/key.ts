/**
 * The lookup key for one recorded backend response.
 *
 * Shared by the recorder (scripts/mock-data/record.mts), which writes responses
 * under this key, and the demo-mode resolver (./resolve.ts), which reads them
 * back. The two MUST agree byte for byte, which is why this file has no imports
 * and lives in one place.
 *
 *   mockKey("GET", "/i8/register?page=1&plant=1300")
 *     -> "GET /i8/register?page=1&plant=1300"
 *
 * Query parameters are sorted and empty values dropped, so the order a caller
 * happens to build a URLSearchParams in never causes a miss.
 */
export function mockKey(method: string, path: string): string {
  const [pathname, search = ""] = path.split("?", 2)
  const params = new URLSearchParams(search)
  const pairs = [...params.entries()]
    .filter(([, value]) => value !== "")
    .sort(([a, av], [b, bv]) => (a === b ? av.localeCompare(bv) : a.localeCompare(b)))
  const query = pairs.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&")
  return `${method.toUpperCase()} ${normalisePathname(pathname)}${query ? `?${query}` : ""}`
}

/** `/i8/register/` and `/i8/register` are one route. */
export function normalisePathname(pathname: string): string {
  const withSlash = pathname.startsWith("/") ? pathname : `/${pathname}`
  return withSlash.length > 1 ? withSlash.replace(/\/+$/, "") : withSlash
}
