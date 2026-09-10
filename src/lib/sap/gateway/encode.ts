// W2.6a — encode CSV rows into SAP's actual wire format.
//
// This deliberately reproduces SAP's awkward shapes rather than emitting
// clean JSON: `/Date(...)/` for dates, `PT14H16M00S` for times, numerals as
// quoted strings for decimals. A mock that returns tidy data tests nothing,
// and the whole point of the gateway is that code which works against it
// works against SAP.

import { SAP_CONTRACT } from "../contract/generated-contract"
import type { EdmType } from "../contract/types"
import type { RawRow } from "./csv-source"

function encodeDateTime(value: string): string | null {
  if (!value) return null
  const parsed = value.includes("T") ? new Date(value) : new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return null
  return `/Date(${parsed.getTime()})/`
}

function encodeTime(value: string): string | null {
  if (!value) return null
  const [hours = "0", minutes = "0", seconds = "0"] = value.split(":")
  return `PT${Number(hours)}H${Number(minutes)}M${Number(seconds)}S`
}

export function encodeValue(type: EdmType, value: string): unknown {
  switch (type) {
    case "Edm.DateTime":
    case "Edm.DateTimeOffset":
      return encodeDateTime(value)
    case "Edm.Time":
      return encodeTime(value)
    // SAP sends decimals as strings. So do we — this is the case that catches
    // code doing arithmetic without parsing.
    case "Edm.Decimal":
    case "Edm.Double":
    case "Edm.Single":
    case "Edm.Int64":
      return value === "" ? null : String(value)
    case "Edm.Byte":
    case "Edm.SByte":
    case "Edm.Int16":
    case "Edm.Int32":
      return value === "" ? null : Number(value)
    case "Edm.Boolean":
      return value === "true" || value === "X" || value === "1"
    default:
      return value
  }
}

/** One CSV row -> one OData v2 entity, typed field by field from the contract. */
export function encodeRow(entitySet: string, row: RawRow, select?: string[]): Record<string, unknown> {
  const contract = SAP_CONTRACT[entitySet]
  if (!contract) throw new Error(`No contract for entity set ${entitySet}`)

  const keyValues = contract.keys.map((key) => `${key}='${row[key] ?? ""}'`).join(",")
  const encoded: Record<string, unknown> = {
    __metadata: {
      uri: `https://fake-cpi.local/sap/opu/odata/sap/${contract.service}/${entitySet}(${keyValues})`,
      type: `${contract.service}.${contract.entityType}`,
      // Not part of OData: our own marker so nothing mistakes synthetic rows
      // for real ones (§7.6).
      synthetic: true,
    },
  }

  for (const property of contract.properties) {
    if (select && !select.includes(property.name)) continue
    encoded[property.name] = encodeValue(property.type, row[property.name] ?? "")
  }

  return encoded
}
