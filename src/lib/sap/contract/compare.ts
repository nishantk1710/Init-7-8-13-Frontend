// W2.5 — contract drift detection.
//
// The failure message is the product here. "Expected 229, got 228" tells you
// nothing at 2am; "PurchaseOrderItemSet.Netpr: type changed Edm.Decimal ->
// Edm.String" tells you exactly what SAP did and what will break.

import type { SapContract } from "./types"

export type ContractDifference =
  | { kind: "set-removed"; entitySet: string }
  | { kind: "set-added"; entitySet: string }
  | { kind: "property-removed"; entitySet: string; property: string }
  | { kind: "property-added"; entitySet: string; property: string; type: string }
  | { kind: "type-changed"; entitySet: string; property: string; expected: string; actual: string }
  | { kind: "nullability-changed"; entitySet: string; property: string; expected: boolean; actual: boolean }
  | { kind: "key-changed"; entitySet: string; expected: string[]; actual: string[] }

export function describeDifference(difference: ContractDifference): string {
  switch (difference.kind) {
    case "set-removed":
      return `${difference.entitySet}: entity set is gone from $metadata`
    case "set-added":
      return `${difference.entitySet}: new entity set in $metadata, not in the contract`
    case "property-removed":
      return `${difference.entitySet}.${difference.property}: property is gone from $metadata`
    case "property-added":
      return `${difference.entitySet}.${difference.property}: new property in $metadata (${difference.type})`
    case "type-changed":
      return `${difference.entitySet}.${difference.property}: type changed ${difference.expected} -> ${difference.actual}`
    case "nullability-changed":
      return `${difference.entitySet}.${difference.property}: nullable changed ${difference.expected} -> ${difference.actual}`
    case "key-changed":
      return `${difference.entitySet}: key changed [${difference.expected.join(", ")}] -> [${difference.actual.join(", ")}]`
  }
}

/**
 * Compare a freshly parsed contract against the checked-in baseline.
 * `actual` may cover only some services — sets absent from it are only
 * reported as removed when `checkForRemovedSets` is on, so a single-service
 * $metadata read does not report the other service's sets as missing.
 */
export function compareContracts(
  expected: SapContract,
  actual: SapContract,
  options: { checkForRemovedSets?: boolean } = {}
): ContractDifference[] {
  const differences: ContractDifference[] = []

  for (const [entitySet, actualSet] of Object.entries(actual)) {
    const expectedSet = expected[entitySet]
    if (!expectedSet) {
      differences.push({ kind: "set-added", entitySet })
      continue
    }

    const expectedKeys = [...expectedSet.keys].sort()
    const actualKeys = [...actualSet.keys].sort()
    if (expectedKeys.join(",") !== actualKeys.join(",")) {
      differences.push({ kind: "key-changed", entitySet, expected: expectedKeys, actual: actualKeys })
    }

    const actualProperties = new Map(actualSet.properties.map((p) => [p.name, p]))
    for (const expectedProperty of expectedSet.properties) {
      const actualProperty = actualProperties.get(expectedProperty.name)
      if (!actualProperty) {
        differences.push({ kind: "property-removed", entitySet, property: expectedProperty.name })
        continue
      }
      if (expectedProperty.type !== actualProperty.type) {
        differences.push({
          kind: "type-changed",
          entitySet,
          property: expectedProperty.name,
          expected: expectedProperty.type,
          actual: actualProperty.type,
        })
      }
      if (expectedProperty.nullable !== actualProperty.nullable) {
        differences.push({
          kind: "nullability-changed",
          entitySet,
          property: expectedProperty.name,
          expected: expectedProperty.nullable,
          actual: actualProperty.nullable,
        })
      }
    }

    const expectedProperties = new Set(expectedSet.properties.map((p) => p.name))
    for (const actualProperty of actualSet.properties) {
      if (!expectedProperties.has(actualProperty.name)) {
        differences.push({
          kind: "property-added",
          entitySet,
          property: actualProperty.name,
          type: actualProperty.type,
        })
      }
    }
  }

  if (options.checkForRemovedSets) {
    for (const entitySet of Object.keys(expected)) {
      if (!actual[entitySet]) differences.push({ kind: "set-removed", entitySet })
    }
  }

  return differences
}
