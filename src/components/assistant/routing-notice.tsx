import Link from "next/link"
import { CircleCheck, TriangleAlert } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import type { ApiRouting } from "@/lib/api/assistant"

/**
 * What to show when the assistant has nothing to say, and when it cannot say it.
 *
 * These are two different outcomes and they must not look the same.
 */

/**
 * The material is out of scope: neither 80-series nor OAR.
 *
 * **This is a 200, not an error.** The backend returns routing with
 * `flow: "none"` and a null session, because the assistant genuinely has no
 * opinion about a consumable and minting a session to record silence would
 * fill an append-only table with it.
 *
 * Rendering this as a failure would be wrong twice over: it tells a planner
 * something broke when nothing did, and it invites them to retry something
 * that will never behave differently. `routing.reason` is a written sentence
 * for exactly this screen — a requester who sees nothing asks why, and "the
 * assistant has nothing to say about this part" is an answer.
 */
export function OutOfScopeNotice({ routing }: { routing: ApiRouting }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <CircleCheck className="size-4 text-muted-foreground" aria-hidden />
        <h2 className="text-sm font-medium text-foreground">
          Nothing to check for this material
        </h2>
      </div>

      <p className="text-sm text-muted-foreground">{routing.reason}</p>

      <dl className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
        <Detail label="Material" value={routing.materialId} />
        <Detail label="Plant" value={routing.plant} />
        <Detail label="Scope" value={routing.materialScope} />
        {routing.mrpType && <Detail label="MRP type" value={routing.mrpType} />}
      </dl>

      <p className="text-xs text-muted-foreground">
        Go ahead with the reservation in SAP. There is no session reference to
        record, because no advice was given.
      </p>

      <Link
        href="/assistant"
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        Check another material
      </Link>
    </div>
  )
}

/**
 * The material is in scope but the platform has no read model for it — a
 * genuine data gap, returned as a 422 with a sentence.
 *
 * Distinct from out-of-scope on purpose. "We have nothing to say about this
 * part" and "we should have something to say and do not" are opposite
 * statements about our own coverage, and the second one is worth reporting.
 * The WATCH mart covers a fraction of the OAR population today, so a planner
 * will meet this.
 */
export function AssessmentUnavailableNotice({
  message,
  materialId,
  plant,
}: {
  message: string
  materialId: string
  plant: string
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-5">
      <div className="flex items-center gap-2">
        <TriangleAlert className="size-4 text-destructive" aria-hidden />
        <h2 className="text-sm font-medium text-foreground">
          No assessment available for this material
        </h2>
      </div>

      <p className="text-sm text-foreground">{message}</p>

      <dl className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
        <Detail label="Material" value={materialId} />
        <Detail label="Plant" value={plant} />
      </dl>

      <p className="text-xs text-muted-foreground">
        This part is in scope, so the assistant should have had something to
        say. It is a gap in what the platform holds, not a decision about the
        part — nothing here says the reservation is wrong.
      </p>

      <Link
        href="/assistant"
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        Check another material
      </Link>
    </div>
  )
}

/**
 * A reference that does not resolve.
 *
 * The backend distinguishes "never issued" from "mistyped" and the copy has to
 * as well. A reference with a bad check character is a typo; one that checksums
 * cleanly but matches no row was never issued. Calling a typo a compliance
 * failure accuses somebody who did everything right, which is the specific
 * harm the check character exists to prevent.
 */
export function SessionNotFoundNotice({
  sessionId,
  message,
}: {
  sessionId: string
  message: string
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <TriangleAlert className="size-4 text-muted-foreground" aria-hidden />
        <h2 className="text-sm font-medium text-foreground">
          No session with that reference
        </h2>
      </div>

      <p className="font-mono text-sm tracking-[0.15em] text-foreground">
        {sessionId}
      </p>
      <p className="text-sm text-muted-foreground">{message}</p>
      <p className="text-xs text-muted-foreground">
        Check the reference against what you were given. A single mistyped
        character is caught deliberately rather than matching the wrong
        session.
      </p>

      <Link
        href="/assistant/sessions"
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        Browse recorded sessions
      </Link>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-1.5">
      <dt>{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  )
}
