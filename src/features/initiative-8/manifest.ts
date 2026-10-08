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
