// W2.1 — decode an OData v2 row using the generated contract.
//
// Types come from the contract, never from what the value looks like. That is
// the whole point: PurchaseOrderItemSet.Netpr holds "1234.56" but is declared
// Edm.String, and coercing it to a number because it looks numeric would be a
// silent corruption of SAP's own intent (§1.2).

import { SAP_CONTRACT } from "../contract/generated-contract"
import { decodeEdmValue, type DecodedValue } from "../contract/edm-types"
import { ContractError } from "./errors"

export type SapRow = Record<string, DecodedValue>

export interface DecodeResult {
  row: SapRow
  /** Properties SAP returned that the contract does not know about — drift, reported not thrown. */
  unknownProperties: string[]
}

export function decodeRow(entitySet: string, raw: Record<string, unknown>): DecodeResult {
  const contract = SAP_CONTRACT[entitySet]
  if (!contract) {
    throw new ContractError(`No contract for entity set "${entitySet}". Run npm run contract:generate.`, {
      entitySet,
    })
  }

  const byName = new Map(contract.properties.map((p) => [p.name, p]))
  const row: SapRow = {}
  const unknownProperties: string[] = []

  for (const [name, value] of Object.entries(raw)) {
    // OData v2 wraps every entity with a __metadata block. It is not data.
    if (name === "__metadata") continue

    const property = byName.get(name)
    if (!property) {
      unknownProperties.push(name)
      continue
    }

    try {
      row[name] = decodeEdmValue(property.type, value)
    } catch (cause) {
      throw new ContractError(
        `${entitySet}.${name}: declared ${property.type} but SAP sent ${JSON.stringify(value)} ` +
          `(${(cause as Error).message})`,
        { entitySet }
      )
    }
  }

  return { row, unknownProperties }
}
