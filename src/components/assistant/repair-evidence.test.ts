// The repairs behind an I08 assessment, as both the chat's card and the
// request builder show them (4-Nov-2026): one list, so they cannot drift apart.

import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { RepairEvidenceList } from "@/components/assistant/repair-evidence"
import type { I08OpenRepair, I08OpenRepairRequest } from "@/lib/api/assistant-facts"

function repair(overrides: Partial<I08OpenRepair> = {}): I08OpenRepair {
  return {
    purchasingDocument: "4500001723",
    item: "80",
    quantity: "1.000",
    raisedAt: "2026-05-20",
    dueDate: "2026-07-31",
    daysOverdue: 95,
    vendor: "400093",
    vendorName: "SPRINGBOK MOTOR REWINDS (PTY)",
    status: "PO Issued",
    dispatched: false,
    ...overrides,
  }
}

const request: I08OpenRepairRequest = {
  purchaseRequisition: "2000029216",
  item: "10",
  quantity: "1.000",
  requestedAt: "2026-05-18",
  daysSinceRequested: 169,
  department: "10303",
  departmentName: "ENGG-PLANT MAINT. CLERK / FOREMAN FITTER",
  repairOrder: null,
}

function text(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
}

describe("RepairEvidenceList", () => {
  const html = renderToStaticMarkup(
    createElement(RepairEvidenceList, {
      repairs: [
        repair(),
        repair({ purchasingDocument: "4500001641", item: "700", dueDate: "2026-06-30", daysOverdue: 126 }),
      ],
      requests: [request],
    }),
  )
  const shown = text(html)

  it("names each repair PO by number and item, the earliest due back first", () => {
    expect(shown.indexOf("PO 4500001641/700")).toBeGreaterThan(-1)
    expect(shown.indexOf("PO 4500001641/700")).toBeLessThan(shown.indexOf("PO 4500001723/80"))
    expect(shown).toContain("On repair · 2")
  })

  it("labels the vendor, so it never reads as another material", () => {
    expect(shown).toContain("Vendor: SPRINGBOK MOTOR REWINDS (PTY)")
    expect(shown).toContain("Due 30 Jun 2026")
    expect(shown).toContain("126 days overdue")
  })

  it("lists the PRs raised with no PO apart, with who raised them and when", () => {
    expect(shown).toContain("PR raised, no PO · 1")
    expect(shown).toContain("PR 2000029216/10")
    expect(shown).toContain("raised 169 days ago")
    expect(shown).toContain("Raised by 10303 · ENGG-PLANT MAINT. CLERK / FOREMAN FITTER")
  })

  it("says when a unit was sent to the vendor, and nothing when it was not", () => {
    expect(shown).not.toContain("Sent to vendor")
    const sent = text(
      renderToStaticMarkup(
        createElement(RepairEvidenceList, {
          repairs: [repair({ dispatched: true, dispatchedAt: "2026-07-24", status: "At Vendor" })],
          requests: [],
        }),
      ),
    )
    expect(sent).toContain("Sent to vendor 24 Jul 2026")
  })

  it("shows a vendor code when the supplier master has no name, and renders nothing when empty", () => {
    const coded = text(
      renderToStaticMarkup(
        createElement(RepairEvidenceList, { repairs: [repair({ vendorName: null })], requests: [] }),
      ),
    )
    expect(coded).toContain("Vendor: 400093")
    expect(renderToStaticMarkup(createElement(RepairEvidenceList, { repairs: [], requests: [] }))).toBe("")
  })
})
