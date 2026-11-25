// The words behind the (i) buttons on Category, Reason and Lead time.

import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

import {
  APPROVED_POLICY_PARAMETERS,
  categoryInfoItems,
  confidenceInfoItems,
  leadTimeFootnote,
  leadTimeInfoItems,
  reasonInfoItems,
} from "@/features/initiative-7/utils/reverse-conversion-info"
import { REVERSE_CATEGORIES, REVERSE_CONFIDENCES, REVERSE_LEAD_TIME_BUCKETS, REVERSE_REASONS } from "@/features/initiative-7/types/reverse-conversion"

const text = (items: { name: string; tag?: string; definition: string; example?: string }[]) =>
  items.map((i) => [i.name, i.tag, i.definition, i.example].filter(Boolean).join(" | ")).join("\n")

describe("the popups agree with their dropdowns", () => {
  it("Category lists the categories in the dropdown's order, with the screen's names", () => {
    expect(categoryInfoItems().map((i) => i.name)).toEqual(REVERSE_CATEGORIES.map((c) => c.label))
    expect(categoryInfoItems().map((i) => i.name)).toEqual(["Convert to OAR", "Not Eligible"])
  })

  it("Confidence lists High, Medium and Low in the dropdown's order", () => {
    expect(confidenceInfoItems().map((i) => i.name)).toEqual(REVERSE_CONFIDENCES.map((c) => c.label))
    expect(confidenceInfoItems().map((i) => i.name)).toEqual(["High", "Medium", "Low"])
  })

  it("Reason lists every reason in the dropdown's order", () => {
    expect(reasonInfoItems().map((i) => i.name)).toEqual(REVERSE_REASONS.map((r) => r.label))
  })

  it("Lead time lists every bucket in the dropdown's order", () => {
    expect(leadTimeInfoItems().map((i) => i.name)).toEqual(REVERSE_LEAD_TIME_BUCKETS.map((b) => b.label))
  })
})

describe("each entry is complete and drawn in the right colour", () => {
  it("every entry has a plain definition, a tag and an example", () => {
    for (const item of [...categoryInfoItems(), ...reasonInfoItems(), ...confidenceInfoItems(), ...leadTimeInfoItems()]) {
      expect(item.definition.length, item.name).toBeGreaterThan(20)
      expect(item.tag, item.name).toBeTruthy()
      expect(item.example, item.name).toBeTruthy()
    }
  })

  it("categories: success, neutral", () => {
    expect(categoryInfoItems().map((i) => i.tone)).toEqual(["success", "neutral"])
    expect(confidenceInfoItems().map((i) => i.tone)).toEqual(["success", "warning", "danger"])
  })

  it("each reason takes the colour of its category and is tagged with it", () => {
    const byName = Object.fromEntries(reasonInfoItems().map((i) => [i.name, i]))
    expect(byName["Sparse recurring demand"]).toMatchObject({ tag: "Convert to OAR", tone: "success" })
    expect(byName["Unknown criticality"]).toMatchObject({ tag: "Convert to OAR", tone: "success" })
    expect(byName["Inconsistent movement data"]).toMatchObject({ tag: "Convert to OAR", tone: "success" })
    expect(byName["Zero issues in 24 months and never moved"]).toMatchObject({ tag: "Convert to OAR", tone: "success" })
    expect(byName["Zero issues in 24 months but moved before"]).toMatchObject({ tag: "Convert to OAR", tone: "success" })
    expect(byName["Lead time unknown or above 90 days"]).toMatchObject({ tag: "Convert to OAR", tone: "success" })
    expect(byName["Zero issues in latest 12 complete months but used previously"]).toMatchObject({ tag: "Convert to OAR", tone: "success" })
    // The view lists only Convert to OAR rows, so the reasons of the other two categories are not offered.
    expect(byName["Obsolete criticality"]).toBeUndefined()
    expect(byName["Protected criticality"]).toBeUndefined()
    expect(byName["Insufficient history"]).toBeUndefined()
    expect(Object.values(byName).every((i) => i.tag === "Convert to OAR")).toBe(true)
  })

  it("lead time: up to the limit is fine, over it or unknown is Low confidence", () => {
    const [short, medium, long, over, unknown] = leadTimeInfoItems()
    for (const item of [short, medium, long]) expect(item).toMatchObject({ tag: "No extra restriction", tone: "success" })
    expect(over).toMatchObject({ tag: "Low confidence", tone: "warning" })
    expect(unknown).toMatchObject({ tag: "Low confidence", tone: "warning" })
  })
})

describe("the numbers come from the policy, with the approved values as the fallback", () => {
  it("the approved values are the ones the business signed off", () => {
    expect(APPROVED_POLICY_PARAMETERS).toEqual({
      window_months: 12,
      zero_use_window_months: 24,
      minimum_history_span_months: 12,
      maximum_lead_time_days: 90,
      recommended_max_issues: 2,
      recommended_max_months: 2,
      maximum_months_since_last_movement: 9,
      frequent_issues_above: 4,
      frequent_months_above: 4,
      new_material_age_months: 24,
      new_material_minimum_lifetime_months: 3,
    })
  })

  it("before a response arrives, the text states the approved numbers", () => {
    const all = text([...categoryInfoItems(), ...reasonInfoItems(), ...confidenceInfoItems(), ...leadTimeInfoItems()])
    expect(all).toContain("at most 2 issues and 2 months with use")
    expect(all).toContain("within 9 months")
    expect(all).toContain("more than 4 issues")
    expect(all).toContain("longer than 90 days")
    expect(all).toContain("issues in the last 24 months") // the zero-use window
    expect(all).toContain("fewer than 3 months of use")
  })

  it("an explanation follows the policy the backend returned", () => {
    const changed = {
      recommended_max_issues: 3,
      recommended_max_months: 3,
      maximum_months_since_last_movement: 6,
      frequent_issues_above: 6,
      frequent_months_above: 6,
      maximum_lead_time_days: 120,
      minimum_history_span_months: 18,
      zero_use_window_months: 36,
      new_material_minimum_lifetime_months: 5,
    }
    const all = text([...categoryInfoItems(changed), ...reasonInfoItems(changed), ...confidenceInfoItems(changed), ...leadTimeInfoItems(changed)])
    expect(all).toContain("at most 3 issues and 3 months with use")
    expect(all).toContain("within 6 months")
    expect(all).toContain("more than 6 issues")
    expect(all).toContain("longer than 120 days")
    expect(all).toContain("last 36 months")
    expect(all).toContain("fewer than 5 months of use")
    expect(all).not.toContain("longer than 90 days")
    expect(all).not.toContain("at most 2 issues")
  })

  it("a value that is missing or not a number falls back to the approved one", () => {
    const text1 = text(reasonInfoItems({ maximum_lead_time_days: "ninety", recommended_max_issues: null }))
    expect(text1).toContain("longer than 90 days")
    expect(text1).toContain("at most 2 issues")
  })

  it("a count of one is not pluralised", () => {
    expect(text(categoryInfoItems({ recommended_max_issues: 1 }))).toContain("at most 1 issue and")
  })
})

describe("the lead-time note", () => {
  it("says where the figure comes from and works the expected issues out from the policy", () => {
    const note = leadTimeFootnote()
    expect(note).toContain("SAP's planned delivery time")
    expect(note).toContain("not the time deliveries actually took")
    expect(note).toContain("about 0.49 expected issues during even a 90-day wait")
  })

  it("recalculates when the policy changes", () => {
    expect(leadTimeFootnote({ recommended_max_issues: 4, maximum_lead_time_days: 90 })).toContain("about 0.99 expected issues")
    expect(leadTimeFootnote({ recommended_max_issues: 2, maximum_lead_time_days: 120 })).toContain("about 0.66 expected issues during even a 120-day wait")
  })
})

describe("the filter bar uses them, and its Clear filters button matches the OAR and Stock item one", () => {
  const SRC = join(__dirname, "..", "..", "..")
  const workspace = readFileSync(join(SRC, "features/initiative-7/components/min-max-to-oar-workspace.tsx"), "utf8")

  it("Confidence carries an (i) button too", () => {
    expect(workspace).toContain('<Field label="Confidence" info={<ConfidenceInfo parameters={policyParameters} />}>')
  })

  it("Confidence replaces Category as the first filter, and Category is no longer offered", () => {
    expect(workspace).not.toContain('label="Category"')
    expect(workspace).not.toContain("CategoryInfo")
    const confidence = workspace.indexOf('<Field label="Confidence"')
    expect(confidence).toBeGreaterThan(-1)
    expect(confidence).toBeLessThan(workspace.indexOf('<Field label="Plant">'))
  })

  it("OAR conversion (Eligible / Not eligible) is the first filter, like the OAR table's conversion filter", () => {
    expect(workspace).toContain('<Field label="OAR conversion">')
    expect(workspace).toContain("REVERSE_ELIGIBILITY")
    expect(workspace.indexOf('<Field label="OAR conversion">')).toBeLessThan(workspace.indexOf('<Field label="Confidence"'))
  })

  it("has no Reason filter: the reason is in the Reason column and in the open row", () => {
    expect(workspace).not.toContain('<Field label="Reason"')
    expect(workspace).not.toContain("ReasonInfo")
  })

  it("Lead time carries an (i) button fed the applied policy", () => {
    expect(workspace).toContain('<Field label="Lead time" info={<LeadTimeInfo parameters={policyParameters} />}>')
    expect(workspace).toContain("const policyParameters = data?.policy.parameters")
  })

  it("Clear filters is the same always-shown, dimmed-when-idle outline button with the reset icon", () => {
    expect(workspace).not.toContain("ClearFiltersButton")
    expect(workspace).toContain("RotateCcw")
    expect(workspace).toContain("disabled={activeCount === 0}")
    expect(workspace).toContain(
      'className="shrink-0 grow-0 border-action bg-action/10 font-semibold text-action shadow-sm hover:bg-action/20 hover:text-action"',
    )
    expect(workspace).toMatch(/<RotateCcw className="size-3.5" \/>\s*Clear filters/)
  })
})
