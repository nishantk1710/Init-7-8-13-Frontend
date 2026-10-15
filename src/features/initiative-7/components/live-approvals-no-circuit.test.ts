// The Action Center's Inventory Planning list (the live Approvals workspace) no longer has a Circuit filter or
// shows a circuit on each row: circuits are never assigned in the data, so every row read "Unassigned" and the
// dropdown could only filter to nothing. Read from the source, as no-leakage.test.ts guards the scope rule.

import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const source = readFileSync(
  join(process.cwd(), "src/features/initiative-7/components/live-approvals-workspace.tsx"),
  "utf8",
)

describe("the live Approvals workspace (Action Center)", () => {
  it("has no circuit filter, state or per-row circuit", () => {
    expect(source).not.toMatch(/circuit/i)
  })

  it("still filters by criticality and status", () => {
    expect(source).toContain("All criticalities")
    expect(source).toContain("statusTab")
  })
})
