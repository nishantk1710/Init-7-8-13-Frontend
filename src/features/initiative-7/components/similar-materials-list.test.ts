// The similar-materials card: which controls and messages show for which state.
//
// Rendered to static markup with react-dom/server (this project's vitest runs without a DOM), through the
// presentational `SimilarMaterialsCard`; the stateful `SimilarMaterialsList` only feeds it.

import { describe, expect, it, vi } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { ApiError } from "@/lib/api/client"
import type { SimilarMaterial, SimilarMaterialsView } from "@/features/initiative-7/services/i7-api"
import {
  SimilarMaterialsCard,
  changeErrorMessage,
  type SimilarMaterialsCardProps,
} from "./similar-materials-list"

const neighbour = (n: number, overrides: Partial<SimilarMaterial> = {}): SimilarMaterial => ({
  rank: n,
  material: `D000${n}`,
  plant: "1300",
  description: `Bearing ${n}`,
  similarity: 0.9 - n / 10,
  criticality: "NORMAL",
  historyMonths: 24,
  rop: 8,
  safetyStock: 3,
  maxStock: 20,
  contributed: true,
  ...overrides,
})

const VIEW: SimilarMaterialsView = {
  items: [neighbour(1), neighbour(2), neighbour(3)],
  excluded: [],
  canEdit: true,
  editBlockedReason: null,
  minimumNeighbours: 2,
}

function render(overrides: Partial<SimilarMaterialsCardProps> = {}, view: SimilarMaterialsView = VIEW): string {
  return renderToStaticMarkup(
    createElement(SimilarMaterialsCard, {
      state: { status: "ready", view },
      confirming: null,
      reason: "",
      busy: null,
      actionError: null,
      onAskRemove: vi.fn(),
      onCancel: vi.fn(),
      onReasonChange: vi.fn(),
      onConfirmRemove: vi.fn(),
      onRestore: vi.fn(),
      ...overrides,
    })
  )
}

describe("removing a similar material", () => {
  it("offers Remove on every row when the recommendation can still be changed", () => {
    const markup = render()
    expect(markup.match(/>Remove</g)).toHaveLength(3)
    expect(markup).toContain("At least 2 similar materials are needed")
  })

  it("offers nothing -- and says why -- once the recommendation is past review", () => {
    const markup = render(
      {},
      { ...VIEW, canEdit: false, editBlockedReason: "Similar materials can only be changed before a recommendation is submitted or while it is sent back; this one is APPROVED." }
    )
    expect(markup).not.toContain(">Remove<")
    expect(markup).not.toContain(">Action<")
    expect(markup).toContain("this one is APPROVED")
  })

  it("offers nothing against a backend that predates removal (canEdit unknown)", () => {
    const markup = render({}, { ...VIEW, canEdit: null })
    expect(markup).not.toContain(">Remove<")
    expect(markup).not.toContain("At least")
  })

  it("asks for confirmation and an optional reason before removing", () => {
    const markup = render({ confirming: VIEW.items[1], reason: "other part family" })
    expect(markup).toContain("Remove <span")
    expect(markup).toContain("Bearing 2")
    expect(markup).toContain("Reason (optional)")
    expect(markup).toContain("other part family")
    expect(markup).toContain("Confirm remove")
    expect(markup).toContain("Nothing takes its place")
    expect(markup).toContain("recalculated from the ones that remain")
    expect(markup).not.toContain("next closest")
    expect(markup).toContain("Other materials are not affected")
    // a space between the material name and "from" (it once rendered as "6Mfrom")
    expect(markup).toMatch(/Bearing 2<\/span>\s+from this/)
  })

  it("disables every control while a request is in flight and says what is happening", () => {
    const markup = render({ confirming: VIEW.items[0], busy: "D0001-1300" })
    expect(markup).toContain("Removing…")
    // every Remove / Confirm / Cancel button is disabled
    const buttons = markup.match(/<button[^>]*>/g) ?? []
    expect(buttons.length).toBeGreaterThanOrEqual(5)
    expect(buttons.every((tag) => tag.includes("disabled"))).toBe(true)
  })

  it("shows the backend's refusal where the person is looking, as an alert", () => {
    const markup = render({
      actionError: "Cannot remove this similar material: 1 similar material(s) would be left and at least 2 are needed.",
    })
    expect(markup).toContain('role="alert"')
    expect(markup).toContain("at least 2 are needed")
  })
})

describe("a removed similar material", () => {
  const withRemoved = (overrides: Partial<SimilarMaterialsView["excluded"][number]> = {}): SimilarMaterialsView => ({
    ...VIEW,
    items: [neighbour(2), neighbour(3)],
    excluded: [
      {
        material: "D0001",
        plant: "1300",
        description: "Bearing 1",
        similarity: 0.82,
        rank: 1,
        reason: "different shaft size",
        excludedBy: "alice",
        excludedAt: "2026-10-25T10:00:00Z",
        ...overrides,
      },
    ],
  })

  it("is listed apart from the used ones, marked as removed by a user, with who, why and its old score", () => {
    const markup = render({}, withRemoved())
    expect(markup).toContain("Removed for this material (1)")
    expect(markup).toContain("Removed by a user")
    expect(markup).toContain("Removed by alice")
    expect(markup).toContain("different shaft size")
    expect(markup).toContain("was a 82% match")
    expect(markup).toContain(">Restore<")
  })

  it("is not mistaken for a material that failed the similarity rules: that label is only 'not used in estimate'", () => {
    const view = withRemoved()
    view.items = [neighbour(2, { contributed: false }), neighbour(3)]
    const markup = render({}, view)
    expect(markup).toContain("not used in estimate")
    expect(markup).toContain("Removed by a user")
  })

  it("does not present a placeholder identity as a signed-in person", () => {
    const markup = render({}, withRemoved({ excludedBy: "UNAUTHENTICATED-FRONTEND" }))
    expect(markup).toContain("UNAUTHENTICATED-FRONTEND (not signed in)")
  })

  it("has no Restore button when the recommendation can no longer be changed", () => {
    const view = { ...withRemoved(), canEdit: false, editBlockedReason: "It is approved." }
    expect(render({}, view)).not.toContain(">Restore<")
  })

  it("shows 'Restoring…' on the entry being restored", () => {
    expect(render({ busy: "D0001-1300" }, withRemoved())).toContain("Restoring…")
  })
})

describe("the ordinary states are unchanged", () => {
  it("says so when there are no similar materials at all", () => {
    expect(render({}, { ...VIEW, items: [], canEdit: false })).toContain("No similar materials were recorded")
  })

  it("loads and fails as before", () => {
    expect(render({ state: { status: "loading" } })).toContain("Loading similar materials…")
    expect(render({ state: { status: "error" } })).toContain("could not be loaded")
  })
})

describe("changeErrorMessage", () => {
  it("passes on the reason the backend gave for a refusal", () => {
    const refused = new ApiError("POST /x failed with 409", 409, "RECOMMENDATION_NOT_EDITABLE", "It is approved.")
    expect(changeErrorMessage(refused)).toBe("It is approved.")
  })

  it("does not pass on a server fault's internals", () => {
    const fault = new ApiError("POST /x failed with 500", 500, undefined, "Internal server error")
    expect(changeErrorMessage(fault)).toContain("Nothing was changed")
    expect(changeErrorMessage(new TypeError("fetch failed"))).toContain("Nothing was changed")
  })
})
