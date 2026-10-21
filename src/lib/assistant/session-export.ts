/**
 * One assistant session as a file -- Word, PDF or plain text -- with what the
 * trace screen shows, in its order and wording: the header, why this flow, the
 * advice as served, the plan, the quantity suggestion, the justification and
 * the reservation link. The conversation turns are left out: the decisions they
 * produced are all here, and the back-and-forth would triple the length.
 */

import type { SessionTraceResponse } from "@/lib/api/assistant"
import { factsCaveats, factsHeadline, isI08Facts, isI13Facts } from "@/lib/api/assistant-facts"
import { flowLabel } from "@/lib/assistant/flow-labels"
import {
  BAND_LABEL,
  coverReasonText,
  formatInstant,
  formatWindow,
  planStatusLabel,
  sessionIdentity,
} from "@/lib/assistant/trace-format"
import {
  downloadDocument,
  exportFilename,
  type ExportBlock,
  type ExportDocument,
  type ExportFormat,
} from "@/lib/export-document"
import { sapPlantLabel } from "@/lib/shared-data/sap-plants"

const OUTCOME_LABEL: Record<string, string> = {
  COMPLETED: "Completed",
  OPEN: "Open",
  ABANDONED: "Abandoned",
}

function orNote(value: string | null | undefined, note: string): string {
  return value === null || value === undefined || value === "" ? note : value
}

/** The assessment, as the card shows it: headline, the four figures, flags. */
function assessmentBlocks(facts: unknown): ExportBlock[] {
  const blocks: ExportBlock[] = []
  const headline = factsHeadline(facts)
  if (headline) blocks.push({ kind: "paragraph", text: headline })

  if (isI13Facts(facts)) {
    blocks.push({
      kind: "fields",
      rows: [
        ["Material (as assessed)", `${facts.material} · plant ${facts.plant}${facts.materialScope ? ` · ${facts.materialScope}` : ""}`],
        ["Stock available", orNote(facts.stockOnHand, "—")],
        ["Open PO", orNote(facts.openPoQuantity, "—")],
        [
          "Months of cover",
          orNote(
            facts.monthsOfCover,
            facts.monthsOfCoverReason ? coverReasonText(facts.monthsOfCoverReason) : "cannot be computed"
          ),
        ],
        [
          "Stock type",
          `${BAND_LABEL[facts.agingBand] ?? facts.agingBand}${
            facts.daysSinceLastMovement === null ? "" : ` · ${facts.daysSinceLastMovement} days since last movement`
          }`,
        ],
      ],
    })
    if (facts.grNotIssuedFlag) {
      blocks.push({
        kind: "paragraph",
        text: `Stock received ${facts.grNotIssuedDaysSinceGr ?? "some"} days ago has still not been issued, which is already an open exception.`,
      })
    }
    if (facts.crossPlantStock.length > 0) {
      blocks.push({
        kind: "paragraph",
        text: `Held at other plants: ${facts.crossPlantStock.map((s) => `${s.stockOnHand} at ${s.plant}`).join(", ")}. Shown for information. The platform does not create transfers or reservations, and does not write to SAP at all.`,
      })
    }
  } else if (isI08Facts(facts)) {
    const dueBack =
      facts.soonestDueDate === null
        ? facts.openRepairLines > 0
          ? "no date promised"
          : "no open repair PO"
        : `${facts.soonestDueDate}${facts.repairDueDateIsReliable === false ? " (no longer a forecast)" : ""}`
    blocks.push({
      kind: "fields",
      rows: [
        [
          "Material (as assessed)",
          [facts.materialId, facts.description, `plant ${facts.plant}`, facts.criticality].filter(Boolean).join(" · "),
        ],
        ["Stock available", facts.stockIsUnknown ? "no stock record" : orNote(facts.stockOnHand, "—")],
        ["Open repairs", String(facts.openRepairLines)],
        ["Units in repair", orNote(facts.quantityUnderRepair, "—")],
        ["Earliest due back", dueBack],
      ],
    })
    if (facts.overdueLines > 0) {
      blocks.push({
        kind: "paragraph",
        text: `${facts.overdueLines} of ${facts.openRepairLines} open ${
          facts.openRepairLines === 1 ? "repair is" : "repairs are"
        } already past the promised return date.`,
      })
    }
    if (facts.openRepairs.length > 0) {
      blocks.push({
        kind: "table",
        columns: ["Repair PO / item", "Quantity", "Vendor", "Status", "Overdue"],
        rows: facts.openRepairs.map((r) => [
          [`${r.purchasingDocument}/${r.item}`],
          [r.quantity],
          [r.vendorName ?? r.vendor ?? "vendor not named"],
          [r.status, ...(r.dispatched ? [] : ["no dispatch movement recorded"])],
          [r.daysOverdue !== null && r.daysOverdue > 0 ? `${r.daysOverdue} days` : "—"],
        ]),
      })
    }
  }

  for (const caveat of factsCaveats(facts)) blocks.push({ kind: "paragraph", text: caveat, muted: true })
  return blocks
}

/** Everything the session trace shows, bar the conversation turns, as a document. */
export function sessionDocument(trace: SessionTraceResponse, now: Date = new Date()): ExportDocument {
  const linked = trace.linkedReservations ?? []
  const identity = sessionIdentity(trace)
  const blocks: ExportBlock[] = [
    {
      kind: "fields",
      rows: [
        ...(identity.requestId
          ? ([
              ["Request line", identity.label],
              ["Type in SAP", identity.sapText],
              ["Session ID", trace.sessionId],
            ] as [string, string][])
          : ([["Session reference", trace.sessionId]] as [string, string][])),
        ["Flow", flowLabel(trace.flow)],
        ["Outcome", OUTCOME_LABEL[trace.outcome] ?? trace.outcome],
        [
          "Material",
          trace.materialDescription ? `${trace.materialDescription} (${trace.materialId})` : trace.materialId,
        ],
        ["Plant", sapPlantLabel(trace.plant)],
        ["Requester", orNote(trace.requestedFor, "not stated")],
        ["Department", orNote(trace.department, "not stated")],
        ...(trace.requestedQuantity !== null ? [["Quantity asked for", trace.requestedQuantity] as [string, string]] : []),
        ["Opened from", trace.origin === "BADI" ? "SAP" : "the platform"],
        ["Issued", formatInstant(trace.issuedAt)],
        ["Reference valid until", `${formatInstant(trace.expiresAt)}${trace.expired ? " (expired)" : ""}`],
      ],
    },
    { kind: "heading", text: "Why this flow" },
    { kind: "paragraph", text: trace.routingReason },
    { kind: "heading", text: "The advice, as it was served" },
    {
      kind: "paragraph",
      text: "Replayed from what was recorded at the time, not recomputed. Stock and repair status have moved since.",
      muted: true,
    },
    ...assessmentBlocks(trace.assessment),
    ...(trace.narrative ? ([{ kind: "paragraph", text: `Generated narrative: ${trace.narrative}` }] satisfies ExportBlock[]) : []),
  ]

  if (trace.plans.length > 0) {
    blocks.push(
      { kind: "heading", text: "Consumption plan" },
      {
        kind: "table",
        columns: ["Purpose", "Planned quantity", "Expected use", "Status", "Captured"],
        rows: trace.plans.map((p) => [
          [p.purpose],
          [p.plannedQuantity],
          [formatWindow(p.windowStart, p.windowEnd) ?? "no window given"],
          [planStatusLabel(p.status)],
          [p.capturedBy, formatInstant(p.capturedAt)],
        ]),
      }
    )
  }

  if (trace.quantitySuggestions.length > 0) {
    blocks.push(
      { kind: "heading", text: "Quantity suggestion" },
      {
        kind: "table",
        columns: ["Why", "Asked for", "Suggested", "Recorded as", "Months of cover"],
        rows: trace.quantitySuggestions.map((s) => [
          [s.suggestionReason, ...(s.isOverride ? ["The requester kept their own quantity."] : [])],
          [s.requestedQuantity],
          [orNote(s.suggestedQuantity, "no suggestion made")],
          [s.acceptedQuantity],
          [orNote(s.monthsOfCover, "not computable")],
        ]),
      },
      ...trace.quantitySuggestions.map(
        (s): ExportBlock => ({
          kind: "paragraph",
          muted: true,
          text: `Computed against a ${s.coverCeilingMonths}-month cover ceiling, a ${s.lookbackMonths}-month look-back and a minimum of ${s.minHistoryConsumptions} consumptions -- ${s.consumptionCount} found. All three are configuration and none is confirmed by VZI yet.`,
        })
      )
    )
  }

  if (trace.justifications.length > 0) {
    blocks.push(
      { kind: "heading", text: "Justification recorded" },
      {
        kind: "table",
        columns: ["Kind", "Reason", "Text", "Recorded"],
        rows: trace.justifications.map((j) => [
          [j.kind.replace(/_/g, " ").toLowerCase()],
          [j.reasonCategory.replace(/_/g, " ")],
          [j.freeText],
          [j.author, formatInstant(j.recordedAt)],
        ]),
      }
    )
  }

  blocks.push({ kind: "heading", text: "Link to the reservation" }, { kind: "paragraph", text: trace.linkageNote })
  if (linked.length > 0) {
    blocks.push({
      kind: "table",
      columns: ["Reservation / item", "Item text (SGTXT)"],
      rows: linked.map((l) => [[`${l.reservationNumber}/${l.reservationItem}`], [l.sgtxt ?? ""]]),
    })
  } else {
    blocks.push({
      kind: "paragraph",
      muted: true,
      text: `The link is read from the reservation's item text (SGTXT) in the loaded SAP extract. Until a reservation carrying ${
        identity.requestId ? `request ${identity.requestId} for this material` : "this session's ID"
      } is loaded, this session stands on its own: it records what the planner was told and what they decided.`,
    })
  }

  return {
    title: `Assistant session ${identity.label}`,
    subtitle: "What the assistant said, what the requester decided, and what was recorded.",
    generatedAt: now.toLocaleString("en-GB"),
    blocks,
  }
}

export function downloadSession(trace: SessionTraceResponse, format: ExportFormat): Promise<boolean> {
  const now = new Date()
  return downloadDocument(sessionDocument(trace, now), format, exportFilename("session", trace.sessionId, format, now))
}
