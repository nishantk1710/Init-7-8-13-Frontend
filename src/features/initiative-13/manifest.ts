import type { InitiativeManifest } from "@/lib/domain/manifest"

export const initiative13Manifest: InitiativeManifest = {
  id: "initiative-13",
  name: "OAR Utilization",
  description:
    "End-to-end tracking of OAR spares demand from reservation through utilization",
  // The module's own overview page — also where Home's summary card "open"
  // link lands.
  href: "/oar-utilization",
  navSection: {
    title: "OAR Utilization",
    items: [
      { label: "Overview", icon: "package", href: "/oar-utilization" },
      {
        label: "Utilization Ledger",
        icon: "layers",
        href: "/oar-utilization/ledger",
      },
      {
        label: "Aging Exceptions",
        icon: "clock",
        href: "/oar-utilization/aging-exceptions",
      },
      {
        label: "Redeployment",
        icon: "arrows-right-left",
        href: "/oar-utilization/redeployment",
      },
      {
        label: "Reclassification",
        icon: "sliders",
        href: "/oar-utilization/reclassification",
      },
    ],
  },
}
