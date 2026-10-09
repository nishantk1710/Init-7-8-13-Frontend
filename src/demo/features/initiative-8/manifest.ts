import type { InitiativeManifest } from "@demo/lib/domain/manifest"

export const initiative8Manifest: InitiativeManifest = {
  id: "initiative-8",
  name: "Repairable Spares",
  description:
    "Repair register, condition declaration and new-acquisition control for 80-series spares",
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
      // No standalone "is there already a unit?" page: the duplicate check is
      // a rule the Spares Assistant runs at reservation time, where the answer
      // arrives with a session id and a justification prompt. A separate
      // lookup screen gave the same answer with neither, so the record of it
      // now lives in the Exception Queue and the justification log instead.
      //
      // No Declaration Queue or Justifications page either (08-Oct-2026), as
      // in live: each line's declaration and justification show in the
      // register, the declaration form is on the repair detail page, and the
      // justification log is a section of the Overview. Both old URLs redirect.

      // Every finding the checks raise: missing declarations, and new units
      // bought while a repair was open with no justification recorded.
      {
        label: "Exception Queue",
        icon: "alert-triangle",
        href: "/repairable-spares/exceptions",
      },
      {
        label: "Coding Candidates",
        icon: "search",
        href: "/repairable-spares/coding-candidates",
      },
    ],
  },
}
