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

// The footer under a paged table is the shared `TablePagination` (`loading` prop): while a page loads it names the
// page coming instead of showing the new page's range above the old page's rows, and Previous/Next switch off so
// repeated clicks cannot queue a pile of requests. Its text is `pageSummary` in `lib/pagination.ts`.
