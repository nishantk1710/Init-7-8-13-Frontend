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
      {
        label: "Declaration Queue",
        icon: "file-text",
        href: "/repairable-spares/declarations",
      },
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
      // The other half of the record: why somebody bought new while a
      // repairable unit already existed.
      {
        label: "Justifications",
        icon: "clipboard-check",
        href: "/repairable-spares/justifications",
      },
    ],
  },
}
