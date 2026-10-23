import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const LIVE = join(process.cwd(), "src", "app", "(live)")

/** Routes that deliberately show their own loading screens instead of the hourglass. Repairable Spares (I08) has a
 * skeleton per page -- the overview and each sub-page -- and a sub-page's loading.tsx wins over its parent's, so an
 * hourglass at the route would only cover the overview. Moving I08 onto it is that module's call, not a gap to fill. */
const OWN_LOADERS = new Set(["repairable-spares"])

/** Every top-level route folder of the live tree: each one owns the loading.tsx its sub-pages inherit. */
const ROUTES = readdirSync(LIVE)
  .filter((name) => statSync(join(LIVE, name)).isDirectory())
  .filter((name) => !OWN_LOADERS.has(name))

describe("every live route opens with the hourglass", () => {
  it("finds the routes", () => {
    expect(ROUTES).toEqual(
      expect.arrayContaining([
        "home", "actions", "approvals", "audit", "assistant",
        "inventory-planning", "oar-utilization", "profile",
      ]),
    )
  })

  it("Repairable Spares keeps its own loaders", () => {
    const src = readFileSync(join(LIVE, "repairable-spares", "loading.tsx"), "utf8")
    expect(src).toContain("export default function")
  })

  it.each(ROUTES)("%s has a loading.tsx that renders PageLoader", (route) => {
    const src = readFileSync(join(LIVE, route, "loading.tsx"), "utf8")
    expect(src).toContain('from "@/components/shared/page-loader"')
    expect(src).toContain("<PageLoader")
    expect(src).toContain("export default function")
    expect(src).not.toContain("Skeleton")
  })
})
