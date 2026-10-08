import { redirect } from "next/navigation"

/**
 * The Declaration Queue was folded into the Repair Register on 08-Oct-2026: it
 * was the register's own lines with different columns. Each line's declaration
 * now shows in the register, and the form is on the repair detail page.
 *
 * Redirected rather than removed, because bookmarks, the Showcase Guide and
 * older links still point here.
 */
export default function Page() {
  redirect("/repairable-spares/repair-register")
}
