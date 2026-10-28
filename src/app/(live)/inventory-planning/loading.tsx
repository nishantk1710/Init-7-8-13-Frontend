import { PageLoader } from "@/components/shared/page-loader"

/**
 * What every Inventory Planning screen shows while it opens -- on a refresh, and on a click in the sidebar: the Overview,
 * Recommendations, Pipeline, Adoption Tracking, Quarterly Reports, Criticality Reports and a single recommendation.
 *
 * Without it a click leaves the previous screen up (or a blank one) until the next is ready, which on a slow request reads as
 * a link that did nothing. With it the screen switches at once, the sidebar stays, and the hourglass stands in for the page.
 * Each page then shows its own loader for the data it fetches.
 */
export default function Loading() {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-6">
      <PageLoader label="Loading Inventory Planning" className="h-64 w-full" />
    </div>
  )
}
