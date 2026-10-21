import { readFileSync } from "node:fs"
import { join } from "node:path"

import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { LoadingSpinner, PETALS } from "./loading-spinner"

const render = (props: Parameters<typeof LoadingSpinner>[0]) => renderToStaticMarkup(createElement(LoadingSpinner, props))
const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8")

describe("LoadingSpinner", () => {
  const html = render({ label: "Loading cards", className: "h-[76px]" })

  it("is a ring of twelve petals", () => {
    expect(html.match(/<path /g)).toHaveLength(12)
    expect(html).toContain("spinner-petals")
  })

  it("fades from dark to light in a single colour: every petal is the same colour and only the opacity changes", () => {
    expect(PETALS[0].opacity).toBe(1)
    for (let i = 1; i < PETALS.length; i++) expect(PETALS[i].opacity).toBeLessThan(PETALS[i - 1].opacity)
    expect(PETALS[PETALS.length - 1].opacity).toBeGreaterThan(0.1)  // a pale trace, not invisible
    expect(html).toContain('fill="currentColor"')
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,6}\b/)
    expect(html).not.toMatch(/ stroke=/)
  })

  it("spreads the petals evenly round the circle", () => {
    expect(PETALS.map((p) => p.angle)).toEqual([0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330])
  })

  it("takes the one theme colour it is given", () => {
    expect(html).toContain("text-primary")
    expect(render({ label: "x", tone: "danger" })).toContain("text-destructive")
    expect(render({ label: "x", tone: "success" })).toContain("text-success")
    expect(render({ label: "x", tone: "warning" })).toContain("text-warning")
  })

  it("is announced to a screen reader, and the drawing itself is hidden from one", () => {
    expect(html).toContain('role="status"')
    expect(html).toContain('aria-label="Loading cards"')
    expect(html).toContain('aria-hidden="true"')
    expect(html).toContain("sr-only")
  })

  it("takes the height it is given, so the layout does not jump", () => {
    expect(html).toContain("h-[76px]")
  })
})

describe("the turning", () => {
  it("is twelve steps, one petal at a time, and slows for reduced motion", () => {
    expect(css).toContain("@keyframes spinner-petals-turn")
    expect(css).toContain("steps(12, end) infinite")
    expect(css).toContain("prefers-reduced-motion: reduce")
  })
})
