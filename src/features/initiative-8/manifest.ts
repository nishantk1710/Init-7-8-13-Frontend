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
    ],
  },
}
