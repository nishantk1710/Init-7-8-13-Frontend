import { AlertBanner } from "@/components/shared/alert-banner"
import { EmptyState } from "@/components/shared/empty-state"
import { formatCount } from "@/lib/utils"

/**
 * Server-rendered load states, for pages that fetch before they render.
 *
 * The client-side `query-states.tsx` set (`LoadingState`, `ErrorState` with a
 * Retry button, `UnavailableState`) is still used by the one genuinely
 * client-fetched component left — the data-source panel. These are its
 * server-side counterparts, and the difference is not cosmetic:
 *
 *   - **No loading state.** A server component does not render until its data
 *     has arrived. There is no in-between to draw, which is the point of
 *     fetching on the server.
 *   - **No retry button.** A retry on the client re-runs a `fetch`; here the
 *     equivalent is re-requesting the page, which is what the browser's reload
 *     already does. A button that called `router.refresh()` would look like a
 *     narrower action than it is.
 */

/**
 * A fetch that failed, said plainly.
 *
 * Never an empty table. "No rows matched" and "the backend could not be
 * reached" are different statements, and showing the second as the first is how
 * an outage gets read as a clean bill of health.
 */
export function LoadFailure({
  what,
  message,
}: {
  /** Named in the sentence, e.g. "utilization ledger". */
  what: string
  message?: string | null
}) {
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
      <p className="text-sm text-foreground">The {what} could not be loaded.</p>
      {message && <p className="mt-1 text-xs text-muted-foreground">{message}</p>}
      <p className="mt-2 text-xs text-muted-foreground">
        This screen has no demo fallback on purpose. Invented rows would be worse
        than no rows — the point of it is that it shows what was actually
        recorded.
      </p>
    </div>
  )
}

/**
 * The capability genuinely is not there — a 404, not a failure.
 *
 * A W6.3-only deployment has no W6.5 reclassification and no W6.6 ACT queue.
 * That is a deployment fact with nothing to retry, and rendering it as an error
 * teaches people to ignore the real ones.
 */
export function SectionUnavailable({ message }: { message?: string }) {
  return <EmptyState title="Not available yet." description={message} />
}

/**
 * How many rows this screen shows, said out loud.
 *
 * The I13 list routes report the unpaged population in `X-Total-Count`, so a
 * capped list says "the first 1,000 of 42,649". Without a total (a route that
 * does not send one) a full response only means "there may be more", and the
 * wording says exactly that.
 *
 * This exists because the ledger route has always defaulted `limit` to 100, the
 * client never sent one, and the screen had been showing at most a hundred rows
 * while saying nothing at all.
 */
export function RowCapNote({
  atLimit,
  count,
  total = null,
  noun,
}: {
  atLimit: boolean
  count: number
  /** The whole filtered population, when the backend reported it. */
  total?: number | null
  /** Singular; pluralised with a bare "s". */
  noun: string
}) {
  if (!atLimit) {
    return (
      <p className="text-[11px] text-muted-foreground">
        {formatCount(count)} {noun}
        {count === 1 ? "" : "s"} matched the current filters.
      </p>
    )
  }
  if (total !== null) {
    return (
      <p className="text-[11px] text-warning">
        Showing the first {formatCount(count)} of {formatCount(total)} {noun}s
        that match. Narrow the filters to see the rest.
      </p>
    )
  }
  return (
    <p className="text-[11px] text-warning">
      Showing the first {formatCount(count)} {noun}s. The response came back
      full, so there are likely more — narrow the filters to see them.
    </p>
  )
}

/**
 * When these figures were computed.
 *
 * The OAR screens are served from the backend's I13 snapshot, built once from
 * the SAP extract and rebuilt automatically when the extract is reloaded (and
 * each new day). A plan captured through the assistant updates its own
 * material's row straight away. Saying when the figures date from still
 * matters: they are as of the last SAP load, not live SAP.
 */
export function CalculatedAtNote({ calculatedAt }: { calculatedAt: string | null }) {
  if (!calculatedAt) {
    return (
      <span className="text-[11px] text-muted-foreground">
        Last computed: not recorded
      </span>
    )
  }
  return (
    <span className="text-[11px] text-muted-foreground">
      Figures computed {new Date(calculatedAt).toLocaleString()} from the latest
      SAP extract — refreshed automatically when it is reloaded
    </span>
  )
}

/**
 * The standing caveat about acquired-vs-plan.
 *
 * The engine is real; most of its input is not. 742 consumption plans came from
 * a generator with invented `SESS-000001` references, and until somebody
 * captures one through the assistant every plan behind these numbers is
 * fabricated. The backend distinguishes them internally (`PlanSource.CAPTURED`
 * vs `REFERENCE_CSV`) but does not serve the field, so this cannot be marked per
 * row — see ask O-9. A standing note is the honest alternative to silence.
 */
export function PlanProvenanceNote({ capturedCount }: { capturedCount: number | null }) {
  return (
    <AlertBanner tone="info" title="Most plans behind these figures are reference data">
      The acquired-versus-plan engine is real; most of its input is not. 742
      consumption plans came from a generator, with invented session references.
      {capturedCount !== null && (
        <>
          {" "}
          <strong>{formatCount(capturedCount)}</strong> plan
          {capturedCount === 1 ? " has" : "s have"} been captured through the
          assistant so far — those are the real ones, and they are listed on the
          captured-plans section below.
        </>
      )}
    </AlertBanner>
  )
}
