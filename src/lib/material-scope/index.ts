// W2.4 — public scope API. This is the only entry point I07/I13 selectors
// should import from `lib/material-scope`; everything else in this directory is
// an implementation detail.

import { SCOPES } from "./config"
import { evaluate } from "./predicate"
import { toODataFilter as buildODataFilter } from "./odata-filter"
import type { FieldRow, ScopeEntitySet, ScopeVerdict } from "./types"

export type { ScopeVerdict, FieldRow, ScopeDefinition, RollupMode, ScopeRule, ScopeCondition } from "./types"
export { SCOPES } from "./config"
export type { ScopeName } from "./config"

function getScope(scopeName: string) {
  const scope = SCOPES[scopeName]
  if (!scope) throw new Error(`Unknown scope "${scopeName}". Known scopes: ${Object.keys(SCOPES).join(", ")}`)
  return scope
}

/**
 * Is this one specific material+plant combination in scope? `material` and
 * `plant` are field bags from MaterialSet and MaterialPlantSet respectively
 * for the same Matnr — the caller does the join, since only it knows how the
 * two reads were fetched (live, paged, or from a fixture).
 */
export function isInScope(scopeName: string, material: FieldRow, plant: FieldRow): ScopeVerdict {
  const scope = getScope(scopeName)
  return evaluate(scope.rule, { ...material, ...plant })
}

/**
 * Is this material in scope, rolled up across every plant it's carried in?
 * Governed entirely by the scope's configured `rollup` policy — never
 * decided ad hoc by a selector (§1.6(a)).
 *
 * A material with zero plant rows is a data-completeness problem, not a real
 * rollup outcome, so it always reports "cannot-determine" rather than
 * picking an identity value for the rollup operator.
 */
export function isMaterialInScope(scopeName: string, material: FieldRow, plantRows: FieldRow[]): ScopeVerdict {
  const scope = getScope(scopeName)
  if (scope.rollup === "per-plant-only") {
    throw new Error(
      `Scope "${scopeName}" is configured rollup: "per-plant-only" — "is this material in scope" is not a ` +
        `well-formed question for it (§1.6(a)). Call isInScope(scopeName, material, plant) for a specific plant instead.`
    )
  }
  if (plantRows.length === 0) return "cannot-determine"

  const verdicts = plantRows.map((plant) => evaluate(scope.rule, { ...material, ...plant }))
  if (scope.rollup === "any-plant") {
    if (verdicts.includes("in-scope")) return "in-scope"
    if (verdicts.includes("cannot-determine")) return "cannot-determine"
    return "not-in-scope"
  }
  // "all-plants"
  if (verdicts.includes("not-in-scope")) return "not-in-scope"
  if (verdicts.includes("cannot-determine")) return "cannot-determine"
  return "in-scope"
}

/**
 * Server-side `$filter` for the slice of a scope's rule that applies to one
 * entity set, for pushdown reads. See odata-filter.ts for why this can
 * legitimately return `undefined` (no representable filter — fetch
 * unfiltered and let `isInScope`/`isMaterialInScope` decide).
 */
export function toODataFilter(scopeName: string, entitySet: ScopeEntitySet): string | undefined {
  return buildODataFilter(getScope(scopeName).rule, entitySet)
}
