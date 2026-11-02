/**
 * One assistant session as a file -- Word, PDF or plain text -- with what the
 * session page shows, in its order and wording: the reference with its one
 * instruction, the summary and decision, the advice as served, the plan, the
 * quantity suggestion, the reason and the declaration recorded, and what SAP
 * has linked. The conversation turns are left out: the decisions they
 * produced are all here, and the back-and-forth would triple the length.
 */

import type { SessionTraceResponse } from "@/lib/api/assistant"
import { factsCaveats, factsHeadline, isI08Facts, isI13Facts } from "@/lib/api/assistant-facts"
import { flowLabel } from "@/lib/assistant/flow-labels"
import {
  dueBackNullNote,
  needDateAdviceOf,
  openRepairsSuffix,
  repairRequestsOf,
  requestAgePhrase,
  requestDepartmentText,
  requestReference,
  stockFigure,
} from "@/lib/assistant/i08-facts-format"
import {
  BAND_LABEL,
  coverReasonText,
  formatDay,
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
import {
  declarationViews,
  declaredState,
  formatQuantity,
  personLabel,
  readableText,
  reasonViews,
  referenceInstruction,
  sessionDecision,
} from "@/lib/assistant/session-view"
import { departmentText } from "@/lib/assistant/request/record"
import { sapPlantLabel } from "@/lib/shared-data/sap-plants"

const OUTCOME_LABEL: Record<string, string> = {
  COMPLETED: "Completed",
  OPEN: "Open",
  ABANDONED: "Abandoned",
}

function orNote(value: string | null | undefined, note: string): string {
  return value === null || value === undefined || value === "" ? note : value
}

/** A quantity without SAP's padding, or the note when there is none. */
function qtyOr(value: string | null | undefined, note: string): string {
  return value === null || value === undefined || value === "" ? note : formatQuantity(value)
}

/** The assessment, as the card shows it: headline, the four figures, flags. */
function assessmentBlocks(facts: unknown): ExportBlock[] {
  const blocks: ExportBlock[] = []
  const headline = factsHeadline(facts)
  if (headline) blocks.push({ kind: "paragraph", text: readableText(headline) })

  if (isI13Facts(facts)) {
    blocks.push({
      kind: "fields",
      rows: [
        ["Material (as assessed)", `${facts.material} · plant ${facts.plant}${facts.materialScope ? ` · ${facts.materialScope}` : ""}`],
        ["Stock available", qtyOr(facts.stockOnHand, "—")],
        ["Open PO", qtyOr(facts.openPoQuantity, "—")],
        [
          "Months of cover",
          qtyOr(
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
        text: `Held at other plants: ${facts.crossPlantStock.map((s) => `${qtyOr(s.stockOnHand, "—")} at ${s.plant}`).join(", ")}. Shown for information. The platform does not create transfers or reservations, and does not write to SAP at all.`,
      })
    }
  } else if (isI08Facts(facts)) {
    // The same formatter as the card, so a record from before the 27-Oct
    // usable/damaged split and repair requests downloads as it did then.
    const dueBack =
      facts.soonestDueDate === null
        ? dueBackNullNote(facts)
        : `${formatDay(facts.soonestDueDate)}${facts.repairDueDateIsReliable === false ? " (no longer a forecast)" : ""}`
    const stock = stockFigure(facts)
    const requestsSuffix = openRepairsSuffix(facts)
    blocks.push({
      kind: "fields",
      rows: [
        [
          "Material (as assessed)",
          [facts.materialId, facts.description, `plant ${facts.plant}`, facts.criticality].filter(Boolean).join(" · "),
        ],
        [stock.label, `${qtyOr(stock.value, stock.nullNote)}${stock.suffix ? ` (${stock.suffix})` : ""}`],
        ["Open repairs", `${facts.openRepairLines}${requestsSuffix ? ` (${requestsSuffix})` : ""}`],
        ["Units in repair", qtyOr(facts.quantityUnderRepair, "—")],
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
    const needDateAdvice = needDateAdviceOf(facts)
    if (needDateAdvice) blocks.push({ kind: "paragraph", text: readableText(needDateAdvice) })
    if (facts.openRepairs.length > 0) {
      blocks.push({
        kind: "table",
        columns: ["Repair PO / item", "Quantity", "Vendor", "Status", "Overdue"],
        rows: facts.openRepairs.map((r) => [
          [`${r.purchasingDocument}/${r.item}`],
          [formatQuantity(r.quantity)],
          [r.vendorName ?? r.vendor ?? "vendor not named"],
          [r.status, ...(r.dispatched ? [] : ["no dispatch movement recorded"])],
          [r.daysOverdue !== null && r.daysOverdue > 0 ? `${r.daysOverdue} days` : "—"],
        ]),
      })
    }
    const requests = repairRequestsOf(facts)
    if (requests.length > 0) {
      blocks.push({
        kind: "table",
        columns: ["Requested, not yet ordered", "Quantity", "Requested", "Department"],
        rows: requests.map((r) => [
          [requestReference(r)],
          [formatQuantity(r.quantity)],
          [requestAgePhrase(r.daysSinceRequested)],
          [requestDepartmentText(r) ?? "not stated"],
        ]),
      })
    }
  }

  for (const caveat of factsCaveats(facts)) blocks.push({ kind: "paragraph", text: readableText(caveat), muted: true })
  return blocks
}

/** Everything the session trace shows, bar the conversation turns, as a document. */
export function sessionDocument(trace: SessionTraceResponse, now: Date = new Date()): ExportDocument {
  const linked = trace.linkedReservations ?? []
  const identity = sessionIdentity(trace)
  const reference = referenceInstruction(identity)
  const declared = trace.flow === "i08" ? declaredState(trace) : null
  const blocks: ExportBlock[] = [
    {
      kind: "fields",
      rows: [
        ...(identity.requestId
          ? ([
              ["Request line", identity.label],
              ["Type in SAP", identity.sapText],
            ] as [string, string][])
          : ([["Session reference", trace.sessionId]] as [string, string][])),
        ["How to type it", reference.instruction],
        ["Flow", flowLabel(trace.flow)],
        ["Outcome", OUTCOME_LABEL[trace.outcome] ?? trace.outcome],
        ["Decision", sessionDecision(trace).text],
        ...(declared ? ([["Faulty unit declared", declared.text]] as [string, string][]) : []),
        [
          "Material",
          trace.materialDescription ? `${trace.materialDescription} (${trace.materialId})` : trace.materialId,
        ],
        ["Plant", sapPlantLabel(trace.plant)],
        ["Requester", orNote(trace.requestedFor, "not stated")],
        ["Department", trace.department ? departmentText(trace.department, trace.departmentName) : "not stated"],
        ...(trace.requestedQuantity !== null
          ? [["Quantity asked for", formatQuantity(trace.requestedQuantity)] as [string, string]]
          : []),
        ["Opened from", trace.origin === "BADI" ? "SAP" : "the platform"],
        ["Issued", formatInstant(trace.issuedAt)],
        ["Reference valid until", `${formatInstant(trace.expiresAt)}${trace.expired ? " (expired)" : ""}`],
      ],
    },
    { kind: "heading", text: "Why this flow" },
    { kind: "paragraph", text: readableText(trace.routingReason) },
    { kind: "heading", text: "What the assistant showed" },
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
          [formatQuantity(p.plannedQuantity)],
          [formatWindow(p.windowStart, p.windowEnd) ?? "no window given"],
          [planStatusLabel(p.status)],
          [personLabel(p.capturedBy, trace.requestedFor), formatInstant(p.capturedAt)],
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
          [readableText(s.suggestionReason), ...(s.isOverride ? ["The requester kept their own quantity."] : [])],
          [formatQuantity(s.requestedQuantity)],
          [qtyOr(s.suggestedQuantity, "no suggestion made")],
          [formatQuantity(s.acceptedQuantity)],
          [qtyOr(s.monthsOfCover, "not computable")],
        ]),
      },
      ...trace.quantitySuggestions.map(
        (s): ExportBlock => ({
          kind: "paragraph",
          muted: true,
          text: `Computed against a ${formatQuantity(s.coverCeilingMonths)}-month cover ceiling, a ${s.lookbackMonths}-month look-back and a minimum of ${s.minHistoryConsumptions} consumptions (${s.consumptionCount} found). All three are configuration and none is confirmed by VZI yet.`,
        })
      )
    )
  }

  const reasons = reasonViews(trace.justifications, trace.requestedFor)
  if (reasons.length > 0) {
    blocks.push(
      { kind: "heading", text: "Reason recorded" },
      {
        kind: "table",
        columns: ["For", "Reason", "In their own words", "Recorded"],
        rows: reasons.map((r) => [[r.heading], [r.reason], [r.text], [r.by, formatInstant(r.recordedAt)]]),
      }
    )
  }

  const declarations = trace.flow === "i08" ? declarationViews(trace) : []
  if (declarations.length > 0) {
    blocks.push(
      { kind: "heading", text: "Declaration recorded" },
      ...declarations.map(
        (d): ExportBlock => ({
          kind: "fields",
          rows: [
            ["Assessment", d.assessment],
            ["Fault", d.fault],
            ["Condition", orNote(d.condition, "not described")],
            ["Quantity", d.quantity],
            ["Typed name", d.name],
            ["Evidence", d.evidence ?? "none given"],
            ...(d.repairLine ? ([["Repair line", d.repairLine]] as [string, string][]) : []),
            ...(d.recordedAt ? ([["Recorded", formatInstant(d.recordedAt)]] as [string, string][]) : []),
          ],
        })
      )
    )
  }

  blocks.push({ kind: "heading", text: "Linked in SAP" })
  if (linked.length > 0) {
    blocks.push({
      kind: "table",
      columns: ["Reservation / item", "Its text in SAP"],
      rows: linked.map((l) => [[`${l.reservationNumber}/${l.reservationItem}`], [l.sgtxt ?? ""]]),
    })
  } else {
    blocks.push({
      kind: "paragraph",
      text: `Not linked yet. The link appears once a SAP reservation carrying ${reference.value} reaches the platform.`,
    })
  }

  return {
    title: `Assistant session ${identity.label}`,
    subtitle: "What the assistant said, what the requester decided, and what was recorded.",
    generatedAt: formatInstant(now.toISOString()),
    blocks,
  }
}

export function downloadSession(trace: SessionTraceResponse, format: ExportFormat): Promise<boolean> {
  const now = new Date()
  return downloadDocument(sessionDocument(trace, now), format, exportFilename("session", exportId(trace), format, now))
}

/** The file name's ID: `R…-n` for a request line (no slash in a file name), the session ID otherwise. */
export function exportId(trace: SessionTraceResponse): string {
  const { requestId, lineNo } = sessionIdentity(trace)
  if (!requestId) return trace.sessionId
  return lineNo !== null ? `${requestId}-${lineNo}` : requestId
}
