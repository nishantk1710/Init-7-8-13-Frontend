"use client"

// Print view of a generated quarterly report that has the management view (report version 1.2) -- the "Download PDF"
// output, rendered by the browser's own print dialog in the same print styles as every other report here.
//
// It prints the saved report's `management` section: the same object the page and the Excel export are drawn from, so the
// three cannot show different figures. Nothing is recalculated and nothing but the list of the period's recommendations is
// fetched.
//
// Tables, not charts. A chart sized by the browser can be clipped or split across pages; a table paginates cleanly, and a
// printed report needs the figures themselves. Every number a chart on the page is drawn from is here as a row.
//
// An unavailable figure is printed as "Not available" with its reason -- never as a dash that could be read as zero, and a
// stockout reading that was too old for the period is not printed as the period's position.
//
// Reports saved before the management view keep the older print view (report-print-view.tsx), unchanged.

import { Row, Section, Table } from "@/features/initiative-7/components/report-print-view"
import { sapPlantLabel } from "@/lib/shared-data/sap-plants"
import { formatCount, formatIsoDateDMY } from "@/lib/utils"
import type { ApiQuarterlyReport, ApiQuarterManagement } from "@/features/initiative-7/types/api"
import type { Recommendation } from "@/features/initiative-7/types/inventory"
import {
  activityCell,
  adoptionSummaryOf,
  kpiValueText,
  millions,
  monthBasisLabel,
  num,
  orderedKpis,
  stockoutUsable,
} from "@/features/initiative-7/utils/quarterly-management"

const NOT_AVAILABLE = "Not available"

const KIND_LABEL = {
  EVENT: "Event in the period",
  STATUS_AS_OF: "Status on a date",
  MEASUREMENT: "Measurement",
  AGGREGATE: "Total over the period",
} as const

const date = (iso: string | null) => (iso ? formatIsoDateDMY(iso.slice(0, 10)) : NOT_AVAILABLE)
const share = (part: number, whole: number) => (whole <= 0 ? "—" : `${((part / whole) * 100).toFixed(1)}%`)

export interface ManagementPrintProps {
  report: ApiQuarterlyReport
  management: ApiQuarterManagement
  /** The period's recommendations, newest first -- a list, not the population the figures are over. */
  materials: Recommendation[]
  materialsTotal: number
}

export function ManagementPrintView({ report, management, materials, materialsTotal }: ManagementPrintProps) {
  const meta = report.metadata
  const usable = stockoutUsable(management)
  const stockout = management.position.stockout
  const adoption = adoptionSummaryOf(management.adoption)
  const trends = management.trends
  const forecast = management.forecast_actual
  const coverage = management.data_coverage
  const cards = orderedKpis(management.kpis)
  const baseline = new Map(report.baseline_comparison.rows.map((row) => [row.metric, row]))
  let section = 0
  const next = () => ++section

  return (
    <div className="print-root" data-testid="report-print-view" data-quarter={meta.quarter}>
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
            <dt>Period</dt>
            <dd>
              {management.period.status === "COMPLETE" ? "Complete" : "In progress"} · figures to {date(management.period.cutoff)}
            </dd>
          </div>
          <div>
            <dt>Generated</dt>
            <dd>{new Date(meta.generated_at).toLocaleString()}</dd>
          </div>
          <div>
            <dt>Report version</dt>
            <dd>{meta.report_version}</dd>
          </div>
          <div>
            <dt>Figures are</dt>
            <dd>{coverage.basis === "snapshot" ? "Quarter-end snapshot, with current calculations" : "Current calculations"}</dd>
          </div>
        </dl>
      </header>

      <Section number={next()} title="Summary" subtitle={management.period.note}>
        <Table
          headers={["Figure", "Value", "Kind", "Measured", "Covers / out of", "Basis"]}
          rows={cards.map((card) => [
            card.title,
            kpiValueText(card) === NOT_AVAILABLE ? NOT_AVAILABLE : `${kpiValueText(card)}${card.key === "excess_inventory_opportunity" || card.key === "working_capital_impact" ? "" : ` ${card.unit}`}`,
            KIND_LABEL[card.kind],
            card.measured_on ? date(card.measured_on) : "—",
            `${card.period_label}${card.denominator !== null ? ` · of ${formatCount(card.denominator)} ${card.denominator_label ?? ""}` : ""}`,
            card.basis === "snapshot" ? "Saved month-end snapshot" : "Current calculation",
          ])}
        />
        {cards.map((card) => (
          <p key={card.key} className="print-disclosure">
            <strong>{card.title}.</strong> {card.explanation}
            {kpiValueText(card) === NOT_AVAILABLE && card.unavailable_reason ? ` Not available: ${card.unavailable_reason}` : ""}
            {card.note ? ` ${card.note}` : ""}
          </p>
        ))}
      </Section>

      <Section number={next()} title="Activity by Month" subtitle="Events counted in the month they happened in. The months add up to the quarter total.">
        <Table
          headers={["Metric", ...management.monthly_activity.months.map((m) => m.label), "Quarter total"]}
          rows={management.monthly_activity.rows.map((row) => [
            `${row.label} (${row.unit})`,
            ...row.months.map((value) => (num(value) === null ? NOT_AVAILABLE : activityCell(value))),
            num(row.quarter_total) === null ? NOT_AVAILABLE : activityCell(row.quarter_total),
          ])}
        />
        <p className="print-disclosure">
          Not available means the month has not started, is not covered by the staged SAP data, or is not tracked by month. It is
          not a count of zero. Decisions are counted from the dated approval history, not from a recommendation&apos;s current status.
        </p>
        {management.monthly_activity.rows
          .filter((row) => row.note)
          .map((row) => (
            <p key={row.key} className="print-disclosure">
              <strong>{row.label}.</strong> {row.note}
            </p>
          ))}
      </Section>

      <Section number={next()} title="Stockout Risk Distribution" subtitle="Fast and slow moving material-plants, by stock on hand against lead-time need.">
        {usable ? (
          <>
            <Table
              headers={["Level", "Count", "Share of judged"]}
              rows={[
                ["High (below lead-time need)", formatCount(stockout.at_risk), share(stockout.at_risk, stockout.evaluated)],
                ["Low (covers lead time)", formatCount(Math.max(stockout.evaluated - stockout.at_risk, 0)), share(Math.max(stockout.evaluated - stockout.at_risk, 0), stockout.evaluated)],
                ["Could not be judged (not counted above)", formatCount(stockout.insufficient_data), "—"],
              ]}
            />
            <p className="print-disclosure">As of {date(stockout.as_of)}.</p>
          </>
        ) : (
          <p className="print-empty">
            {NOT_AVAILABLE}. {stockout.stale_note ?? "The stockout usage has not been built, so nothing can be judged."}
          </p>
        )}
      </Section>

      <Section number={next()} title="By Plant" subtitle="Stockout risk and excess inventory, per plant.">
        <Table
          headers={["Plant", "Material-plants", usable ? "At stockout risk" : "Stockout risk", "Judged", "Excess candidates", "Excess opportunity", "Working capital (estimate)"]}
          rows={management.plant_positions.map((entry) => [
            entry.plant === null ? "All plants" : sapPlantLabel(entry.plant),
            formatCount(entry.figures.population),
            usable ? formatCount(entry.figures.stockout.at_risk) : NOT_AVAILABLE,
            usable ? formatCount(entry.figures.stockout.evaluated) : NOT_AVAILABLE,
            formatCount(entry.figures.excess_count),
            millions(num(entry.figures.excess_opportunity), entry.figures.currency),
            millions(num(entry.figures.net_rop_value_impact), entry.figures.currency, true),
          ])}
        />
        <p className="print-disclosure">
          Each figure counts the newest recommendation of each material-plant{management.position_basis === "snapshot" ? ", as saved in the quarter-end snapshot" : ""}.
          Money figures are estimates of what the recommendations would change, not realised savings.
        </p>
      </Section>

      <Section number={next()} title="SAP Adoption" subtitle="Recommendations with a change to adopt, checked against SAP change history.">
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
          <p className="print-empty">{NOT_AVAILABLE}.</p>
        )}
        <p className="print-disclosure">
          {management.adoption.reason} Recommendations awaiting a decision: {formatCount(management.adoption.pending_approvals)}.
        </p>
      </Section>

      {trends && (
        <>
          <Section number={next()} title="Monthly Trends" subtitle="What was measured at the time, from saved monthly snapshots. A month with no snapshot is not available, not zero.">
            <Table
              headers={["Month", "Snapshot", "Measured", "At stockout risk", "Excess opportunity", "Working capital (estimate)", "Change from last month"]}
              rows={trends.months.map((m) => [
                m.label,
                monthBasisLabel(m),
                date(m.measured_on),
                m.stockout_at_risk === null ? NOT_AVAILABLE : `${formatCount(m.stockout_at_risk)}${m.stockout_evaluated !== null ? ` of ${formatCount(m.stockout_evaluated)}` : ""}`,
                m.state === "MISSING" ? NOT_AVAILABLE : millions(num(m.excess_opportunity), m.currency),
                m.state === "MISSING" ? NOT_AVAILABLE : millions(num(m.net_rop_value_impact), m.currency, true),
                num(m.net_rop_change_from_previous) === null ? NOT_AVAILABLE : millions(num(m.net_rop_change_from_previous), m.currency, true),
              ])}
            />
            {trends.months.filter((m) => m.note).map((m) => (
              <p key={m.month} className="print-disclosure">
                <strong>{m.label}.</strong> {m.note}
              </p>
            ))}
            {trends.notes.map((note) => (
              <p key={note} className="print-disclosure">
                {note}
              </p>
            ))}
            <p className="print-disclosure">
              Counts are positions on a date: each month shows its own, and they are never added into a quarter total.
            </p>
          </Section>

          <Section number={next()} title="Quarter-End Position" subtitle="The last month's saved snapshot, shown only when it is valid for the end of the quarter.">
            {trends.quarter_end.status === "AVAILABLE" ? (
              <>
                <p className="print-disclosure">
                  The saved {trends.quarter_end.label} month-end snapshot, measured {date(trends.quarter_end.measured_on)}.
                </p>
                <Table
                  headers={["Stock level", "Current (SAP), mean", "Recommended, mean", "Records"]}
                  rows={trends.quarter_end.stock_levels.map((level) => [
                    level.label,
                    num(level.current) === null ? NOT_AVAILABLE : (num(level.current) as number).toFixed(1),
                    num(level.recommended) === null ? NOT_AVAILABLE : (num(level.recommended) as number).toFixed(1),
                    formatCount(level.records),
                  ])}
                />
              </>
            ) : (
              <>
                <p className="print-empty">
                  {NOT_AVAILABLE}. {trends.quarter_end.reason}
                </p>
                {trends.quarter_end.latest_available_label && (
                  <p className="print-disclosure">
                    The latest snapshot available is {trends.quarter_end.latest_available_label}, measured{" "}
                    {date(trends.quarter_end.latest_available_measured_on)}. It is not shown as the quarter-end.
                  </p>
                )}
              </>
            )}
          </Section>
        </>
      )}

      <Section number={next()} title="Current SAP vs I07 Recommendation" subtitle="Average per recommendation generated this period, over those with both a current and a recommended value.">
        <Table
          headers={["Stock level", "Current (SAP), average", "Recommended, average", "Change", "Records"]}
          rows={[
            ["Safety Stock", "Safety stock"],
            ["ROP", "Reorder point"],
            ["Max Stock", "Maximum stock"],
          ].flatMap(([metric, label]) => {
            const row = baseline.get(metric)
            return row
              ? [[
                  label,
                  num(row.baseline_value) === null ? NOT_AVAILABLE : (num(row.baseline_value) as number).toFixed(1),
                  num(row.recommendation_value) === null ? NOT_AVAILABLE : (num(row.recommendation_value) as number).toFixed(1),
                  num(row.delta) === null ? "—" : `${(num(row.delta) as number) > 0 ? "+" : ""}${(num(row.delta) as number).toFixed(1)}`,
                  formatCount(row.both_available_count),
                ]]
              : []
          })}
        />
        <p className="print-disclosure">A value not set in SAP is not a stock level of zero.</p>
      </Section>

      <Section number={next()} title="Forecast vs Actual Demand" subtitle="The champion models' one-month-ahead forecast against what was actually used in the same month.">
        {forecast.status === "AVAILABLE" ? (
          <>
            <Table
              headers={["Month", "Forecast", "Actual", "Material-plants"]}
              rows={[
                ...forecast.months.map((m) => [
                  formatIsoDateDMY(m.month).replace(/^\d+ /, ""),
                  num(m.forecast) === null ? NOT_AVAILABLE : formatCount(Math.round(num(m.forecast) as number)),
                  num(m.actual) === null ? NOT_AVAILABLE : formatCount(Math.round(num(m.actual) as number)),
                  formatCount(m.material_count),
                ]),
                ["Quarter total", formatCount(Math.round(num(forecast.forecast_total) ?? 0)), formatCount(Math.round(num(forecast.actual_total) ?? 0)), "—"],
              ]}
            />
            {forecast.accuracy && (
              <p className="print-disclosure">
                Accuracy over {formatCount(forecast.accuracy.observations)} observations: mean absolute error{" "}
                {num(forecast.accuracy.mean_absolute_error) === null ? NOT_AVAILABLE : (num(forecast.accuracy.mean_absolute_error) as number).toFixed(2)}
                , bias {num(forecast.accuracy.bias_percentage) === null ? NOT_AVAILABLE : `${((num(forecast.accuracy.bias_percentage) as number) * 100).toFixed(1)}% of actual demand`}
                . Taken from the observations themselves, not by averaging monthly percentages.
              </p>
            )}
          </>
        ) : (
          <p className="print-empty">{NOT_AVAILABLE}.</p>
        )}
        <p className="print-disclosure">{forecast.note}</p>
      </Section>

      <Section number={next()} title={`Recommendations Generated in ${meta.quarter}`}>
        <p className="print-disclosure">
          {`${formatCount(materials.length)} of ${formatCount(materialsTotal)} recommendations generated in this period, newest first. This is a list, not the population the figures above are over: those cover all ${formatCount(materialsTotal)}.`}
        </p>
        <Table
          headers={["Material", "Plant", "Crit.", "Demand pattern", "Safety stock", "Reorder point", "Max stock", "Status", "Generated"]}
          rows={materials.map((rec) => [
            <span key="m">
              {rec.material.description} <span className="print-mono">{rec.material.materialId}</span>
            </span>,
            rec.plantId,
            rec.criticality,
            rec.demandPattern,
            <span key="s" className="print-mono">
              {formatCount(rec.current.safetyStock)} &rarr; {formatCount(rec.recommended.safetyStock)}
            </span>,
            <span key="r" className="print-mono">
              {formatCount(rec.current.rop)} &rarr; {formatCount(rec.recommended.rop)}
            </span>,
            <span key="x" className="print-mono">
              {formatCount(rec.current.maxStock)} &rarr; {formatCount(rec.recommended.maxStock)}
            </span>,
            rec.status,
            rec.generatedAt,
          ])}
        />
      </Section>

      <Section number={next()} title="Data Coverage and Limitations" subtitle="What these figures are based on, and why anything may be missing or old.">
        <div className="print-rows">
          <Row label="Latest consumption (goods issue)" value={date(coverage.latest_consumption_date)} />
          <Row label="Staged consumption ends" value={coverage.latest_consumption_month ? formatIsoDateDMY(coverage.latest_consumption_month).replace(/^\d+ /, "") : NOT_AVAILABLE} />
          <Row label="Stockout usage measured as of" value={date(coverage.stockout_usage_as_of)} />
          <Row label="Stock on hand last loaded" value={date(coverage.latest_stock_loaded_at)} />
          <Row label="Recommendations counted" value={formatCount(coverage.eligible_recommendations)} />
          <Row label="Material-plants assessed" value={formatCount(coverage.eligible_material_plants)} />
        </div>
        <Table
          headers={["Month", "SAP consumption data", "Recommendations generated"]}
          rows={coverage.months.map((m) => [
            m.label,
            { AVAILABLE: "Covered", NO_ACTIVITY: "Covered, no movements", NOT_COVERED: "Not covered", NO_SOURCE_DATA: "No data loaded" }[m.consumption_status],
            formatCount(m.recommendations_generated),
          ])}
        />
        {coverage.warnings.map((warning) => (
          <p key={warning} className="print-disclosure">
            {warning}
          </p>
        ))}
        {management.definitions.map((definition) => (
          <p key={definition} className="print-disclosure">
            {definition}
          </p>
        ))}
        {report.limitations.items.map((item) => (
          <p key={item} className="print-disclosure">
            {item}
          </p>
        ))}
      </Section>

      <footer className="print-footer-note">
        <p>
          Generated from the saved report: the same figures the page and the Excel export show. The full technical detail
          (demand classification, forecast accuracy, OAR, approval activity) is in the Excel export.
        </p>
      </footer>
    </div>
  )
}
