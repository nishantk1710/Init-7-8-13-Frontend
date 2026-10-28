"use client"

// Print view for the Q2 2026 Quarterly Report -- the "Download PDF" output, rendered by the browser's own
// print dialog, in the same print styles as the generated reports (report-print.css).
//
// It prints the whole snapshot for every plant and every type, not what the on-screen Plant and Recommendation
// choices currently show: a PDF that depended on which dropdown someone last used would not be a report.

import { Row, Section, Table } from "@/features/initiative-7/components/report-print-view"
import { formatCount, formatIsoDateDMY, formatMoney } from "@/lib/utils"
import { sapPlantLabel } from "@/lib/shared-data/sap-plants"
import {
  adoptionOf,
  findScope,
  SNAPSHOT_TYPES,
  stockLevelRows,
  type QuarterlySnapshot,
  type SnapshotFigures,
} from "@/features/initiative-7/utils/quarterly-snapshot"

const NOT_AVAILABLE = "Not available"

/** "12.5%" of a part in a whole; "—" when there is nothing to divide by. */
function share(part: number, whole: number): string {
  return whole <= 0 ? "—" : `${((part / whole) * 100).toFixed(1)}%`
}

/** "x of y" for the Adopted card's figure, or Not available when adoption was not captured. */
function adoptedOf(figures: SnapshotFigures): string {
  return figures.adoption_total === null || figures.adopted === null
    ? NOT_AVAILABLE
    : `${formatCount(figures.adopted)} of ${formatCount(figures.adoption_total)}`
}

export function QuarterlySnapshotPrintView({ snapshot }: { snapshot: QuarterlySnapshot }) {
  const all = findScope(snapshot, null, "all")
  const f = all?.figures
  const adoption = f ? adoptionOf(f) : null
  const stockLevels = stockLevelRows(all?.stock_levels ?? null)
  const materials = all?.materials ?? null

  return (
    <div className="print-root" data-testid="report-print-view" data-quarter={snapshot.quarter}>
      <header className="print-cover">
        <p className="print-eyebrow">Initiative 07 — Predictive Inventory &amp; Safety Stock</p>
        <h1 className="print-title">Quarterly Deep-Dive Report</h1>
        <p className="print-quarter">{snapshot.quarter}</p>
        <dl className="print-meta">
          <div>
            <dt>Reporting period</dt>
            <dd>{snapshot.period}</dd>
          </div>
          <div>
            <dt>Source</dt>
            <dd>{snapshot.source}</dd>
          </div>
          <div>
            <dt>Captured</dt>
            <dd>{formatIsoDateDMY(snapshot.captured_at)}</dd>
          </div>
          {f?.stockout_as_of && (
            <div>
              <dt>Stockout risk as of</dt>
              <dd>{formatIsoDateDMY(f.stockout_as_of)}</dd>
            </div>
          )}
        </dl>
      </header>

      {!f ? (
        <Section number={1} title="Summary">
          <p className="print-empty">The figures were not captured in this snapshot.</p>
        </Section>
      ) : (
        <>
          <Section number={1} title="Summary" subtitle="All plants, OAR and stock items together.">
            <div className="print-rows">
              <Row
                label="High stockout risk"
                value={`${formatCount(f.stockout_at_risk)} materials`}
                note={` — ${share(f.stockout_at_risk, f.stockout_evaluated)} of the ${formatCount(f.stockout_evaluated)} evaluated`}
              />
              <Row
                label="Excess inventory candidates"
                value={`${formatCount(f.excess_count)} materials`}
                note={` — ${share(f.excess_count, f.total)} of ${formatCount(f.total)} recommendations`}
              />
              <Row
                label="Working capital impact"
                value={f.net_rop_value_impact === null ? NOT_AVAILABLE : formatMoney(f.net_rop_value_impact, snapshot.currency)}
                note={
                  f.net_rop_value_impact === null
                    ? " — needs a unit price and a calculated reorder point"
                    : f.net_rop_value_impact >= 0
                      ? " — net release"
                      : " — net additional investment"
                }
              />
              <Row label="Adopted recommendation" value={adoptedOf(f)} />
              <Row label="Total recommendations" value={formatCount(f.total)} />
            </div>
          </Section>

          <Section
            number={2}
            title="Stockout Risk Distribution"
            subtitle="Fast and slow moving material-plants, by stock on hand against lead-time need."
          >
            <Table
              headers={["Level", "Count", "Share of evaluated"]}
              rows={[
                ["High (below lead-time need)", formatCount(f.stockout_at_risk), share(f.stockout_at_risk, f.stockout_evaluated)],
                [
                  "Low (covers lead time)",
                  formatCount(Math.max(f.stockout_evaluated - f.stockout_at_risk, 0)),
                  share(Math.max(f.stockout_evaluated - f.stockout_at_risk, 0), f.stockout_evaluated),
                ],
                ["Need data (not counted above)", formatCount(f.stockout_insufficient_data), "—"],
              ]}
            />
          </Section>

          <Section number={3} title="By Plant" subtitle="Stockout risk and excess inventory, per plant.">
            <Table
              headers={["Plant", "At stockout risk", "Of evaluated", "Excess candidates", "Of recommendations"]}
              rows={[null, "1300", "1500"].flatMap((plant) => {
                const s = findScope(snapshot, plant, "all")?.figures
                return s
                  ? [
                      [
                        plant === null ? "All plants" : sapPlantLabel(plant),
                        formatCount(s.stockout_at_risk),
                        formatCount(s.stockout_evaluated),
                        formatCount(s.excess_count),
                        formatCount(s.total),
                      ],
                    ]
                  : []
              })}
            />
          </Section>

          <Section number={4} title="By Recommendation Type" subtitle="All plants.">
            <Table
              headers={["Type", "Recommendations", "At stockout risk", "Excess candidates", "Adopted"]}
              rows={SNAPSHOT_TYPES.flatMap((t) => {
                const s = findScope(snapshot, null, t.value)?.figures
                return s
                  ? [
                      [
                        t.label,
                        formatCount(s.total),
                        formatCount(s.stockout_at_risk),
                        formatCount(s.excess_count),
                        adoptedOf(s),
                      ],
                    ]
                  : []
              })}
            />
          </Section>

          <Section
            number={5}
            title="SAP Adoption"
            subtitle="Recommendations with a change to adopt, checked against SAP change history."
          >
            {adoption ? (
              <Table
                headers={["Outcome", "Count"]}
                rows={[
                  ["Adopted", formatCount(adoption.adoptedCount)],
                  ["Partially adopted", formatCount(adoption.partiallyAdoptedCount)],
                  ["Not adopted", formatCount(adoption.notAdoptedCount)],
                  ["Pending (no SAP change recorded yet)", formatCount(adoption.unknownCount)],
                ]}
              />
            ) : (
              <p className="print-empty">Adoption was not captured in this snapshot.</p>
            )}
          </Section>

          <Section
            number={6}
            title="Current SAP vs I07 Recommendation"
            subtitle={
              all?.stock_levels_count != null
                ? `Mean across the ${formatCount(all.stock_levels_count)} recommendations with a change to adopt.`
                : "Mean across the recommendations with a change to adopt."
            }
          >
            <Table
              headers={["Stock level", "Current (SAP)", "Recommended", "Change"]}
              rows={stockLevels.map((level) => [
                `${level.label} (${level.hint})`,
                level.current === null ? NOT_AVAILABLE : level.current.toFixed(1),
                level.recommended === null ? NOT_AVAILABLE : level.recommended.toFixed(1),
                level.delta === null ? "—" : `${level.delta > 0 ? "+" : ""}${level.delta.toFixed(1)}`,
              ])}
            />
          </Section>

          <Section number={7} title="Recommendations With a Change to Adopt">
            {materials === null ? (
              <p className="print-empty">The recommendations list was not captured in this snapshot.</p>
            ) : (
              <>
                <p className="print-disclosure">
                  {all?.materials_total != null
                    ? `The newest ${formatCount(materials.length)} of ${formatCount(all.materials_total)} recommendations with a change to adopt. This is a subset.`
                    : `The newest ${formatCount(materials.length)} recommendations with a change to adopt. This is a subset.`}
                </p>
                <Table
                  headers={["Material", "Plant", "Crit.", "Demand pattern", "ROP (current → recommended)", "Status"]}
                  rows={materials.map((r) => [
                    <span key="m">
                      {r.desc} <span className="print-mono">{r.matnr}</span>
                    </span>,
                    sapPlantLabel(r.plant),
                    r.crit,
                    r.pattern,
                    <span key="r" className="print-mono">
                      {r.rop_cur === null ? "—" : formatCount(r.rop_cur)} &rarr;{" "}
                      {r.rop_rec === null ? "—" : formatCount(r.rop_rec)}
                    </span>,
                    r.status,
                  ])}
                />
              </>
            )}
          </Section>
        </>
      )}

      <footer className="print-footer-note">
        <p>
          The Inventory Planning Overview&apos;s figures from the {snapshot.source}, captured{" "}
          {formatIsoDateDMY(snapshot.captured_at)}. Every figure counts the newest recommendation of each
          material-plant; stockout risk is as of the date shown on the cover, not the quarter&apos;s end.
        </p>
      </footer>
    </div>
  )
}
