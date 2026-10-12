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
      //
      // The Declaration and Exception queues were folded into the register on
      // 08-Oct-2026 and brought back on 12-Oct, after the 09-Oct FRS audit.
      // The reasoning for folding them in was that the register shows each
      // line's own findings, which it does -- but that answers "what is the
      // state of THIS line", and FR-4, FR-8, FR-9 and FR-11 ask "what is
      // outstanding across all of them". Acceptance criteria 5 and 11 ask for
      // the queue by name. You cannot work a queue you have to assemble from
      // a register sorted by something else.
      {
        // Distinct from Justifications' clipboard below: one records a
        // condition that WAS assessed, the other a purchase made anyway.
        label: "Declarations",
        icon: "check-circle",
        href: "/repairable-spares/declarations",
      },
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
      // unit already existed. Each repair line also shows its own in the
      // register, but most reasons belong to no line -- FR-5 asks for one when
      // a unit is on the shelf or removed and not yet sent for repair -- so the
      // full log keeps its own screen.
      {
        label: "Justifications",
        icon: "clipboard-check",
        href: "/repairable-spares/justifications",
      },
    ],
  },
}
