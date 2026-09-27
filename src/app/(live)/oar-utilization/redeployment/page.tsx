import { permanentRedirect } from "next/navigation"

/**
 * Redeployment is out of scope (I13 FRS §3.2, D10 defers the workflow). The
 * cross-plant stock visibility that is in scope lives on each ACT exception, so
 * that is where an old link lands.
 */
export default function Page() {
  permanentRedirect("/oar-utilization/aging-exceptions")
}
