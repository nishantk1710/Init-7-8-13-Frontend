import { permanentRedirect } from "next/navigation"

/**
 * Validation belongs to Initiative 7, not to OAR Utilization, so the screen was
 * removed from this module. An old link lands on the Dashboard.
 */
export default function Page() {
  permanentRedirect("/oar-utilization")
}
