// W2.4 — OData v2 $filter pushdown for scope rules.
//
// Correctness model: a pushdown filter here is a SOUND BUT POSSIBLY LOOSER
// pre-filter — it is always safe to fetch more rows than strictly match and
// let `evaluate()` (predicate.ts) make the final call, never fewer. That
// safety net is what lets this module drop a condition it cannot express
// server-side instead of having to get every SAP filter quirk exactly right.
//
// One such quirk, found live against CPI (see docs-eng/phase_summary.md
// Phase 0): chaining two `ne` conditions with `and` is silently ignored by
// this SAP Gateway — `Dismm ne 'VB' and Dismm ne 'ND'` comes back as if no
// filter were applied at all, with no error. So a `notIn` with more than one
// value is never pushed down; it is left for the in-memory predicate.

import { FIELD_ENTITY_SET } from "./config"
import type { ScopeCondition, ScopeEntitySet, ScopeRule } from "./types"

type FilterNode = { kind: "filter"; expr: string } | { kind: "vacuous" } | { kind: "unrepresentable" }

function escapeODataLiteral(value: string): string {
  return value.replace(/'/g, "''")
}

function buildLeaf(condition: ScopeCondition, entitySet: ScopeEntitySet): FilterNode {
  if (FIELD_ENTITY_SET[condition.field] !== entitySet) return { kind: "vacuous" }

  const { field, op } = condition
  switch (op) {
    case "eq":
      return condition.value === undefined
        ? { kind: "unrepresentable" }
        : { kind: "filter", expr: `${field} eq '${escapeODataLiteral(condition.value)}'` }
    case "ne":
      return condition.value === undefined
        ? { kind: "unrepresentable" }
        : { kind: "filter", expr: `${field} ne '${escapeODataLiteral(condition.value)}'` }
    case "startsWith":
      return condition.value === undefined
        ? { kind: "unrepresentable" }
        : { kind: "filter", expr: `startswith(${field},'${escapeODataLiteral(condition.value)}')` }
    case "in": {
      const values = condition.values ?? []
      if (values.length === 0) return { kind: "unrepresentable" } // matches nothing; not worth a special filter form
      return { kind: "filter", expr: `(${values.map((v) => `${field} eq '${escapeODataLiteral(v)}'`).join(" or ")})` }
    }
    case "notIn": {
      const values = condition.values ?? []
      if (values.length === 0) return { kind: "vacuous" } // matches everything — no constraint to push down
      if (values.length === 1) return { kind: "filter", expr: `${field} ne '${escapeODataLiteral(values[0])}'` }
      return { kind: "unrepresentable" } // the and-chained-ne gateway bug — see file header
    }
  }
}

function buildAnd(children: FilterNode[]): FilterNode {
  // Dropping a vacuous or unrepresentable child only widens the filter, which
  // is safe under an AND — the in-memory predicate still narrows it correctly.
  const filterable = children.filter((c): c is { kind: "filter"; expr: string } => c.kind === "filter")
  if (filterable.length === 0) return { kind: "vacuous" }
  if (filterable.length === 1) return filterable[0]
  return { kind: "filter", expr: `(${filterable.map((f) => f.expr).join(" and ")})` }
}

function buildOr(children: FilterNode[]): FilterNode {
  // Under OR, dropping a branch would silently exclude rows that only match
  // through it — unsafe. Only collapse if every branch is filterable, or every
  // branch is vacuous (the whole rule simply doesn't concern this entity set).
  if (children.every((c) => c.kind === "vacuous")) return { kind: "vacuous" }
  if (children.every((c) => c.kind === "filter")) {
    const filters = children as { kind: "filter"; expr: string }[]
    return { kind: "filter", expr: `(${filters.map((f) => f.expr).join(" or ")})` }
  }
  return { kind: "unrepresentable" }
}

function buildNode(rule: ScopeRule, entitySet: ScopeEntitySet): FilterNode {
  if ("field" in rule) return buildLeaf(rule, entitySet)
  if ("and" in rule) {
    if (rule.and.length === 0) return { kind: "vacuous" }
    return buildAnd(rule.and.map((r) => buildNode(r, entitySet)))
  }
  if (rule.or.length === 0) return { kind: "unrepresentable" } // vacuous OR means "always false" — not expressible as a filter
  return buildOr(rule.or.map((r) => buildNode(r, entitySet)))
}

/**
 * Build the `$filter` value for the slice of a scope rule that applies to one
 * entity set. Returns `undefined` when no server-side filter is available or
 * needed for that entity set — the caller should fetch unfiltered for it and
 * rely on `evaluate()` for the final answer.
 */
export function toODataFilter(rule: ScopeRule, entitySet: ScopeEntitySet): string | undefined {
  const node = buildNode(rule, entitySet)
  return node.kind === "filter" ? node.expr : undefined
}
