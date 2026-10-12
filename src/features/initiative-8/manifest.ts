import type { InitiativeManifest } from "@/lib/domain/manifest"

export const initiative8Manifest: InitiativeManifest = {
  id: "initiative-8",
  name: "Repairable Spares",
  description:
    "Repair register, condition attestation and reservation-time compliance for 80-series spares",
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
      // FR-4's capture: a part is declared when it comes off the machine,
      // before any repair PO exists, so the form starts from the part rather
      // than from a register line. Scrap and Beyond Economical Repair
      // declarations -- which never get a repair line -- are listed here too.
      // Not the old Declaration Queue (folded into the register 08-Oct-2026),
      // which listed repair lines and so could only be worked after the PO.
      {
        label: "Declarations",
        icon: "file-text",
        href: "/repairable-spares/declarations",
      },
      // No Exception Queue (08-Oct-2026): declaration and justification
      // are treated as mandatory. The checks still run on the backend, and each
      // line shows its findings in the register (Declaration Status Required,
      // Justification Missing, Due Date Status Overdue). Its old URL
      // redirects to the register.
      {
        label: "Coding Candidates",
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
