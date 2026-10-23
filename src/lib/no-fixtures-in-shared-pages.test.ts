import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

// The shared pages -- Home, Action Center, Approvals and the Audit trail -- are
// the live app's cross-initiative surface, and they must never render
// hand-written demo data. A fixture is indistinguishable on screen from a real
// figure, so the rule is enforced here, structurally, instead of being
// remembered.
//
// This reads import specifiers, so it catches the way a fixture actually gets
// in: somebody importing a fixture module (or the old synchronous selectors that
// wrapped them) into one of these pages.

const ROOTS = [
  "src/lib/aggregation.ts",
  "src/lib/domain/live-feed.ts",
  "src/components/home",
  "src/components/approvals",
  "src/components/action-center",
  "src/components/audit",
  "src/app/(live)/home",
  "src/app/(live)/approvals",
  "src/app/(live)/actions",
  "src/app/(live)/audit",
  "src/features/initiative-7/selectors/live.ts",
  "src/features/initiative-8/selectors/live.ts",
  "src/features/initiative-13/selectors/live.ts",
]

/** Import paths that mean "demo data" or "a way back to it". */
const FORBIDDEN: { pattern: RegExp; why: string }[] = [
  { pattern: /lib\/mock-data/, why: "the hand-written materials catalogue" },
  { pattern: /shared-data\/material-catalog/, why: "re-exports the hand-written materials catalogue" },
  {
    pattern: /features\/initiative-\d+\/data\/(?!live-)/,
    why: "a fixture module (only data/live-*.ts reads the backend)",
  },
  {
    pattern: /features\/initiative-\d+\/selectors\/(summary|global-actions|audit-events)/,
    why: "the old synchronous selectors, which read fixtures",
  },
  { pattern: /lib\/sap\/dataset-mode/, why: "the flag that defaults to fixtures (use lib/dataset-mode)" },
  { pattern: /lib\/approvals/, why: "the title-matching approvals helper over fixture actions" },
]

function sourceFiles(path: string): string[] {
  const stat = statSync(path)
  if (stat.isFile()) return [path]
  return readdirSync(path).flatMap((entry) => {
    const full = join(path, entry)
    if (statSync(full).isDirectory()) return sourceFiles(full)
    return /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [full] : []
  })
}

const files = ROOTS.flatMap(sourceFiles)

function importsOf(file: string): string[] {
  const text = readFileSync(file, "utf-8")
  return [...text.matchAll(/(?:from|import)\s+["']([^"']+)["']/g)].map((m) => m[1])
}

describe("shared pages never read demo data", () => {
  it("scans a meaningful set of files (guards against the walker matching nothing)", () => {
    expect(files.length).toBeGreaterThan(20)
    expect(files.some((f) => f.endsWith("aggregation.ts"))).toBe(true)
    expect(files.some((f) => f.includes("approvals-page"))).toBe(true)
  })

  for (const { pattern, why } of FORBIDDEN) {
    it(`none imports ${pattern.source} — ${why}`, () => {
      const offenders = files.filter((file) => importsOf(file).some((spec) => pattern.test(spec)))
      expect(offenders).toEqual([])
    })
  }
})
