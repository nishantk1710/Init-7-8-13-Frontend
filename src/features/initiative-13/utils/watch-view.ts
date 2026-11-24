/**
 * The WATCH screen's tabs. The 30-day goods-received-not-issued lines and the
 * monthly usage pattern are FR-6 WATCH metrics, not screens of their own, so
 * they live here as `?view=grni` and `?view=usage`.
 */
/** Usage Pattern first and the default; the Metrics tab was removed (UAT, 18-Nov-2026) -- its figures are on Usage. */
export const WATCH_VIEWS = ["usage", "grni"] as const
export type WatchView = (typeof WATCH_VIEWS)[number]

export const WATCH_VIEW_LABELS: Record<WatchView, string> = {
  grni: "30-Day GR-Not-Issued",
  usage: "Usage Pattern",
}

/** Anything unknown or absent -- an old `?view=metrics` link too -- is the usage tab, never an empty screen. */
export function parseWatchView(value: string | undefined): WatchView {
  return (WATCH_VIEWS as readonly string[]).includes(value ?? "")
    ? (value as WatchView)
    : "usage"
}

/**
 * The href for a tab. Switching tabs starts clean (UAT, 27 Oct): no filters and
 * page 1, because each tab answers a different question and a filter carried
 * over from another tab reads as this tab's own. `usage` is the default and
 * drops `view` entirely, so the plain WATCH link and the Usage tab are one URL.
 */
export function watchViewHref(view: WatchView): string {
  return view === "usage" ? "/oar-utilization/watch" : `/oar-utilization/watch?view=${view}`
}
