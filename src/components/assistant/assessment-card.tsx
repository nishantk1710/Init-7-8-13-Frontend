import {
  factsCaveats,
  factsHeadline,
  isI08Facts,
  isI13Facts,
  type I08Facts,
  type I13Facts,
} from "@/lib/api/assistant-facts"
import { cn } from "@/lib/utils"

/**
 * The assessment shown above the question — I08 FR-5(a) and I13 FR-2(a).
 *
 * This is the part a planner actually reads, and every number on it is already
 * a field the platform holds. Nothing here is inferred and nothing is generated:
 * the backend computes the figures and writes the sentence, and the optional
 * narrative layer is off by default.
 *
 * ## Why the caveats are not on this card
 *
 * They are rendered under the question instead, by the step renderer. A
 * sentence that hedges every clause is unreadable, and the backend already
 * separates `headline` from `caveats` for that reason. Folding them back
 * together here would undo the decision.
 *
 * ## Why null is rendered differently from zero
 *
 * Several fields are three-state and collapsing them changes the advice. A
 * dash means "we cannot say"; a zero means "none". Those are different
 * instructions and they are displayed differently throughout.
 */
export function AssessmentCard({ facts }: { facts: unknown }) {
  const headline = factsHeadline(facts)

  if (isI08Facts(facts)) return <I08Card facts={facts} headline={headline} />
  if (isI13Facts(facts)) return <I13Card facts={facts} headline={headline} />

  // An unrecognised flow. These types are hand-maintained against a
  // `dict[str, Any]`, so the day the backend adds a flow the honest behaviour
  // is to show the sentence every assessment has rather than an empty card.
  if (headline === null) return null
  return (
    <Card>
      <p className="text-sm text-foreground">{headline}</p>
    </Card>
  )
}

function I08Card({
  facts,
  headline,
}: {
  facts: I08Facts
  headline: string | null
}) {
  return (
    <Card>
      <Identity
        code={facts.materialId}
        description={facts.description}
        plant={facts.plant}
        criticality={facts.criticality}
      />
      {headline && <p className="text-sm text-foreground">{headline}</p>}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        <Stat
          label="On the shelf"
          // "0 in stock" and "no stock record for this plant" look identical
          // once rendered as a number, and only one of them means the shelf is
          // empty.
          value={facts.stockIsUnknown ? null : facts.stockOnHand}
          nullNote="no stock record"
        />
        <Stat label="Open repairs" value={facts.openRepairLines} />
        <Stat label="Units in repair" value={facts.quantityUnderRepair} />
        <Stat
          label="Earliest due back"
          value={facts.soonestDueDate}
          // Once every open line is past its date, the date is a plan that has
          // been missed rather than a forecast, and showing it plainly invites
          // a planner to rely on it.
          //
          // `=== false`, not a falsy check: null is a third state meaning
          // there is no date to be reliable about, and it must not borrow the
          // warning. A part sitting on the shelf with no repair on order has
          // missed no deadline.
          tone={facts.repairDueDateIsReliable === false ? "warning" : "default"}
          suffix={
            facts.repairDueDateIsReliable === false
              ? "no longer a forecast"
              : undefined
          }
          nullNote={
            facts.openRepairLines > 0 ? "no date promised" : "no repair on order"
          }
        />
      </dl>

      {facts.overdueLines > 0 && (
        <Flag tone="warning">
          {facts.overdueLines} of {facts.openRepairLines} open{" "}
          {facts.openRepairLines === 1 ? "repair is" : "repairs are"} already
          past the promised return date.
        </Flag>
      )}

      {facts.openRepairs.length > 0 && <RepairLines repairs={facts.openRepairs} />}
    </Card>
  )
}

function RepairLines({ repairs }: { repairs: I08Facts["openRepairs"] }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase">
        Open repair lines
      </p>
      <ul className="flex flex-col gap-1.5">
        {repairs.map((repair) => (
          <li
            key={`${repair.purchasingDocument}-${repair.item}`}
            className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-lg border border-border px-2.5 py-2 text-xs"
          >
            <span className="font-medium text-foreground">
              {repair.purchasingDocument}/{repair.item}
            </span>
            <span className="text-muted-foreground">
              {repair.quantity} unit{repair.quantity === "1" ? "" : "s"}
            </span>
            <span className="text-muted-foreground">
              {/* The supplier master covers 106 of 454 service suppliers, so a
                  missing name is expected. Show the code rather than a blank,
                  and never invent a name. */}
              {repair.vendorName ?? repair.vendor ?? "vendor not named"}
            </span>
            <span className="text-muted-foreground">{repair.status}</span>
            {repair.daysOverdue !== null && repair.daysOverdue > 0 && (
              <span className="font-medium text-destructive">
                {repair.daysOverdue} days overdue
              </span>
            )}
            {/* Zero open lines in this extract carry a dispatch movement, so
                the assistant never claims the vendor physically has the unit.
                Saying so is more useful than leaving it unsaid. */}
            {!repair.dispatched && (
              <span className="text-muted-foreground">
                no dispatch movement recorded
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

function I13Card({
  facts,
  headline,
}: {
  facts: I13Facts
  headline: string | null
}) {
  return (
    <Card>
      <Identity
        code={facts.material}
        description={null}
        plant={facts.plant}
        criticality={null}
        scope={facts.materialScope}
      />
      {headline && <p className="text-sm text-foreground">{headline}</p>}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        <Stat label="On the shelf" value={facts.stockOnHand} />
        <Stat label="On order" value={facts.openPoQuantity} />
        <Stat
          label="Months of cover"
          value={facts.monthsOfCover}
          // When the figure could not be computed the reason is the useful
          // thing, not a dash on its own.
          nullNote={facts.monthsOfCoverReason ?? "cannot be computed"}
        />
        <Stat
          label="Moving class"
          value={facts.agingBand}
          suffix={
            facts.daysSinceLastMovement === null
              ? undefined
              : `${facts.daysSinceLastMovement} days since last movement`
          }
        />
      </dl>

      {facts.grNotIssuedFlag && (
        <Flag tone="warning">
          Stock received {facts.grNotIssuedDaysSinceGr ?? "some"} days ago has
          still not been issued, which is already an open exception.
        </Flag>
      )}

      {facts.crossPlantStock.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase">
            Held at other plants
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {facts.crossPlantStock.map((stock) => (
              <li
                key={stock.plant}
                className="rounded-lg border border-border px-2.5 py-1 text-xs text-foreground"
              >
                {stock.stockOnHand} at {stock.plant}
              </li>
            ))}
          </ul>
          {/* Cross-plant redeployment is deferred (D10). Stock elsewhere is
              shown for visibility only, and saying so stops it reading as an
              offer the platform cannot honour. */}
          <p className="text-[11px] text-muted-foreground">
            Shown for information. The platform does not create transfers or
            reservations, and does not write to SAP at all.
          </p>
        </div>
      )}
    </Card>
  )
}

// --- pieces -----------------------------------------------------------------

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      {children}
    </div>
  )
}

function Identity({
  code,
  description,
  plant,
  criticality,
  scope,
}: {
  code: string
  description: string | null
  plant: string
  criticality: string | null
  scope?: string
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <span className="font-mono text-sm font-medium text-foreground">
        {code}
      </span>
      {description && (
        <span className="text-sm text-muted-foreground">{description}</span>
      )}
      <span className="text-xs text-muted-foreground">plant {plant}</span>
      {criticality && (
        <span className="rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground">
          {criticality}
        </span>
      )}
      {scope && (
        <span className="rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground">
          {scope}
        </span>
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  suffix,
  nullNote,
  tone = "default",
}: {
  label: string
  value: string | number | null
  suffix?: string
  /** Shown in place of the value when it is null. Never rendered as "0". */
  nullNote?: string
  tone?: "default" | "warning"
}) {
  const missing = value === null || value === undefined || value === ""
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11px] tracking-[0.3px] text-muted-foreground uppercase">
        {label}
      </dt>
      <dd
        className={cn(
          "text-sm font-medium",
          missing ? "text-muted-foreground" : "text-foreground",
          tone === "warning" && !missing && "text-foreground"
        )}
      >
        {missing ? (nullNote ?? "—") : value}
      </dd>
      {suffix && (
        <span
          className={cn(
            "text-[11px]",
            tone === "warning" ? "text-destructive" : "text-muted-foreground"
          )}
        >
          {suffix}
        </span>
      )}
    </div>
  )
}

function Flag({
  children,
  tone,
}: {
  children: React.ReactNode
  tone: "warning"
}) {
  return (
    <p
      className={cn(
        "rounded-lg border px-2.5 py-2 text-xs",
        tone === "warning" &&
          "border-destructive/30 bg-destructive/5 text-foreground"
      )}
    >
      {children}
    </p>
  )
}

/** Exported for the trace view, which renders the assessment exactly as served. */
export function AssessmentCaveats({ facts }: { facts: unknown }) {
  const caveats = factsCaveats(facts)
  if (caveats.length === 0) return null
  return (
    <ul className="flex flex-col gap-1">
      {caveats.map((caveat) => (
        <li key={caveat} className="text-xs text-muted-foreground">
          {caveat}
        </li>
      ))}
    </ul>
  )
}
