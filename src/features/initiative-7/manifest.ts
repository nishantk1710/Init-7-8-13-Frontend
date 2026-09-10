import type { InitiativeManifest } from "@/lib/domain/manifest"

export const initiative7Manifest: InitiativeManifest = {
  id: "initiative-7",
  name: "Inventory Planning",
  description:
    "Criticality-aware ROP, safety-stock and max-stock recommendations",
  // The module's own overview/monitoring page — also where Home's summary
  // card "open" link lands.
  href: "/inventory-planning",
  navSection: {
    title: "Inventory Planning",
    items: [
      { label: "Overview", icon: "package", href: "/inventory-planning" },
      {
        label: "Recommendations",
        icon: "lightbulb",
        href: "/inventory-planning/recommendations",
      },
      {
        label: "Pipeline",
        icon: "gauge",
        href: "/inventory-planning/pipeline",
      },
    ],
  },
}
