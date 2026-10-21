import { readFileSync } from "node:fs"
import { join } from "node:path"

import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { PageLoader } from "./page-loader"

const html = renderToStaticMarkup(createElement(PageLoader, { label: "Loading the page", className: "h-72 w-full" }))
const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8")

describe("PageLoader", () => {
  it("is an hourglass: a glass, two heaps of sand and a stream", () => {
    expect(html).toContain("page-loader-glass")
    expect(html).toContain("page-loader-top")
    expect(html).toContain("page-loader-bottom")
    expect(html).toContain("page-loader-stream")
  })

  it("is one theme colour, never a hex", () => {
    expect(html).toContain("text-primary")
    expect(html).toContain("currentColor")
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,6}\b/)
  })

  it("is announced to a screen reader, and the drawing is hidden from one", () => {
    expect(html).toContain('role="status"')
    expect(html).toContain('aria-label="Loading the page"')
    expect(html).toContain('aria-hidden="true"')
    expect(html).toContain("sr-only")
  })

  it("takes the size it is given", () => {
    expect(html).toContain("h-72")
  })
})

describe("the hourglass motion", () => {
  it("has the turn, the sand and the stream, and slows for reduced motion", () => {
    for (const name of ["page-loader-turn", "page-loader-top", "page-loader-bottom", "page-loader-stream"]) {
      expect(css).toContain(`@keyframes ${name}`)
    }
    expect(css).toMatch(/\.page-loader-glass,\s*\.page-loader-top,\s*\.page-loader-bottom,\s*\.page-loader-stream\s*\{\s*animation-duration: 12s/)
  })
})
