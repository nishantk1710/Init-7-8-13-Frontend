import { createElement, type ComponentType } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import * as assistant from "@/components/assistant/skeletons"
import * as notifications from "@/components/notifications/notifications-skeleton"
import * as shared from "@/components/shared/page-skeleton"
import * as i13 from "@/features/initiative-13/components/skeletons"
import * as i7 from "@/features/initiative-7/components/skeletons"
import * as i8 from "@/features/initiative-8/components/kit/skeletons"

/**
 * Every skeleton the app exports, rendered once, with anything React says on the console counted as a failure.
 *
 * React reports a duplicate key, a bad prop or a nested live region as a console warning, not an error: the page
 * still renders, and only the browser's overlay says so. The route screens are rendered in
 * route-loaders-wired.test.ts; this covers the in-page bodies and the pieces as well.
 */
const MODULES: Record<string, Record<string, unknown>> = { shared, i7, i13, i8, assistant, notifications }

const cases = Object.entries(MODULES).flatMap(([module, exports]) =>
  Object.entries(exports)
    .filter((entry): entry is [string, ComponentType<Record<string, unknown>>] => typeof entry[1] === "function")
    .map(([name, component]) => [`${module}.${name}`, component] as const),
)

function renderQuietly(component: ComponentType<Record<string, unknown>>, props: Record<string, unknown>) {
  const complaints: string[] = []
  const consoleError = console.error
  console.error = (...args: unknown[]) => complaints.push(args.map(String).join(" "))
  try {
    return { html: renderToStaticMarkup(createElement(component, props)), complaints }
  } finally {
    console.error = consoleError
  }
}

describe("every skeleton renders without a word from React", () => {
  it("finds them", () => {
    expect(cases.length).toBeGreaterThan(40)
    expect(cases.map(([name]) => name)).toEqual(
      expect.arrayContaining(["i7.OverviewSkeletonBody", "i7.RecommendationsTableSkeleton", "i8.ListSkeleton", "assistant.RequestsSkeletonBody"]),
    )
  })

  it.each(cases)("%s", (_name, component) => {
    const { html, complaints } = renderQuietly(component, { label: "Loading it" })
    expect(complaints).toEqual([])
    expect(html).toMatch(/^<(div|p)/)
  })

  it.each(cases.filter(([name]) => /Skeleton(Body)?$/.test(name) && !/^shared\./.test(name)))(
    "%s is one live region with one late line",
    (_name, component) => {
      const { html } = renderQuietly(component, { label: "Loading it" })
      expect(html.match(/role="status"/g)).toHaveLength(1)
      expect(html.match(/skeleton-late/g)).toHaveLength(1)
      expect(html).toMatch(/aria-label="Loading[^"]*"/)
    },
  )
})
