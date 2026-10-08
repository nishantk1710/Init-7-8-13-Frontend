import type { InitiativeManifest } from "@/lib/domain/manifest"

/**
 * The nav carries only what the I13 FRS (v1.2) scopes, one item per screen.
 *
 * Removed, not forgotten: Redeployment (FRS §3.2 / D10 defers the workflow;
 * cross-plant stock stays as visibility on Exceptions and in the assistant), and
 * the separate Overview, 30-Day GR-Not-Issued and Usage Pattern screens, which
 * are now the Dashboard and two WATCH tabs. Reclassification and Validation
 * belong to Initiative 7, not here; captured consumption plans are a Dashboard
 * tab rather than a screen of their own. Their old URLs redirect.
 *
 * The reservation-time assistant (FR-2, FR-3) is not listed here: it is shared
 * with Initiative 8 and already has its own section at the top of the sidebar.
 */
export const initiative13Manifest: InitiativeManifest = {
  id: "initiative-13",
  name: "OAR Utilization",
  description:
    "End-to-end tracking of OAR spares demand from reservation through utilization",
  // The module's landing page is the FR-10 dashboard — also where Home's
  // summary card "open" link lands.
  href: "/oar-utilization",
  navSection: {
    title: "OAR Utilization",
    items: [
      // FR-10: KPIs, aging, non-movers, acquired vs plan, exceptions, captured
      // plans and justifications in one view.
      { label: "Dashboard", icon: "layout-dashboard", href: "/oar-utilization" },
      // FR-5: the deterministic STITCH ledger.
      {
        label: "Utilization Ledger",
        icon: "layers",
        href: "/oar-utilization/ledger",
      },
      // FR-7 detection and the FR-9 ACT queue with HOD escalation.
      {
        label: "Exceptions",
        icon: "alert-triangle",
        href: "/oar-utilization/aging-exceptions",
      },
      // FR-1 and FR-6, with the 30-day GR-not-issued lines and the monthly
      // usage pattern as tabs (?view=grni | usage).
      {
        label: "WATCH",
        icon: "eye",
        href: "/oar-utilization/watch",
      },
    ],
  },
}
