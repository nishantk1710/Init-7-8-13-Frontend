import { readFileSync } from "node:fs"
import { join } from "node:path"

import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { ChartLoader } from "./chart-loader"

const html = renderToStaticMarkup(createElement(ChartLoader, { label: "Loading the chart", className: "h-[220px] w-full" }))
const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8")

describe("ChartLoader", () => {
  it("is a ring: a faint track and one arc", () => {
    expect(html.match(/<circle /g)).toHaveLength(2)
    expect(html).toContain("chart-loader-ring")
    expect(html).toContain('stroke-dasharray="31.4 125.7"')
    expect(html).toContain('opacity="0.2"')
  })

  it("is one theme colour, never a hex", () => {
    expect(html).toContain("text-primary")
    expect(html.match(/stroke="currentColor"/g)).toHaveLength(2)
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,6}\b/)
  })

  it("is announced to a screen reader, and the drawing is hidden from one", () => {
    expect(html).toContain('role="status"')
    expect(html).toContain('aria-label="Loading the chart"')
    expect(html).toContain('aria-hidden="true"')
    expect(html).toContain("sr-only")
  })

  it("takes the height it is given, so the layout does not jump", () => {
    expect(html).toContain("h-[220px]")
  })

  it("turns, and slows for reduced motion", () => {
    expect(css).toContain("@keyframes chart-loader-turn")
    expect(css).toContain("chart-loader-turn 0.9s linear infinite")
    expect(css).toMatch(/prefers-reduced-motion: reduce\)\s*\{\s*\.chart-loader-ring/)
  })
})
