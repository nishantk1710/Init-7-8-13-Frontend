import type { Metadata } from "next"

import { AskBox } from "@/components/assistant/ask-box"
import { AssistantOpener } from "@/components/assistant/assistant-opener"
import { PageHeader } from "@/components/shared/page-header"

export const metadata: Metadata = {
  title: "Reservation assistant — Spares AI",
}

/**
 * The assistant's landing page.
 *
 * Shared by Initiative 08 and Initiative 13 on purpose, and deliberately not
 * filed under either. The SAP pop-up knows a material and a plant; it cannot
 * know whether that material is repairable or planned-on-demand, because
 * working that out is the thing the assistant does. A per-initiative entry
 * point would make the caller answer the one question it came to ask.
 */
export default function AssistantPage() {
  return (
    <div className="flex flex-col gap-5 p-6">
      <PageHeader
        title="Reservation assistant"
        description="Checks a spare before you reserve it — what is already in repair, what is already on the shelf, and how much you actually need."
      />

      <AssistantOpener />

      {/* Separate from the conversation on purpose. `/api/assistant/ask` is a
          stateless intent matcher that writes nothing, so putting it in the
          same input as a turn answer would make an unrecorded answer look
          recorded. It lives here and on the session log, never inside an
          open session. */}
      <AskBox />

      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-medium text-foreground">
          What it will tell you
        </h2>
        <dl className="flex flex-col gap-2 text-sm">
          <div>
            <dt className="font-medium text-foreground">
              For a repairable (80-series) part
            </dt>
            <dd className="text-muted-foreground">
              Whether a unit already exists — on the shelf, or on a repair
              order with a due date — and how far past that date it is. If you
              still need a new one, it records why.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">
              For a planned-on-demand (OAR) part
            </dt>
            <dd className="text-muted-foreground">
              Stock on hand, what is already on order, months of cover, how
              recently it moved, and what other plants hold. Then it captures
              the consumption plan and suggests a quantity.
            </dd>
          </div>
        </dl>
        <p className="text-xs text-muted-foreground">
          Nothing here writes to SAP, and nothing blocks a reservation. The
          platform advises and records; the reservation is yours to make.
        </p>
      </div>
    </div>
  )
}
