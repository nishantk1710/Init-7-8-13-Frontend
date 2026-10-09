"use client"

// Print view for the I07 Quarterly Deep-Dive Report -- the "Download PDF"
// output, rendered by the user's own browser via window.print().
//
// WHY A SEPARATE COMPONENT, NOT THE PAGE ITSELF
//
// The on-screen workspace is a management summary: it shows KPI cards and
// charts, and deliberately no longer carries the 14-section technical
// deep-dive or the criticality tier cards (both removed on request -- see
// quarterly-reports-workspace.tsx). The PDF is the opposite case: it is the
// complete record, so it renders all 16 sections of the report schema.
//
// Keeping that in its own component is what lets both be true at once -- an
// uncluttered screen and a complete download -- without a print stylesheet
// trying to un-hide things the screen never rendered.
//
// WHERE THE DATA COMES FROM
//
// 14 of the 16 sections are read straight from the already-fetched
// ApiQuarterlyReport. Nothing is refetched, recomputed or regenerated for the
// PDF: the quarter's numbers were computed once, upstream, by the reporting
// service, and this only formats them.
//
// Two sections cannot be sourced that way, and both say so in the output
// rather than quietly implying otherwise:
//
//   - recommendations: the material rows come from the live recommendations
//     endpoint, which is not quarter-scoped (most rows predate the reporting
//     feature). The table is explicitly a 50-row, newest-first subset, and is
//     NOT ranked by reorder-point change -- no such ranking exists in the
//     backend (see recommendation-sort-contract.test.ts).
//   - sap_adoption: the report's own section carries only an availability
//     status, and the live adoption endpoint takes no quarter parameter, so
//     its numbers are current and platform-wide. Labelled as such.
//
// UNAVAILABLE VALUES ARE NEVER PRINTED AS ZERO. A null decimal renders as an
// em dash and an unavailable metric renders through AvailabilityValue, the
// same discipline the schema enforces (see AvailabilityStatus' docstring) --
// "we did not measure this" must not read as "this is zero".

import { AvailabilityValue, formatDecimal } from "@/features/initiative-7/components/availability-value"
import { CircuitExposureChart } from "@/features/initiative-7/components/circuit-exposure-chart"
import { InventoryHealthCard } from "@/features/initiative-7/components/inventory-health-card"
import { RecommendationStatusChart } from "@/features/initiative-7/components/recommendation-status-chart"
import { formatCount } from "@/lib/utils"
import type { Recommendation } from "@/features/initiative-7/types/inventory"
import type {
  ApiDecimal,
  ApiForecastAccuracyMetric,
  ApiPopulationCount,
  ApiQuarterlyReport,
  ApiUndefinedManagementMetric,
} from "@/features/initiative-7/types/api"

/** An em dash, not "0" -- see the header note on unavailable values. */
const NONE = "—"

function decimal(value: ApiDecimal, decimals = 2): string {
  return formatDecimal(value ?? null, decimals) ?? NONE
}

function percent(value: ApiDecimal): string {
  const formatted = formatDecimal(value ?? null, 1)
  return formatted === null ? NONE : `${formatted}%`
}

function Section({
  number,
  title,
  subtitle,
  children,
}: {
  number: number
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <section className="print-section">
      <h2 className="print-section-title">
        <span className="print-section-number">{number}.</span> {title}
      </h2>
      {subtitle && <p className="print-section-subtitle">{subtitle}</p>}
      <div className="print-section-body">{children}</div>
    </section>
  )
}

/** A label/value pair. `value` is pre-formatted by the caller so this never
 * decides how to render an absent number. */
function Row({ label, value, note }: { label: string; value: React.ReactNode; note?: string }) {
  return (
    <div className="print-row">
      <span className="print-row-label">
        {label}
        {note && <span className="print-row-note">{note}</span>}
      </span>
      <span className="print-row-leader" aria-hidden="true" />
      <span className="print-row-value">{value}</span>
    </div>
  )
}

function PopulationRow({ label, pop }: { label: string; pop: ApiPopulationCount }) {
  return (
    <Row
      label={label}
      value={
        <>
          {formatCount(pop.populated_count)} / {formatCount(pop.total_count)}
          <span className="print-row-muted"> ({percent(pop.percentage_populated)})</span>
        </>
      }
    />
  )
}

function AccuracyRow({
  label,
  metric,
  unit,
}: {
  label: string
  metric: ApiForecastAccuracyMetric
  unit?: string
}) {
  return (
    <Row
      label={label}
      value={
        <>
          <AvailabilityValue status={metric.status} value={formatDecimal(metric.value)} unit={unit} size="sm" />
          <span className="print-row-muted">
            {" "}
            ({formatCount(metric.populated_count)}/{formatCount(metric.total_count)})
          </span>
        </>
      }
    />
  )
}

/** A management metric with no defined business rule today. Prints the
 * backend's own reason, never a substituted number. */
function UndefinedRow({ label, metric }: { label: string; metric: ApiUndefinedManagementMetric }) {
  return (
    <Row
      label={label}
      value={<AvailabilityValue status={metric.status} value={null} size="sm" />}
      note={metric.reason ? ` — ${metric.reason}` : undefined}
    />
  )
}

function Table({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  if (rows.length === 0) {
    return <p className="print-empty">No rows.</p>
  }
  return (
    <table className="print-table">
      <thead>
        <tr>
          {headers.map((h) => (
            <th key={h}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((cells, i) => (
          <tr key={i}>
            {cells.map((cell, j) => (
              <td key={j}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export interface ReportPrintViewProps {
  report: ApiQuarterlyReport
  /** Live recommendation rows for section 12. Not quarter-scoped; see header. */
  materials: Recommendation[]
  /** Total matching recommendations, so the subset can state what it is a subset of. */
  materialsTotal: number
  /** Rows backing the on-screen charts, for the disclosed sample size. */
  chartSampleSize: number
  /** The same rows the on-screen charts are drawn from, so the PDF's charts
   * and the screen's cannot disagree. */
  chartRecommendations?: Recommendation[]
}

export function ReportPrintView({
  report,
  materials,
  materialsTotal,
  chartSampleSize,
  chartRecommendations = [],
}: ReportPrintViewProps) {
  const meta = report.metadata
  const generatedAt = new Date(meta.generated_at)

  return (
    <div className="print-root" data-testid="report-print-view" data-quarter={meta.quarter}>
      {/* --- Title block (section 1: metadata) ------------------------- */}
      <header className="print-cover">
        <p className="print-eyebrow">Initiative 07 — Predictive Inventory &amp; Safety Stock</p>
        <h1 className="print-title">Quarterly Deep-Dive Report</h1>
        <p className="print-quarter">{meta.quarter}</p>
        <dl className="print-meta">
          <div>
            <dt>Reporting period</dt>
            <dd>
              {meta.period_start} to {meta.period_end}
            </dd>
          </div>
          <div>
            <dt>Generated</dt>
            <dd>{generatedAt.toLocaleString()}</dd>
          </div>
          <div>
            <dt>Report version</dt>
            <dd>{meta.report_version}</dd>
          </div>
          <div>
            <dt>Upstream runs</dt>
            <dd>
              feature {meta.feature_run_id ?? NONE} · forecast {meta.forecast_run_id ?? NONE} · inventory{" "}
              {meta.inventory_run_id ?? NONE} · OAR {meta.oar_run_id ?? NONE}
            </dd>
          </div>
        </dl>
      </header>

      {/* --- 2. Executive summary --------------------------------------- */}
      <Section number={2} title="Executive Summary">
        <div className="print-grid">
          <Row label="Material-plants in scope" value={formatCount(report.executive_summary.total_material_plants)} />
          <Row label="Demand-classified" value={percent(report.executive_summary.classified_percentage)} />
          <Row label="Total recommendations" value={formatCount(report.executive_summary.total_recommendations)} />
          <Row label="Ready for review" value={formatCount(report.executive_summary.ready_for_review_count)} />
          <Row label="Pending approval" value={formatCount(report.executive_summary.pending_approval_count)} />
          <Row label="Pending approval %" value={percent(report.executive_summary.pending_approval_percentage)} />
          <Row label="Not evaluable" value={formatCount(report.executive_summary.not_evaluable_count)} />
          <Row label="OAR materials" value={formatCount(report.executive_summary.oar_count)} />
          <Row label="Approval ledger entries" value={formatCount(report.executive_summary.approval_ledger_entries)} />
        </div>
      </Section>

      {/* --- 3. Management summary -------------------------------------- */}
      <Section
        number={3}
        title="Management Summary"
        subtitle="Metrics with no defined business rule in I07 today. Each states the backend's own reason; none is approximated."
      >
        <div className="print-rows">
          <UndefinedRow label="Critical stockout risk" metric={report.management_summary.critical_stockout_risk} />
          <UndefinedRow
            label="Excess inventory candidates"
            metric={report.management_summary.excess_inventory_candidates}
          />
          <UndefinedRow label="Working capital impact" metric={report.management_summary.working_capital_impact} />
          <UndefinedRow
            label="Stockout risk distribution"
            metric={report.management_summary.stockout_risk_distribution}
          />
          <UndefinedRow label="Stockout risk trend" metric={report.management_summary.stockout_risk_trend} />
        </div>
      </Section>

      {/* --- 4. Scope & data quality ------------------------------------ */}
      <Section number={4} title="Scope &amp; Data Quality">
        <div className="print-rows">
          <Row label="Total records" value={formatCount(report.scope_and_data_quality.total_records)} />
          <Row
            label="Classified"
            value={
              <>
                {formatCount(report.scope_and_data_quality.classified_count)}
                <span className="print-row-muted">
                  {" "}
                  ({percent(report.scope_and_data_quality.classified_percentage)})
                </span>
              </>
            }
          />
          <Row
            label="Unclassified"
            value={
              <>
                {formatCount(report.scope_and_data_quality.unclassified_count)}
                <span className="print-row-muted">
                  {" "}
                  ({percent(report.scope_and_data_quality.unclassified_percentage)})
                </span>
              </>
            }
          />
          <Row
            label="Criticality populated"
            value={
              <>
                {formatCount(report.scope_and_data_quality.criticality_populated_count)}
                <span className="print-row-muted">
                  {" "}
                  ({percent(report.scope_and_data_quality.criticality_populated_percentage)})
                </span>
              </>
            }
          />
          <Row
            label="Lead time populated"
            value={
              <>
                {formatCount(report.scope_and_data_quality.lead_time_populated_count)}
                <span className="print-row-muted">
                  {" "}
                  ({percent(report.scope_and_data_quality.lead_time_populated_percentage)})
                </span>
              </>
            }
          />
        </div>
        <h3 className="print-subheading">History status breakdown</h3>
        <Table
          headers={["History status", "Count"]}
          rows={report.scope_and_data_quality.history_status_breakdown.map((h) => [
            h.history_status,
            formatCount(h.count),
          ])}
        />
      </Section>

      {/* --- 5. Demand classification ----------------------------------- */}
      <Section
        number={5}
        title="Demand Classification"
        subtitle={`${formatCount(report.demand_classification.total)} material-plants`}
      >
        <Table
          headers={["Demand class", "Count", "Share"]}
          rows={report.demand_classification.by_class.map((d) => [
            d.demand_class,
            formatCount(d.count),
            percent(d.percentage),
          ])}
        />
      </Section>

      {/* --- 6. Forecasting --------------------------------------------- */}
      <Section
        number={6}
        title="Forecasting"
        subtitle={`${formatCount(report.forecasting.total_forecasts)} forecast rows`}
      >
        <div className="print-rows">
          <AccuracyRow label="Mean absolute error" metric={report.forecasting.mean_absolute_error} />
          <AccuracyRow label="Pinball loss" metric={report.forecasting.pinball_loss} />
          <AccuracyRow label="Bias" metric={report.forecasting.bias_percentage} unit="%" />
          <AccuracyRow label="Fill rate" metric={report.forecasting.fill_rate} unit="%" />
          <AccuracyRow label="Holding cost" metric={report.forecasting.holding_cost} />
          <Row label="MAPE" value={<AvailabilityValue status={report.forecasting.mape_status} value={null} size="sm" />} />
        </div>
        <h3 className="print-subheading">Champion / challenger</h3>
        <div className="print-rows">
          <Row label="Champion" value={formatCount(report.forecasting.champion_challenger.champion_count)} />
          <Row label="Challenger" value={formatCount(report.forecasting.champion_challenger.challenger_count)} />
          <Row label="Baseline" value={formatCount(report.forecasting.champion_challenger.baseline_count)} />
        </div>
      </Section>

      {/* --- 7. Safety stock -------------------------------------------- */}
      <Section number={7} title="Safety Stock">
        <div className="print-rows">
          <PopulationRow label="Current" pop={report.safety_stock.current} />
          <PopulationRow label="Recommended" pop={report.safety_stock.recommended} />
          <Row label="Both available" value={formatCount(report.safety_stock.both_available_count)} />
          <Row label="Mean delta" value={decimal(report.safety_stock.mean_delta)} />
          <Row
            label="Service level policy"
            value={<AvailabilityValue status={report.safety_stock.service_level_status} value={null} size="sm" />}
          />
        </div>
      </Section>

      {/* --- 8. Reorder point ------------------------------------------- */}
      <Section number={8} title="Reorder Point" subtitle={report.reorder_point.current_sap_value_reused_note}>
        <div className="print-rows">
          <PopulationRow label="Current" pop={report.reorder_point.current} />
          <PopulationRow label="Recommended" pop={report.reorder_point.recommended} />
          <Row label="Both available" value={formatCount(report.reorder_point.both_available_count)} />
          <Row label="Mean delta" value={decimal(report.reorder_point.mean_delta)} />
        </div>
      </Section>

      {/* --- 9. Max stock ----------------------------------------------- */}
      <Section number={9} title="Max Stock" subtitle={report.max_stock.current_sap_value_reused_note}>
        <div className="print-rows">
          <PopulationRow label="Current" pop={report.max_stock.current} />
          <PopulationRow label="Recommended" pop={report.max_stock.recommended} />
          <Row label="Both available" value={formatCount(report.max_stock.both_available_count)} />
          <Row label="Mean delta" value={decimal(report.max_stock.mean_delta)} />
          <Row
            label="Strategy policy"
            value={<AvailabilityValue status={report.max_stock.strategy_policy_status} value={null} size="sm" />}
          />
          <Row label="Strategy labelled" value={formatCount(report.max_stock.strategy_labeled_count)} />
          <Row
            label="Strategy resolved (production)"
            value={formatCount(report.max_stock.strategy_production_resolved_count)}
          />
          <Row
            label="Strategy unresolved (fixture)"
            value={formatCount(report.max_stock.strategy_unresolved_fixture_count)}
          />
        </div>
      </Section>

      {/* --- 10. Material criticality ----------------------------------- */}
      <Section
        number={10}
        title="Material Criticality"
        subtitle={
          report.material_criticality.populated_percentage !== null
            ? `In-scope materials by ZMM065 tier — criticality populated on ${percent(
                report.material_criticality.populated_percentage,
              )} of rows.`
            : "In-scope materials by ZMM065 tier. Criticality is not populated for this quarter, so the counts below are all zero — that is an absence of source data, not a measurement of zero."
        }
      >
        <Table
          headers={["Tier", "Count"]}
          rows={report.material_criticality.by_tier.map((t) => [t.criticality ?? "Unspecified", formatCount(t.count)])}
        />
        <div className="print-rows">
          <Row label="Total" value={formatCount(report.material_criticality.total)} />
          <Row label="Populated" value={formatCount(report.material_criticality.populated_count)} />
        </div>
      </Section>

      {/* --- 11. OAR ---------------------------------------------------- */}
      <Section number={11} title="OAR / Min-Max">
        <div className="print-rows">
          <Row label="OAR" value={formatCount(report.oar.is_oar_true_count)} />
          <Row label="Not OAR" value={formatCount(report.oar.is_oar_false_count)} />
          <Row label="Undetermined" value={formatCount(report.oar.is_oar_null_count)} />
        </div>
        <h3 className="print-subheading">Conversion eligibility</h3>
        <Table
          headers={["Eligibility", "Count"]}
          rows={report.oar.conversion_eligibility_breakdown.map((c) => [
            c.conversion_eligibility ?? "Unspecified",
            formatCount(c.count),
          ])}
        />
      </Section>

      {/* --- 12. Recommendations ---------------------------------------- */}
      <Section
        number={12}
        title="Recommendations"
        subtitle={`${formatCount(report.recommendations.total)} recommendations in this quarter's report.`}
      >
        <Table
          headers={["Status", "Count"]}
          rows={report.recommendations.by_status.map((s) => [s.status, formatCount(s.count)])}
        />

        <h3 className="print-subheading">Material detail</h3>
        <p className="print-disclosure">
          {materials.length === 0
            ? "No recommendation rows were returned."
            : `${formatCount(materials.length)} of ${formatCount(
                materialsTotal,
              )} recommendations, most recent first. This is a subset, not the full set, and it is not ranked by reorder-point change — the backend has no such ranking. These rows come from the live recommendations endpoint and are not scoped to this quarter.`}
        </p>
        <Table
          headers={["Material", "Plant", "Circuit", "Criticality", "Demand pattern", "ROP (current → recommended)", "Status"]}
          rows={materials.map((m) => [
            <span key="m" className="print-mono">
              {m.material.materialCode}
            </span>,
            m.plantId,
            m.circuit,
            m.criticality,
            m.demandPattern,
            // Current -> recommended, the same pairing the on-screen table
            // shows; a recommended ROP alone would not say what it changed
            // from.
            <span key="r" className="print-mono">
              {formatCount(m.current.rop)} &rarr; {formatCount(m.recommended.rop)}
            </span>,
            m.status,
          ])}
        />
      </Section>

      {/* --- 12a. Charts, as shown on screen ---------------------------- */}
      {chartRecommendations.length > 0 && (
        <section className="print-section print-charts">
          <h2 className="print-section-title">
            <span className="print-section-number">12a.</span> Charts
          </h2>
          <p className="print-section-subtitle">
            The same charts shown on the Quarterly Reports page, drawn from the same{" "}
            {formatCount(chartSampleSize)}-row sample — not the full recommendation population.
          </p>
          <div className="print-section-body">
            <div className="print-chart">
              <h3 className="print-subheading">Stockout risk distribution</h3>
              <InventoryHealthCard recommendations={chartRecommendations} />
            </div>
            <div className="print-chart">
              <h3 className="print-subheading">Recommendation status</h3>
              <p className="print-chart-caption">Where each change sits in the approval flow.</p>
              <RecommendationStatusChart recommendations={chartRecommendations} />
            </div>
            <div className="print-chart">
              <h3 className="print-subheading">Critical circuit exposure</h3>
              <p className="print-chart-caption">
                Recommendations per circuit, split by stockout-risk exposure.
              </p>
              <CircuitExposureChart recommendations={chartRecommendations} />
            </div>
          </div>
        </section>
      )}

      {/* --- 13. Approval ----------------------------------------------- */}
      <Section number={13} title="Approval">
        <div className="print-rows">
          <Row label="Ledger entries" value={formatCount(report.approval.ledger_entry_count)} />
          <Row
            label="Distinct recommendations in approval"
            value={formatCount(report.approval.distinct_recommendations_in_approval)}
          />
          <Row label="Pending" value={formatCount(report.approval.pending_count)} />
          <Row label="Approved" value={formatCount(report.approval.approved_count)} />
          <Row label="Rejected" value={formatCount(report.approval.rejected_count)} />
        </div>
      </Section>

      {/* --- 14. Baseline comparison ------------------------------------ */}
      <Section
        number={14}
        title="Current / I11 Baseline vs I07 Recommendation"
        subtitle={`Baseline lead-time source: ${report.baseline_comparison.baseline_lead_time_source}. I07 lead-time source: ${
          report.baseline_comparison.i07_lead_time_source ?? NONE
        }.`}
      >
        <Table
          headers={["Metric", "Baseline", "I07", "Delta", "Delta %", "Both available", "Availability"]}
          rows={report.baseline_comparison.rows.map((r) => [
            r.metric,
            decimal(r.baseline_value),
            decimal(r.recommendation_value),
            decimal(r.delta),
            r.delta_percentage === null ? NONE : percent(r.delta_percentage),
            formatCount(r.both_available_count),
            <AvailabilityValue key="a" status={r.availability_status} value={null} size="sm" />,
          ])}
        />
      </Section>

      {/* --- 15. SAP adoption ------------------------------------------- */}
      <Section
        number={15}
        title="SAP Adoption"
        subtitle="Whether approved recommendations were applied in SAP."
      >
        <div className="print-rows">
          <Row
            label="Adoption (this report)"
            value={<AvailabilityValue status={report.sap_adoption.status} value={null} size="sm" />}
            note={report.sap_adoption.reason ? ` — ${report.sap_adoption.reason}` : undefined}
          />
        </div>
        <p className="print-disclosure">
          The adoption figures shown on screen come from the live adoption endpoint, which takes no quarter parameter:
          they are current and platform-wide, not scoped to {meta.quarter}.
        </p>
      </Section>

      {/* --- 16. Limitations -------------------------------------------- */}
      <Section number={16} title="Limitations &amp; Dependencies">
        {report.limitations.items.length === 0 ? (
          <p className="print-empty">No limitations recorded.</p>
        ) : (
          <ul className="print-list">
            {report.limitations.items.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        )}
      </Section>

      <footer className="print-footer-note">
        <p>
          Charts shown on screen are drawn from a sample of {formatCount(chartSampleSize)} recommendation rows, not the
          full population. Figures in sections 2–11, 13, 14 and 16 are the quarter&rsquo;s own, computed once by the
          reporting service and reproduced here without recomputation.
        </p>
      </footer>
    </div>
  )
}
