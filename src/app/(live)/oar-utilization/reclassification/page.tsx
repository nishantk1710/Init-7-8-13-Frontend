import { permanentRedirect } from "next/navigation"

/**
 * Reclassification was removed from scope (12-Oct-2026). An old link or bookmark lands on
 * the dashboard.
 */
export default function Page() {
  permanentRedirect("/oar-utilization")
}
