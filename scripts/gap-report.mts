// Regenerate the WS2 field-source gap report:
//
//   npm run gap-report
//
// Writes docs-eng/FIELD_SOURCE_GAPS.md. Re-run it whenever a view model gains
// a field or a mapper changes — the source maps will not compile with a field
// left undeclared, so the report cannot silently fall behind.

import { writeFileSync } from "node:fs"
import { buildGapReport, formatGapReport, summarise } from "../src/lib/sap/mapping/gap-report"

const rows = buildGapReport()
const summary = summarise(rows)

writeFileSync("./docs-eng/FIELD_SOURCE_GAPS.md", formatGapReport(rows))

console.log("Wrote docs-eng/FIELD_SOURCE_GAPS.md")
console.log(
  `  ${summary.total} fields: ${summary.sap} from SAP, ${summary.platform} from platform data, ` +
    `${summary.derived} derived, ${summary.blocked} blocked on SAP, ${summary.gap} with NO source at all.`
)
