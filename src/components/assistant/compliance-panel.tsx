import { CircleCheck, CircleHelp, TriangleAlert } from "lucide-react"

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
} & (
  | { state: "counted"; count: number; detail?: string }
  | { state: "blocked"; reason: string; dependency: string }
)

export function CompliancePanel({ checks }: { checks: ComplianceCheck[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {checks.map((check) => (
        <CheckCard key={check.id} check={check} />
      ))}
    </div>
  )
}

function CheckCard({ check }: { check: ComplianceCheck }) {
  const blocked = check.state === "blocked"
  const clean = check.state === "counted" && check.count === 0

  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 rounded-xl border p-4",
        blocked
          ? // Dashed, muted, and no figure. It must not be mistakable for a
            // count of zero.
            "border-dashed border-border bg-transparent"
          : "border-border bg-card"
      )}
    >
      <div className="flex items-center gap-1.5">
        {blocked ? (
          <CircleHelp className="size-3.5 text-muted-foreground" aria-hidden />
        ) : clean ? (
          <CircleCheck className="size-3.5 text-muted-foreground" aria-hidden />
        ) : (
          <TriangleAlert className="size-3.5 text-destructive" aria-hidden />
        )}
        <span className="text-[11px] font-medium tracking-[0.3px] text-muted-foreground uppercase">
          {check.label}
        </span>
      </div>

      {check.state === "counted" ? (
        <>
          <p
            className={cn(
              "text-2xl font-semibold tabular-nums",
              clean ? "text-muted-foreground" : "text-foreground"
            )}
          >
            {check.count}
          </p>
          {check.detail && (
            <p className="text-[11px] text-muted-foreground">{check.detail}</p>
          )}
        </>
      ) : (
        <>
          {/* Deliberately not a number, not a dash in the same typeface as a
              figure, and not "—". A word, so it cannot be skimmed as a count. */}
          <p className="text-sm font-medium text-muted-foreground">
            Cannot be checked
          </p>
          <p className="text-[11px] text-muted-foreground">{check.reason}</p>
          <p className="text-[11px] text-muted-foreground">
            Blocked on: {check.dependency}
          </p>
        </>
      )}

      <p className="mt-0.5 text-[11px] text-muted-foreground">
        {check.description}
      </p>
    </div>
  )
}
