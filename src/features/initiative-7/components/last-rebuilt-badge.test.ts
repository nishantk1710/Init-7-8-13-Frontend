import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { LastRebuiltPill } from "@/features/initiative-7/components/last-rebuilt-badge"

function render(rebuiltAt: string | null): string {
  return renderToStaticMarkup(createElement(LastRebuiltPill, { rebuiltAt, timeZone: "Asia/Kolkata" }))
}

describe("the Last rebuilt badge", () => {
  it("says when the results were rebuilt, with the date and the time", () => {
    const markup = render("2026-11-23T18:04:13Z")
    expect(markup).toContain("Last rebuilt: 23 Nov 2026, 23:34")
  })

  it("is an oval in the blue the Clear filters button uses", () => {
    const markup = render("2026-11-23T18:04:13Z")
    expect(markup).toContain("rounded-full")
    expect(markup).toContain("border-action")
    expect(markup).toContain("bg-action/10")
    expect(markup).toContain("text-action")
  })

  it("carries the UTC moment in its tooltip", () => {
    expect(render("2026-11-23T18:04:13Z")).toContain('title="Rebuilt 23 Nov 2026, 18:04 UTC"')
  })

  it("is left out when there is no date, rather than showing a made-up time", () => {
    expect(render(null)).toBe("")
    expect(render("garbage")).toBe("")
  })
})
