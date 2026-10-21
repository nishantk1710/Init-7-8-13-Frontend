"use client"

// Print view for the Q2 2026 Quarterly Report -- the "Download PDF" output, rendered by the browser's own
// print dialog, in the same print styles as the generated reports (report-print.css).
//
// It prints the whole snapshot, not what the on-screen filters currently show: a PDF that depended on which
// chart someone last clicked would not be a report. The material table is the first PDF_ROWS rows in the
// report's own ranking and says so; the full list is the CSV download.

import { Row, Section, Table } from "@/features/initiative-7/components/report-print-view"
import { formatCount } from "@/lib/utils"
import {
  ADOPTION_ZERO,
  displayStatusCounts,
  formatPercent,
  formatZar,
  meanParams,
  riskDistribution,
  type QuarterlySnapshot,
} from "@/features/initiative-7/utils/quarterly-snapshot"

/** Rows in the PDF's material table; the same size as the generated report's. */
const PDF_ROWS = 50

export function QuarterlySnapshotPrintView({ snapshot }: { snapshot: QuarterlySnapshot }) {
  const pending = snapshot.status["Pending Review"] ?? 0
  const params = meanParams(snapshot.materials)
  const rows = snapshot.materials.slice(0, PDF_ROWS)

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
            <dd>{snapshot.snapshot}</dd>
          </div>
          <div>
            <dt>Materials in scope</dt>
            <dd>{formatCount(snapshot.inscope)}</dd>
          </div>
        </dl>
      </header>

      <Section number={1} title="Summary">
        <div className="print-rows">
          <Row label="Critical stockout risk" value={`${formatCount(snapshot.risk_recs.Critical ?? 0)} materials`} />
          <Row
            label="Excess inventory candidates"
            value={`${formatCount(snapshot.excess_n)} materials`}
            note={` — ${formatZar(snapshot.excess_val)} tied up`}
          />
          <Row label="Working capital impact" value={formatZar(snapshot.wc_recs)} />
          <Row
            label="Pending approval"
            value={`${formatCount(pending)} (${formatPercent(pending, snapshot.recs)} of recommendations)`}
          />
          <Row label="Total recommendations" value={formatCount(snapshot.recs)} />
        </div>
      </Section>

      <Section number={2} title="Stockout Risk Distribution" subtitle="Across this quarter's recommendations.">
        <Table
          headers={["Risk level", "Count", "Share"]}
          rows={riskDistribution(snapshot.risk_recs).map((d) => [d.level, formatCount(d.count), `${d.share.toFixed(1)}%`])}
        />
      </Section>

      <Section number={3} title="Recommendation Status" subtitle="Where each change sits in the approval flow.">
        <Table
          headers={["Status", "Count"]}
          rows={displayStatusCounts(snapshot.status).map((s) => [s.status, formatCount(s.count)])}
        />
      </Section>

      <Section
        number={4}
        title="Current SAP vs I07 Recommendation"
        subtitle="Mean across in-scope material–plants generated this quarter."
      >
        <Table
          headers={["Stock level", "Current (SAP)", "Recommended", "Change"]}
          rows={params.map((p) => [
            `${p.label} (${p.hint})`,
            p.current.toFixed(1),
            p.recommended.toFixed(1),
            `${p.delta > 0 ? "+" : ""}${p.delta.toFixed(1)}`,
          ])}
        />
      </Section>

      <Section number={5} title="Materials — Top Reorder Changes">
        <p className="print-disclosure">
          {`${formatCount(rows.length)} of ${formatCount(snapshot.materials.length)} recommendations, ranked by stockout risk and then working-capital impact. This is a subset; the full list is in the CSV download.`}
        </p>
        <Table
          headers={["Material", "Plant", "Circuit", "Crit.", "Demand pattern", "ROP (current → recommended)", "Status"]}
          rows={rows.map((r) => [
            <span key="m">
              {r.desc} <span className="print-mono">{r.matnr}</span>
            </span>,
            r.plant,
            r.circuit,
            r.crit,
            r.pattern,
            <span key="r" className="print-mono">
              {formatCount(r.rop_cur)} &rarr; {formatCount(r.rop_rec)}
            </span>,
            r.status,
          ])}
        />
      </Section>

      <Section number={6} title="Stockout Risk Trend" subtitle="Materials at high/critical risk, by month.">
        <Table headers={["Month", "Materials"]} rows={snapshot.trend.map((t) => [t.m, formatCount(t.v)])} />
      </Section>

      <Section
        number={7}
        title="Forecast vs Actual Demand"
        subtitle="Consumption across the recommendation set. Forecast is one-step-ahead exponential smoothing (α = 0.3)."
      >
        <Table
          headers={["Month", "Actual", "Forecast"]}
          rows={snapshot.fa.map((p) => [p.m, formatCount(Math.round(p.a)), formatCount(Math.round(p.f))])}
        />
      </Section>

      <Section number={8} title="SAP Adoption" subtitle="Whether approved recommendations were applied in SAP.">
        <Table headers={["Outcome", "Count"]} rows={ADOPTION_ZERO.map((a) => [a.label, formatCount(a.count)])} />
        <p className="print-disclosure">
          No recommendation has been applied in SAP yet, so every value is 0. {formatCount(snapshot.sap_touched)} of the{" "}
          {formatCount(snapshot.recs)} recommended materials had a material-master change document in the quarter;
          change-document coverage ends {snapshot.cd_coverage}.
        </p>
      </Section>

      <footer className="print-footer-note">
        <p>
          Net working-capital impact: {formatZar(snapshot.wc_recs)} across the recommendation set;{" "}
          {formatZar(snapshot.wc_inscope)} across all {formatCount(snapshot.inscope)} in-scope materials, against{" "}
          {formatZar(snapshot.inv_value)} of spares inventory on hand.
        </p>
      </footer>
    </div>
  )
}
