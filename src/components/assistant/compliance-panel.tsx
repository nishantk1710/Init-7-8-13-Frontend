import { CircleCheck, CircleHelp, TriangleAlert } from "lucide-react"

import { InfoPopup, type InfoTone } from "@/components/shared/info-popup"
import { cn } from "@/lib/utils"

/**
 * The three compliance checks WS7 owns, and how far each one can actually be
 * answered today.
 *
 * ## Why "blocked" is a state, and why it is not zero
 *
 * Two of these can be counted from what the platform holds. The third cannot
 * be counted at all: flagging an 80-series or OAR reservation that carries no
 * valid session reference (I08 FR-8, I13 FR-4) means reading the reference
 * back off the reservation, and `Bednr` is not exposed on
 * `ReservationItemSet`.
 *
 * A screen showing "0 missing sessions" would be read as full compliance. It
 * would in fact mean the check has never run and cannot run. Those are
 * opposite claims, and the difference is the entire value of a compliance
 * screen — so the third check renders as *blocked*, greyed, with the reason,
 * and never as a number.
 *
 * This is the same reasoning the session trace uses for `linkageNote`: state
 * what is not known rather than letting an absence read as an all-clear.
 */

export type ComplianceCheck = {
  id: string
  label: string
  /** What this check is looking for, in a planner's words. */
  description: string
  /** The (i) beside the label: what is counted, and what is not. */
  info?: { summary: string; points: string[] }
} & (
  | { state: "counted"; count: number; detail?: string }
  | { state: "blocked"; reason: string; dependency: string }
)

export function CompliancePanel({ checks }: { checks: ComplianceCheck[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {checks.map((check) => (
        <CheckCard key={check.id} check={check} />
      ))}
    </div>
  )
}

/**
 * The card's edge: green once a check comes back clean, otherwise amber for a
 * reasoned decision and red for an unanswered one. A blocked check has none.
 */
const EDGE_BY_ID: Record<string, string> = {
  "advice-not-taken": "before:bg-warning",
  abandoned: "before:bg-destructive",
  "missing-session": "before:bg-destructive",
}

const INFO_TONE_BY_ID: Record<string, InfoTone> = {
  "advice-not-taken": "warning",
  abandoned: "danger",
  "missing-session": "danger",
}

function CheckInfo({ check, info }: { check: ComplianceCheck; info: NonNullable<ComplianceCheck["info"]> }) {
  return (
    <InfoPopup title={check.label} description={info.summary} tone={INFO_TONE_BY_ID[check.id] ?? "info"}>
      <ul className="list-disc space-y-1.5 pl-4 text-sm text-foreground marker:text-muted-foreground">
        {info.points.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
    </InfoPopup>
  )
}

function CheckCard({ check }: { check: ComplianceCheck }) {
  const blocked = check.state === "blocked"
  const clean = check.state === "counted" && check.count === 0

  return (
    <div
      className={cn(
        "relative flex flex-col gap-1 overflow-hidden rounded-xl border py-4 pr-4 pl-5",
        blocked
          ? // Dashed, muted, and no figure. It must not be mistakable for a
            // count of zero.
            "border-dashed border-border bg-transparent"
          : cn(
              "border-border bg-card before:absolute before:inset-y-0 before:left-0 before:w-1",
              clean ? "before:bg-success" : (EDGE_BY_ID[check.id] ?? "before:bg-action")
            )
      )}
    >
      {check.state === "counted" ? (
        <>
          <p className="text-[30px] leading-tight font-semibold tracking-tight text-foreground tabular-nums">
            {check.count.toLocaleString()}
          </p>
          <p className="flex items-center gap-1.5 text-base font-semibold text-foreground">
            {clean ? (
              <CircleCheck className="size-4 text-success" aria-hidden />
            ) : (
              <TriangleAlert className="size-4 text-muted-foreground" aria-hidden />
            )}
            {check.label}
            {check.info && <CheckInfo check={check} info={check.info} />}
          </p>
          <p className="text-sm text-muted-foreground">{check.description}</p>
          {check.detail && <p className="text-xs text-muted-foreground">{check.detail}</p>}
        </>
      ) : (
        <>
          {/* Deliberately not a number, not a dash in the same typeface as a
              figure, and not "—". A word, so it cannot be skimmed as a count. */}
          <p className="flex items-center gap-1.5 text-base font-semibold text-muted-foreground">
            <CircleHelp className="size-4" aria-hidden />
            {check.label}: cannot be checked
          </p>
          <p className="text-sm text-muted-foreground">{check.reason}</p>
          <p className="text-xs text-muted-foreground">Blocked on: {check.dependency}</p>
          <p className="text-sm text-muted-foreground">{check.description}</p>
        </>
      )}
    </div>
  )
}
