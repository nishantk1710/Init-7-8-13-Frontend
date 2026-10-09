"use client"

import { useEffect, useState } from "react"
import {
  ArrowDownToLine,
  CalendarClock,
  Gauge,
  MapPin,
  Package,
  PackageCheck,
  TrendingUp,
  TriangleAlert,
  Wrench,
} from "lucide-react"

import { AiIconBadge } from "@/components/assistant/ai-visuals"
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

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat
          icon={<PackageCheck />}
          label="On the shelf"
          // "0 in stock" and "no stock record for this plant" look identical
          // once rendered as a number, and only one of them means the shelf is
          // empty.
          value={facts.stockIsUnknown ? null : facts.stockOnHand}
          nullNote="no stock record"
        />
        <Stat icon={<Wrench />} label="Open repairs" value={facts.openRepairLines} />
        <Stat icon={<Package />} label="Units in repair" value={facts.quantityUnderRepair} />
        <Stat
          icon={<CalendarClock />}
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
      <SectionLabel>Open repair lines</SectionLabel>
      <ul className="relative flex flex-col gap-1.5 pl-5">
        <span
          aria-hidden
          className="absolute top-2 bottom-2 left-[7px] w-px bg-gradient-to-b from-ai-1/50 via-ai-2/40 to-transparent"
        />
        {repairs.map((repair) => (
          <li
            key={`${repair.purchasingDocument}-${repair.item}`}
            className="relative flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-xl border border-border bg-background/60 px-3 py-2 text-xs"
          >
            <TimelineDot overdue={repair.daysOverdue !== null && repair.daysOverdue > 0} />
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
              <span className="rounded-full bg-destructive/10 px-2 py-0.5 font-medium text-destructive">
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

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat icon={<PackageCheck />} label="On the shelf" value={facts.stockOnHand} />
        <Stat icon={<ArrowDownToLine />} label="On order" value={facts.openPoQuantity} />
        <Stat
          icon={<Gauge />}
          label="Months of cover"
          value={facts.monthsOfCover}
          // When the figure could not be computed the reason is the useful
          // thing, not a dash on its own.
          nullNote={facts.monthsOfCoverReason ?? "cannot be computed"}
        />
        <Stat
          icon={<TrendingUp />}
          label="Moving class"
          value={facts.agingBand}
          band={facts.agingBand}
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
          <SectionLabel>Held at other plants</SectionLabel>
          <ul className="flex flex-wrap gap-1.5">
            {facts.crossPlantStock.map((stock) => (
              <li
                key={stock.plant}
                className="animate-ai-pop inline-flex items-center gap-1 rounded-full border border-ai-2/25 bg-ai-2/5 px-2.5 py-1 text-xs text-foreground"
              >
                <MapPin className="size-3 text-ai-2" aria-hidden />
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
    <div className="animate-ai-message-in relative flex flex-col gap-3.5 overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-sm">
      <span aria-hidden className="ai-gradient absolute inset-x-0 top-0 h-1" />
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
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
      <AiIconBadge className="size-8 rounded-lg">
        <Package className="size-4" />
      </AiIconBadge>
      <span className="font-mono text-base font-semibold tracking-wide text-foreground">
        {code}
      </span>
      {description && (
        <span className="text-sm text-muted-foreground">{description}</span>
      )}
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
        <MapPin className="size-3" aria-hidden />
        plant {plant}
      </span>
      {criticality && (
        <span className="rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-[11px] font-medium text-warning">
          {criticality}
        </span>
      )}
      {scope && (
        <span className="ai-gradient rounded-full px-2 py-0.5 text-[11px] font-semibold text-white">
          {scope}
        </span>
      )}
    </div>
  )
}

/** Colour for the backend's aging band. Display only — the band is the backend's. */
const BAND_TONE: Record<string, string> = {
  FAST: "bg-success/15 text-success",
  SLOW: "bg-warning/15 text-warning",
  NON_MOVING: "bg-destructive/10 text-destructive",
}

function Stat({
  icon,
  label,
  value,
  suffix,
  nullNote,
  band,
  tone = "default",
}: {
  icon?: React.ReactNode
  label: string
  value: string | number | null
  suffix?: string
  /** Shown in place of the value when it is null. Never rendered as "0". */
  nullNote?: string
  /** An aging band value, rendered as a coloured chip instead of plain text. */
  band?: string | null
  tone?: "default" | "warning"
}) {
  const missing = value === null || value === undefined || value === ""
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-xl border p-3 transition-colors",
        tone === "warning" && !missing
          ? "border-warning/30 bg-warning/5"
          : "border-border/70 bg-muted/40"
      )}
    >
      <dt className="flex items-center gap-1.5 text-[11px] tracking-[0.06em] text-muted-foreground uppercase [&_svg]:size-3.5 [&_svg]:text-ai-2">
        {icon}
        {label}
      </dt>
      <dd
        className={cn(
          missing
            ? "text-sm font-medium text-muted-foreground"
            : "text-xl font-semibold tracking-tight text-foreground tabular-nums"
        )}
      >
        {missing ? (
          (nullNote ?? "—")
        ) : band ? (
          <span
            className={cn(
              "inline-flex rounded-full px-2 py-0.5 text-sm font-semibold",
              BAND_TONE[band] ?? "bg-muted text-foreground"
            )}
          >
            {value}
          </span>
        ) : (
          <CountUp value={value} />
        )}
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
        "animate-ai-pop flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs",
        tone === "warning" &&
          "border-destructive/30 bg-destructive/5 text-foreground"
      )}
    >
      <span className="relative mt-0.5 flex size-4 shrink-0 items-center justify-center">
        <span
          aria-hidden
          className="animate-ai-ping absolute inline-flex size-2 rounded-full bg-destructive/50"
        />
        <TriangleAlert className="relative size-4 text-destructive" aria-hidden />
      </span>
      <span>{children}</span>
    </p>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
      {children}
    </p>
  )
}

function TimelineDot({ overdue }: { overdue: boolean }) {
  return (
    <span aria-hidden className="absolute top-3 -left-[17px] flex size-2.5">
      {overdue && (
        <span className="animate-ai-ping absolute inline-flex size-full rounded-full bg-destructive/60" />
      )}
      <span
        className={cn(
          "relative inline-flex size-2.5 rounded-full ring-2 ring-card",
          overdue ? "bg-destructive" : "ai-gradient"
        )}
      />
    </span>
  )
}

/**
 * A whole number that counts up from zero on first render.
 *
 * Only plain integers animate. Anything else — a decimal sent as a string, a
 * date — is shown exactly as the backend sent it, because re-formatting a
 * figure is how a number on screen stops matching the record.
 */
function CountUp({ value }: { value: string | number }) {
  const text = String(value)
  const target = /^\d{1,7}$/.test(text) ? Number(text) : null
  const [shown, setShown] = useState(target === null ? text : "0")

  useEffect(() => {
    if (target === null) return
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    const start = performance.now()
    const duration = reduce || target === 0 ? 0 : 700
    let frame = 0
    const tick = (now: number) => {
      const t = duration === 0 ? 1 : Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setShown(t === 1 ? text : String(Math.round(target * eased)))
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, text])

  return <>{target === null ? text : shown}</>
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
