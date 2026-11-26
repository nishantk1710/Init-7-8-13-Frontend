import { readFileSync } from "node:fs"
import { join } from "node:path"

import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import {
  Bone,
  SkeletonBody,
  SkeletonFilters,
  SkeletonHeader,
  SkeletonKpis,
  SkeletonPage,
  SkeletonTable,
} from "./page-skeleton"

const render = (element: React.ReactElement) => renderToStaticMarkup(element)
const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8")

describe("a bone", () => {
  it("is a grey shape that says nothing to a screen reader", () => {
    const html = render(createElement(Bone, { className: "h-4 w-32" }))
    expect(html).toContain("skeleton-bone")
    expect(html).toContain('aria-hidden="true"')
    expect(html).toContain("h-4 w-32")
  })
})

describe("the page frame", () => {
  const html = render(
    createElement(SkeletonPage, { label: "Loading the page", header: { actions: true } }, createElement(SkeletonTable, { rows: 3, columns: 4 })),
  )

  it("is one live region, labelled, busy, with the label for a screen reader", () => {
    expect(html).toContain('role="status"')
    expect(html).toContain('aria-busy="true"')
    expect(html).toContain('aria-label="Loading the page"')
    expect(html).toContain('<span class="sr-only">Loading the page</span>')
    expect(html.match(/role="status"/g)).toHaveLength(1)
  })

  it("has the page's usual container, so the page lands where the skeleton was", () => {
    expect(html).toMatch(/class="skeleton-frame min-h-0 flex-1 overflow-y-auto p-6"/)
    expect(html).toContain("mx-auto flex w-full max-w-7xl flex-col gap-4")
  })

  it("takes another page's container in place of the usual padding, and merges the inner column's classes", () => {
    const oar = render(createElement(SkeletonPage, { label: "Loading", className: "oar-scope px-4 py-6 sm:px-6", innerClassName: "gap-5" }))
    expect(oar).toContain('class="skeleton-frame min-h-0 flex-1 overflow-y-auto oar-scope px-4 py-6 sm:px-6"')
    expect(oar).toContain("mx-auto flex w-full max-w-7xl flex-col gap-5")
    expect(oar).not.toContain("gap-4")
    const narrow = render(createElement(SkeletonPage, { label: "Loading", innerClassName: "max-w-6xl" }))
    expect(narrow).toContain("max-w-6xl")
    expect(narrow).not.toContain("max-w-7xl")
    expect(narrow).toContain("gap-4")
  })

  it("draws the header in bones: a title, a description, the action at the right", () => {
    const header = render(createElement(SkeletonHeader, { actions: true, back: true, eyebrow: true, size: "2xl" }))
    expect(header).toContain("h-8 w-72") // the 2xl title
    expect(header).toContain("h-4 w-[28rem]") // the description
    expect(header).toContain("h-9 w-40") // the action
    expect(header).toContain("h-4 w-24") // the back link
    expect(header).toContain("h-3 w-28") // the eyebrow
    expect(render(createElement(SkeletonHeader, {}))).toContain("h-7 w-56") // the xl title
    expect(render(createElement(SkeletonPage, { label: "Loading", header: false }))).not.toContain("h-7 w-56")
  })

  it("ends with the line that appears after a long wait", () => {
    expect(html).toContain("skeleton-late")
    expect(html).toContain("Still loading")
    expect(html.match(/skeleton-late/g)).toHaveLength(1)
  })
})

describe("the body, for a page that has drawn its header", () => {
  it("is the same live region without a container of its own", () => {
    const html = render(createElement(SkeletonBody, { label: "Loading the table" }, createElement(SkeletonTable, {})))
    expect(html).toContain('role="status"')
    expect(html).toContain('aria-label="Loading the table"')
    expect(html).toContain('class="skeleton-frame flex flex-col gap-4"')
    expect(html).not.toContain("overflow-y-auto")
    expect(html).toContain("skeleton-late")
  })
})

describe("the pieces", () => {
  it("a table has a head row, the rows asked for, and a pager", () => {
    const html = render(createElement(SkeletonTable, { rows: 5, columns: 3 }))
    expect(html.match(/border-t border-border/g)).toHaveLength(5)
    expect(html).toContain("repeat(3, minmax(0, 1fr))")
    expect(html).toContain("h-8 w-20 rounded-md") // the pager's buttons
    expect(render(createElement(SkeletonTable, { rows: 2, pagination: false }))).not.toContain("h-8 w-20")
  })

  it("a labelled filter bar shares its row between the fields, as the real one does", () => {
    const html = render(createElement(SkeletonFilters, { labelled: true, fields: [180, 150] }))
    expect(html).toContain("border-2 border-action/40")
    expect(html).toContain("p-4")
    expect(html).toContain("min-w-[132px] flex-1")
    expect(html).toContain("flex-basis:180px")
    expect(html.match(/h-8 w-full/g)).toHaveLength(2)
  })

  it("a plain filter bar sets its controls at their widths, with no bar when bare", () => {
    const html = render(createElement(SkeletonFilters, { fields: [288, 160], trailing: false }))
    expect(html).toContain("p-3")
    expect(html).toContain("width:288px")
    expect(html.match(/h-9 w-full/g)).toHaveLength(2)
    expect(html).not.toContain("ml-auto")
    expect(render(createElement(SkeletonFilters, { bare: true }))).not.toContain("border-action/40")
  })

  it("KPI cards come in the number asked for", () => {
    expect(render(createElement(SkeletonKpis, { count: 7 })).match(/h-\[124px\]/g)).toHaveLength(7)
  })
})

describe("the motion and timing, in globals.css", () => {
  it("every bone wears one band of light, fixed to the viewport so they all share it", () => {
    expect(css).toMatch(/\.skeleton-bone \{[^}]*background-attachment: fixed/)
    expect(css).toMatch(/\.skeleton-bone \{[^}]*animation: skeleton-sweep/)
    expect(css).toContain("@keyframes skeleton-sweep")
  })

  it("the bone and its band are mixed from the theme, with their own values in dark mode", () => {
    expect(css).toMatch(/:root \{\s*[^}]*--skeleton-bone: color-mix\(in oklab, var\(--foreground\)/)
    expect(css).toMatch(/\.dark \{\s*--skeleton-bone:[^}]*--skeleton-sheen:/)
  })

  it("the frame holds back for a moment, so a page that arrives in a blink never flashes a skeleton", () => {
    expect(css).toMatch(/@keyframes skeleton-appear \{\s*from \{\s*opacity: 0;/)
    expect(css).toMatch(/\.skeleton-frame \{\s*animation: skeleton-appear 180ms ease-out 160ms backwards/)
    // Not `opacity: 0` on the frame itself: were animations ever stopped, the skeleton would never show.
    expect(css).not.toMatch(/\.skeleton-frame \{\s*opacity: 0/)
  })

  it("the late line appears after eight seconds", () => {
    expect(css).toMatch(/\.skeleton-late \{\s*opacity: 0;\s*animation: skeleton-appear 300ms ease-out 8s forwards/)
  })

  it("for anyone who has asked for less motion: still bones, no band", () => {
    expect(css).toMatch(/prefers-reduced-motion: reduce\) \{\s*\.skeleton-bone \{\s*animation: none;\s*background-image: none;/)
  })
})
