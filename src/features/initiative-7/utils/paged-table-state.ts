// What a paged table should show while a page is on its way.
//
// The report's "most recent recommendations" table used to ignore loading: the previous page's rows stayed
// on screen, the footer jumped ahead to the new page number, and nothing said a load was in progress.

export type PagedTableView =
  /** First load: nothing to show yet. Not "no recommendations". */
  | "skeleton"
  /** Rows to show -- dimmed while the next page loads. */
  | "rows"
  /** Loaded, and genuinely empty. */
  | "empty"

export function pagedTableView(loading: boolean, rows: readonly unknown[] | null | undefined): PagedTableView {
  if (rows && rows.length > 0) return "rows"
  return loading ? "skeleton" : "empty"
}

/** The footer's left side. While a page loads it says so, instead of showing the new page's range above the
 * old page's rows. */
export function pagedFooterText(args: { loading: boolean; page: number; pageSize: number; total: number }): string {
  const { loading, page, pageSize, total } = args
  if (loading) return `Loading page ${page.toLocaleString("en-US")}…`
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1
  const last = Math.min(total, page * pageSize)
  return `Showing ${first.toLocaleString("en-US")}–${last.toLocaleString("en-US")} of ${total.toLocaleString("en-US")}`
}

/** Next/Previous are off while a page loads, so repeated clicks cannot queue a pile of requests. */
export function canGoPrevious(loading: boolean, page: number): boolean {
  return !loading && page > 1
}

export function canGoNext(loading: boolean, page: number, pageSize: number, total: number): boolean {
  return !loading && page * pageSize < total
}
