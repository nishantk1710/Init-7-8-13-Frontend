// W2.4 — in-memory predicate evaluator. Three-valued (Kleene) logic throughout:
// a condition is true, false, or "unknown" (field absent, or an explicitly
// configured unknown value such as a blank MRP Type). AND/OR combine those the
// standard Kleene way so "cannot-determine" never gets silently absorbed into
// a confident true or false.

import type { FieldRow, ScopeCondition, ScopeRule } from "./types"

type Trilean = true | false | "unknown"

function evaluateCondition(condition: ScopeCondition, row: FieldRow): Trilean {
  const value = row[condition.field]
  // Absent and null both mean "SAP told us nothing here" — never false.
  if (value === undefined || value === null) return "unknown"
  const raw = String(value)
  if (condition.unknownValues?.includes(raw)) return "unknown"

  switch (condition.op) {
    case "eq":
      return raw === condition.value
    case "ne":
      return raw !== condition.value
    case "in":
      return (condition.values ?? []).includes(raw)
    case "notIn":
      return !(condition.values ?? []).includes(raw)
    case "startsWith":
      return condition.value !== undefined && raw.startsWith(condition.value)
  }
}

function isCondition(rule: ScopeRule): rule is ScopeCondition {
  return "field" in rule
}

function combineAnd(results: Trilean[]): Trilean {
  if (results.some((r) => r === false)) return false
  if (results.some((r) => r === "unknown")) return "unknown"
  return true
}

function combineOr(results: Trilean[]): Trilean {
  if (results.some((r) => r === true)) return true
  if (results.some((r) => r === "unknown")) return "unknown"
  return false
}

function evaluateRule(rule: ScopeRule, row: FieldRow): Trilean {
  if (isCondition(rule)) return evaluateCondition(rule, row)
  if ("and" in rule) {
    if (rule.and.length === 0) return true // vacuous AND — the "all" scope
    return combineAnd(rule.and.map((r) => evaluateRule(r, row)))
  }
  if (rule.or.length === 0) return false // vacuous OR
  return combineOr(rule.or.map((r) => evaluateRule(r, row)))
}

/**
 * Evaluate a scope rule against one merged row of fields (from whichever
 * entity sets the rule's conditions span — the caller is responsible for
 * merging, since only it knows how MaterialSet and MaterialPlantSet rows
 * join on Matnr).
 */
export function evaluate(rule: ScopeRule, row: FieldRow): "in-scope" | "not-in-scope" | "cannot-determine" {
  const result = evaluateRule(rule, row)
  if (result === "unknown") return "cannot-determine"
  return result ? "in-scope" : "not-in-scope"
}
