import { redirect } from "next/navigation"

/**
 * The Declaration Queue was folded into the Repair Register on 08-Oct-2026,
 * as in live. The public path, not /demo/...: the data-mode proxy rewrites it
 * back into the Snapshot tree.
 */
export default function Page() {
  redirect("/repairable-spares/repair-register")
}
