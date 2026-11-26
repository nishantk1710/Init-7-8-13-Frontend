import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative, sep } from "node:path"

import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

const LIVE = join(process.cwd(), "src", "app", "(live)")

/** Every loading.tsx under the live tree, as "route/sub/loading.tsx". */
function loadingScreens(dir = LIVE): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return loadingScreens(path)
    return name === "loading.tsx" ? [relative(LIVE, path).split(sep).join("/")] : []
  })
}

const SCREENS = loadingScreens()

/** The screens that must exist: one per top-level route, and one per sub-page whose shape differs from its parent's.
 * Without its own, a sub-page shows its parent's skeleton -- the Overview's charts while the Pipeline opens. */
const REQUIRED = [
  "home/loading.tsx",
  "actions/loading.tsx",
  "audit/loading.tsx",
  "materials/loading.tsx",
  "notifications/loading.tsx",
  "profile/loading.tsx",
  "assistant/loading.tsx",
  "assistant/new/loading.tsx",
  "assistant/sessions/loading.tsx",
  "assistant/sessions/[sessionId]/loading.tsx",
  "assistant/requests/loading.tsx",
  "assistant/requests/new/loading.tsx",
  "assistant/requests/[requestId]/loading.tsx",
  "inventory-planning/loading.tsx",
  "inventory-planning/recommendations/loading.tsx",
  "inventory-planning/recommendations/[id]/loading.tsx",
  "inventory-planning/pipeline/loading.tsx",
  "inventory-planning/adoption/loading.tsx",
  "inventory-planning/reports/loading.tsx",
  "inventory-planning/calculation/loading.tsx",
  "inventory-planning/criticality-reports/loading.tsx",
  "oar-utilization/loading.tsx",
  "oar-utilization/aging-exceptions/loading.tsx",
  "oar-utilization/ledger/loading.tsx",
  "oar-utilization/watch/loading.tsx",
  "oar-utilization/report/loading.tsx",
  "repairable-spares/loading.tsx",
  "repairable-spares/coding-candidates/loading.tsx",
  "repairable-spares/declarations/loading.tsx",
  "repairable-spares/exceptions/loading.tsx",
  "repairable-spares/justifications/loading.tsx",
  "repairable-spares/repair-register/loading.tsx",
  "repairable-spares/repair-register/[id]/loading.tsx",
]

describe("every live route opens with a skeleton in its own shape", () => {
  it("has a loading screen for every route and every sub-page with a shape of its own", () => {
    expect(SCREENS).toEqual(expect.arrayContaining(REQUIRED))
  })

  it.each(SCREENS)("%s is a skeleton, not the hourglass", (screen) => {
    const src = readFileSync(join(LIVE, screen), "utf8")
    expect(src).toMatch(/from "@\/(components|features)\/[^"]*skeleton[^"]*"/)
    expect(src).toContain("export default function Loading")
    expect(src).not.toContain("PageLoader")
  })

  it.each(SCREENS)("%s renders: a live region with a label, bones hidden from the reader, the late line", async (screen) => {
    const mod = (await import(join(LIVE, screen).split(sep).join("/"))) as { default: () => React.ReactElement }
    // React reports a duplicate key on the console, not as an error: the I08 overview once keyed three bones by
    // their widths, two of them 180, and only the browser said so.
    const complaints: string[] = []
    const consoleError = console.error
    console.error = (...args: unknown[]) => complaints.push(args.map(String).join(" "))
    let html: string
    try {
      html = renderToStaticMarkup(createElement(mod.default))
    } finally {
      console.error = consoleError
    }
    expect(complaints).toEqual([])
    expect(html).toContain('role="status"')
    expect(html).toContain('aria-busy="true"')
    expect(html).toMatch(/aria-label="Loading[^"]+"/)
    expect(html).toContain("skeleton-frame")
    expect(html).toContain("skeleton-bone")
    expect(html).toContain('aria-hidden="true"')
    expect(html).toContain("skeleton-late")
    expect(html).toContain("sr-only")
    // One live region per screen: a skeleton inside a skeleton would announce twice and show two late lines.
    expect(html.match(/role="status"/g)).toHaveLength(1)
    expect(html.match(/skeleton-late/g)).toHaveLength(1)
  })
})
