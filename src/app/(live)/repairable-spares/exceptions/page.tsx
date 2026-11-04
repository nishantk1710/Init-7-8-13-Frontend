import { redirect } from "next/navigation"

/**
 * The Repair Exceptions screen was removed on 3-Nov-2026, with the checks
 * behind it: declarations are made in the reservation assistant, and overdue
 * repairs are shown on the register. This address is kept only so a bookmark,
 * or a link in an old notification, opens the register instead of a 404.
 */
export default function ExceptionsRedirect() {
  redirect("/repairable-spares/repair-register")
}
