// W2.5 — parse SAP Gateway EDMX ($metadata) into a contract.
//
// Deliberately a second, independent implementation of what
// `cpi_discovery.py` does in Python. The drift test parses the committed
// metadata XML with this and compares against the contract generated from
// the Python-produced CSVs — two parsers agreeing is a real check; one parser
// compared against its own output would be circular.

import { XMLParser } from "fast-xml-parser"
import type { EdmType, EntitySetContract, PropertyContract, SapContract } from "./types"

interface RawNode {
  [key: string]: unknown
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return []
  return Array.isArray(value) ? value : [value]
}

/**
 * Parse one service's $metadata document. `service` names the service the
 * document came from, since EDMX does not reliably carry it in a single place.
 */
export function parseEdmx(xml: string, service: string): SapContract {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@",
    removeNSPrefix: true,
  })
  const doc = parser.parse(xml) as RawNode

  const dataServices = (doc.Edmx as RawNode | undefined)?.DataServices as RawNode | undefined
  const schemas = asArray(dataServices?.Schema as RawNode | RawNode[] | undefined)
  if (schemas.length === 0) throw new Error(`No Schema element found in $metadata for ${service}`)

  const entityTypes = new Map<string, { keys: string[]; properties: PropertyContract[] }>()
  const setToType = new Map<string, string>()

  for (const schema of schemas) {
    for (const entityType of asArray(schema.EntityType as RawNode | RawNode[] | undefined)) {
      const name = String(entityType["@Name"])
      const keys = asArray((entityType.Key as RawNode | undefined)?.PropertyRef as RawNode | RawNode[] | undefined).map(
        (ref) => String(ref["@Name"])
      )
      const properties = asArray(entityType.Property as RawNode | RawNode[] | undefined).map(
        (property): PropertyContract => ({
          name: String(property["@Name"]),
          type: String(property["@Type"]) as EdmType,
          // EDMX omits Nullable when it defaults to true.
          nullable: property["@Nullable"] === undefined ? true : String(property["@Nullable"]) === "true",
          isKey: keys.includes(String(property["@Name"])),
        })
      )
      entityTypes.set(name, { keys, properties })
    }

    for (const container of asArray(schema.EntityContainer as RawNode | RawNode[] | undefined)) {
      for (const entitySet of asArray(container.EntitySet as RawNode | RawNode[] | undefined)) {
        setToType.set(String(entitySet["@Name"]), String(entitySet["@EntityType"]).split(".").pop() ?? "")
      }
    }
  }

  const contract: SapContract = {}
  for (const [entitySet, entityType] of setToType) {
    const type = entityTypes.get(entityType)
    if (!type) throw new Error(`EntitySet ${entitySet} references unknown EntityType ${entityType}`)
    const entry: EntitySetContract = {
      service,
      entitySet,
      entityType,
      keys: [...type.keys].sort(),
      properties: type.properties,
    }
    contract[entitySet] = entry
  }
  return contract
}
