import type { InitiativeManifest } from "@/lib/domain/manifest"

export const initiative8Manifest: InitiativeManifest = {
  id: "initiative-8",
  name: "Repairable Spares",
  description:
    "Repair register, condition declarations and reservation-time compliance for 80-series spares",
  // The module's own overview page — also where Home's summary card "open"
  // link lands.
  href: "/repairable-spares",
  navSection: {
    title: "Repairable Spares",
    items: [
      { label: "Overview", icon: "package", href: "/repairable-spares" },
      {
        label: "Repair Register",
        icon: "wrench",
        href: "/repairable-spares/repair-register",
      },
      // No standalone "is there already a unit?" page: FR-6 is a rule the
      // Spares Assistant runs at reservation time (FR-5b), where the answer
      // comes with a session id and a justification prompt. A separate lookup
      // gave the same answer with neither.
      //
      // The Declaration and Exception queues were folded into the register on
      // 08-Oct-2026 and brought back on 12-Oct, after the 09-Oct FRS audit. On
      // 3-Nov-2026 the business ruled again: declarations are made only in the
      // reservation assistant, so Repair Declarations is the log of them, and
      // the Repair Exceptions screen was removed with its checks (overdue
      // repairs are shown on the register).
      {
        // Distinct from Justifications' clipboard below: one records a
        // condition that WAS assessed, the other a purchase made anyway.
        label: "Repair Declarations",
        icon: "check-circle",
        href: "/repairable-spares/declarations",
      },
      {
        // FR-2's miscoding screen: materials whose requisition, order or
        // movement text talks about repair but which are not 80-series coded.
        // Renamed from "Coding Candidates" on 14-Oct-2026; the route keeps the
        // old word because several links point at it and a URL is not a name.
        label: "Repair Candidates",
        icon: "search",
        href: "/repairable-spares/coding-candidates",
      },
      // FR-7's half of the record: why somebody bought new while a repairable
      // unit already existed. Each repair line also shows its own in the
      // register, but most reasons belong to no line -- FR-5 asks for one when
      // a unit is on the shelf or removed and not yet sent for repair -- so the
      // full log keeps its own screen.
      {
        label: "Justifications",
        icon: "clipboard-check",
        href: "/repairable-spares/justifications",
      },
    ],
  },
}
