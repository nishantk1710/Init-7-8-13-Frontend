import { redirect } from "next/navigation"

/**
 * The Exception Queue screen was removed on 08-Oct-2026: declaration and
 * justification are treated as mandatory, so there is no separate queue to
 * work. The checks still run on the backend, and each repair line shows its
 * own findings in the register -- Declaration Status (Required), Justification
 * (Missing) and Due Date Status (Overdue).
 *
 * Redirected rather than removed, because bookmarks, the Showcase Guide and
 * older links still point here.
 */
export default function Page() {
  redirect("/repairable-spares/repair-register")
}
