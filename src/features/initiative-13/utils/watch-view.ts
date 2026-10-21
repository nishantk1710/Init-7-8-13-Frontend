import type { I13SearchParams } from "@/features/initiative-13/utils/search-params"

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
 * The href for a tab, carrying the filters over. `metrics` is the default and
 * drops `view` entirely, so the plain WATCH link and the Metrics tab are one URL.
 */
export function watchViewHref(view: WatchView, params: I13SearchParams): string {
  const query = new URLSearchParams()
  for (const key of ["plant", "material", "agingBand", "acquiredVsPlanStatus"] as const) {
    const value = params[key]
    if (value) query.set(key, value)
  }
  if (view !== "metrics") query.set("view", view)
  const qs = query.toString()
  return qs ? `/oar-utilization/watch?${qs}` : "/oar-utilization/watch"
}
