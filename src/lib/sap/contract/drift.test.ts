import { describe, expect, it } from "vitest"
import { parseEdmx } from "./edmx"
import { compareContracts, describeDifference } from "./compare"
import { SAP_CONTRACT } from "./generated-contract"
import { readMetadataXml } from "./discovery-snapshot"
import type { SapContract } from "./types"

const SERVICES = ["ZVZI_KPI02_SHARED_SRV", "ZMM_KPI02_SRV"] as const

function parseAllServices(): SapContract {
  return SERVICES.reduce<SapContract>(
    (all, service) => ({ ...all, ...parseEdmx(readMetadataXml(service), service) }),
    {}
  )
}

describe("the checked-in contract matches the metadata it was generated from", () => {
  // Not circular: the contract comes from CSVs produced by cpi_discovery.py's
  // Python parser, while this reads the raw XML with a TypeScript parser.
  // The two agreeing is a real check on both.
  const parsed = parseAllServices()

  it("parses every set out of the raw $metadata", () => {
    expect(Object.keys(parsed)).toHaveLength(21)
  })

  it("reports no differences against the generated contract", () => {
    const differences = compareContracts(SAP_CONTRACT, parsed, { checkForRemovedSets: true })
    expect(differences.map(describeDifference)).toEqual([])
  })
})

describe("drift detection — a mutated $metadata produces specific, named failures", () => {
  const baselineXml = readMetadataXml("ZVZI_KPI02_SHARED_SRV")
  const baseline = parseEdmx(baselineXml, "ZVZI_KPI02_SHARED_SRV")

  function mutated(find: string, replace: string) {
    expect(baselineXml, `fixture text not found: ${find}`).toContain(find)
    return parseEdmx(baselineXml.replace(find, replace), "ZVZI_KPI02_SHARED_SRV")
  }

  it("catches a type change — the real Netpr Edm.Decimal -> Edm.String case, run backwards", () => {
    // Netpr is Edm.String today. Mutate it back to Decimal: the direction SAP
    // could revert at any time, which must fail just as loudly.
    //
    // MaxLength="30" disambiguates PurchaseOrderItemSet.Netpr from
    // InfoRecordOrgSet.Netpr: the 09-Sep 2026 sweep also changed the latter to
    // Edm.String (part of a much wider Decimal -> String drift), so a bare
    // '<Property Name="Netpr" Type="Edm.String"' match is no longer unique —
    // `mutated()`'s plain-string replace would silently hit whichever one
    // appears first in the file instead of the one this test means to mutate.
    const actual = mutated(
      '<Property Name="Netpr" Type="Edm.String" Nullable="false" MaxLength="30"',
      '<Property Name="Netpr" Type="Edm.Decimal" Nullable="false" MaxLength="30"'
    )
    const messages = compareContracts(baseline, actual).map(describeDifference)
    expect(messages).toContain("PurchaseOrderItemSet.Netpr: type changed Edm.String -> Edm.Decimal")
  })

  it("catches a renamed property, naming both the set and the property", () => {
    const actual = mutated('<Property Name="Dismm"', '<Property Name="DismmRenamed"')
    const messages = compareContracts(baseline, actual).map(describeDifference)
    expect(messages).toContain("MaterialPlantSet.Dismm: property is gone from $metadata")
    expect(messages).toContain("MaterialPlantSet.DismmRenamed: new property in $metadata (Edm.String)")
  })

  it("catches a changed entity key", () => {
    const actual = mutated(
      '<Key><PropertyRef Name="Matnr"/><PropertyRef Name="Werks"/></Key>',
      '<Key><PropertyRef Name="Matnr"/></Key>'
    )
    const messages = compareContracts(baseline, actual).map(describeDifference)
    expect(messages.some((m) => m.startsWith("MaterialPlantSet: key changed"))).toBe(true)
  })

  it("catches a removed entity set", () => {
    const actual = { ...baseline }
    delete actual.MaterialPlantSet
    const messages = compareContracts(baseline, actual, { checkForRemovedSets: true }).map(describeDifference)
    expect(messages).toContain("MaterialPlantSet: entity set is gone from $metadata")
  })

  it("reports nothing when nothing changed", () => {
    expect(compareContracts(baseline, baseline, { checkForRemovedSets: true })).toEqual([])
  })
})
