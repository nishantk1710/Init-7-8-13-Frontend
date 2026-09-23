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
        label: "Utilisation Dashboard",
        icon: "gauge",
        href: "/oar-utilization/utilisation-dashboard",
      },
      {
        label: "Utilization Ledger",
        icon: "layers",
        href: "/oar-utilization/ledger",
      },
      {
        label: "Exceptions",
        icon: "clock",
        href: "/oar-utilization/aging-exceptions",
      },
      // FR-4's record, and the one screen this module never had. The plans
      // captured through the assistant are what separate a real
      // acquired-versus-plan figure from one resting on generated reference
      // data, so they get a place in the nav rather than only a dashboard panel.
      {
        label: "Consumption Plans",
        icon: "clipboard-check",
        href: "/oar-utilization/plans",
      },
      {
        label: "WATCH",
        icon: "eye",
        href: "/oar-utilization/watch",
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
      {
        label: "Validation",
        icon: "clipboard-check",
        href: "/oar-utilization/validation",
      },
    ],
  },
}
