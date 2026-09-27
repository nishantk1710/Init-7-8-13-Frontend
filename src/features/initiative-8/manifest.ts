import type { InitiativeManifest } from "@/lib/domain/manifest"

export const initiative8Manifest: InitiativeManifest = {
  id: "initiative-8",
  name: "Repairable Spares",
  description:
    "Repair-chain visibility and duplicate-procurement guarding for repairable spares",
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
      {
        label: "Duplicate Guard",
        icon: "copy",
        href: "/repairable-spares/duplicate-guard",
      },
      {
        label: "Declaration Queue",
        icon: "file-text",
        href: "/repairable-spares/declarations",
      },
      // Every finding the I08 checks raise: missing attestations, and new
      // units bought while a repair was open with no justification recorded.
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
      // FR-7's half of the record: why somebody bought new while a repairable
      // unit already existed. Initiative 08 had no screen for this at all.
      {
        label: "Justifications",
        icon: "clipboard-check",
        href: "/repairable-spares/justifications",
      },
    ],
  },
}
