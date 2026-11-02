import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const LIVE = join(process.cwd(), "src", "app", "(live)")

/** Every top-level route folder of the live tree: each one owns the loading.tsx its sub-pages inherit. */
const ROUTES = readdirSync(LIVE).filter((name) => statSync(join(LIVE, name)).isDirectory())

/** Repairable Spares (I08) also gives each sub-page a loading.tsx of its own, and a sub-page's wins over its parent's, so
 * every one of them has to render the hourglass too or it would show something else. */
const I08_SUBPAGES = [
  "coding-candidates",
  "declarations",
  "exceptions",
  "justifications",
  "repair-register",
  join("repair-register", "[id]"),
]

describe("every live route opens with the hourglass", () => {
  it("finds the routes", () => {
    expect(ROUTES).toEqual(
      expect.arrayContaining([
        "home", "actions", "approvals", "audit", "assistant",
        "inventory-planning", "oar-utilization", "profile",
      ]),
    )
  })

  it.each(ROUTES)("%s has a loading.tsx that renders PageLoader", (route) => {
    const src = readFileSync(join(LIVE, route, "loading.tsx"), "utf8")
    expect(src).toContain('from "@/components/shared/page-loader"')
    expect(src).toContain("<PageLoader")
    expect(src).toContain("export default function")
    expect(src).not.toContain("Skeleton")
  })

  it.each(I08_SUBPAGES)("Repairable Spares / %s renders PageLoader too", (sub) => {
    const src = readFileSync(join(LIVE, "repairable-spares", sub, "loading.tsx"), "utf8")
    expect(src).toContain('from "@/components/shared/page-loader"')
    expect(src).toContain("<PageLoader")
    expect(src).toContain("export default function")
    expect(src).not.toContain("Skeleton")
  })
})
