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
    // The six FRS screens, as the Snapshot shows them (12-Oct-2026). The
    // Snapshot keeps the Declarations, Exception Queue and Justifications
    // screens as their own pages, as the FRS asks, even where live has folded
    // one into another.
    items: [
      { label: "Overview", icon: "package", href: "/repairable-spares" },
      {
        label: "Repair Register",
        icon: "wrench",
        href: "/repairable-spares/repair-register",
      },
      {
        label: "Coding Candidates",
        icon: "search",
        href: "/repairable-spares/coding-candidates",
      },
      // FR-4: every condition-to-repair declaration, and the ones still owed.
      {
        label: "Declarations",
        icon: "file-text",
        href: "/repairable-spares/declarations",
      },
      // FR-8 / FR-9 / FR-11: every finding the checks raise, with an owner.
      {
        label: "Exception Queue",
        icon: "alert-triangle",
        href: "/repairable-spares/exceptions",
      },
      // FR-7: why a new unit was bought while a repairable one existed.
      {
        label: "Justifications",
        icon: "clipboard-check",
        href: "/repairable-spares/justifications",
      },
    ],
  },
}
