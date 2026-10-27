/**
 * The WATCH screen's tabs. The 30-day goods-received-not-issued lines and the
 * monthly usage pattern are FR-6 WATCH metrics, not screens of their own, so
 * they live here as `?view=grni` and `?view=usage`.
 */
export const WATCH_VIEWS = ["metrics", "grni", "usage"] as const
export type WatchView = (typeof WATCH_VIEWS)[number]

export const WATCH_VIEW_LABELS: Record<WatchView, string> = {
  metrics: "Metrics",
  grni: "30-Day GR-Not-Issued",
  usage: "Usage Pattern",
}

/** Anything unknown or absent is the metrics tab — never an empty screen. */
export function parseWatchView(value: string | undefined): WatchView {
  return (WATCH_VIEWS as readonly string[]).includes(value ?? "")
    ? (value as WatchView)
    : "metrics"
}

/**
 * The href for a tab. Switching tabs starts clean (UAT, 27 Oct): no filters and
 * page 1, because each tab answers a different question and a filter carried
 * over from another tab reads as this tab's own. `metrics` is the default and
 * drops `view` entirely, so the plain WATCH link and the Metrics tab are one URL.
 */
export function watchViewHref(view: WatchView): string {
  return view === "metrics" ? "/oar-utilization/watch" : `/oar-utilization/watch?view=${view}`
}
