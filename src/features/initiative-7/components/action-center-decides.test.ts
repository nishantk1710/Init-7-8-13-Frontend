// Sending and deciding are in different places. A recommendation reached from the Recommendations pages can
// only be sent for approval; the Action Center's Review opens it in review mode (?review=1), where it is
// approved, adjusted, sent back, held or rejected. Read from the sources, the same way no-leakage.test.ts guards
// the scope rule, so the approval buttons cannot drift back onto the Recommendations pages.

import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const read = (file: string) => readFileSync(join(process.cwd(), file), "utf8")
const FEATURE = "src/features/initiative-7"

describe("the Action Center opens a recommendation in review mode", () => {
  const source = read(`${FEATURE}/components/live-approvals-workspace.tsx`)

  it("its Review button and its side panel link to ?review=1", () => {
    const links = source.match(/recommendations\/\$\{rec\.id\}\?review=1/g) ?? []
    expect(links.length).toBe(2)
  })

  it("does not link to a recommendation without review mode", () => {
    expect(source).not.toMatch(/recommendations\/\$\{rec\.id\}`/)
  })

  it("does not carry the approval buttons itself", () => {
    expect(source).not.toContain("LiveDecisionActions")
  })
})

describe("items the Action Center lists as waiting on an approver open in review mode", () => {
  const source = read(`${FEATURE}/selectors/live.ts`)

  it("for pending approval, sent back and held", () => {
    expect(source).toContain('new Set(["PENDING_APPROVAL", "SENT_BACK", "HELD"])')
    expect(source).toContain('?review=1')
  })

  it("but not for ready for review, which nobody has sent yet", () => {
    expect(source).not.toMatch(/READY_FOR_REVIEW[^\n]*review=1/)
  })
})

describe("the recommendation page decides only when opened for review", () => {
  it("the route reads ?review=1 and passes it on", () => {
    const route = read("src/app/(live)/inventory-planning/recommendations/[id]/page.tsx")
    expect(route).toContain("searchParams")
    expect(route).toContain('decide={review === "1"}')
  })

  it("the page shows the approval controls only in that mode", () => {
    const page = read(`${FEATURE}/pages/recommendation-detail-page.tsx`)
    expect(page).toContain('surface={decide ? "action-center" : "recommendation"}')
  })

  it("the expanded row on the Recommendations list never shows them", () => {
    const table = read(`${FEATURE}/components/recommendation-review-table.tsx`)
    expect(table).not.toContain('surface="action-center"')
    expect(table).not.toContain("decide")
  })
})

describe("sending", () => {
  it("shows a toast", () => {
    expect(read(`${FEATURE}/components/live-decision-panel.tsx`)).toContain('toast.success("Sent for approval"')
  })
})
