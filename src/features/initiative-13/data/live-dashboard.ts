/**
 * The Utilisation Dashboard's whole data layer — W6.7, FR-10.
 *
 * One server-side fetch for seven sections, where there used to be six client
 * hooks firing after hydration and re-firing on every debounced keystroke.
 *
 * ## Where `useI13OptionalQuery`'s semantics went
 *
 * They moved here, unchanged in meaning. That hook existed to tell two failures
 * apart:
 *
 *   - **404** — the backend genuinely does not offer this capability in this
 *     environment (a W6.3-only deployment has no W6.5/W6.6), which is not an
 *     error and has nothing to retry; and
 *   - **anything else** — a request that failed and should be retried.
 *
 * One missing downstream capability must not read as a broken dashboard. So
 * every optional section is settled independently with `Promise.allSettled` and
 * classified by the same rule, on the server.
 *
 * The dashboard's one **official** dependency is W6.3 (WATCH). If that fails,
 * the page says so; everything else degrades on its own.
 */

import { ApiError } from "@/lib/api/client"
import {
  getI13AllJustifications,
  type I13Summary,
  type ValidationResult,
} from "@/lib/api/i13"
import type { UnifiedJustification } from "@/lib/assistant/justifications"
import {
  loadLiveActExceptions,
  loadLivePlans,
  loadLiveReclassification,
  loadLiveSummary,
  loadLiveValidation,
  loadLiveWatch,
  type LiveActExceptions,
  type LivePlans,
  type LiveReclassification,
  type LiveWatch,
} from "@/features/initiative-13/data/live-loaders"

/** A section that is allowed to be missing without the page being broken. */
export type Section<T> =
  | { status: "ready"; data: T }
  | { status: "unavailable"; message: string }
  | { status: "error"; message: string }

const UNAVAILABLE =
  "This capability is not available from the current backend."

/**
 * Settle one optional section.
 *
 * A 404 is `unavailable`; everything else is `error`. Exactly the rule
 * `useI13OptionalQuery` applied in the browser — a missing capability offers
 * nothing to retry, and rendering it as a failure trains people to ignore real
 * ones.
 */
async function section<T>(promise: Promise<T>): Promise<Section<T>> {
  try {
    return { status: "ready", data: await promise }
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return { status: "unavailable", message: UNAVAILABLE }
    }
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to load data.",
    }
  }
}

export type DashboardFilters = {
  plant?: string
  material?: string
  agingBand?: string
  acquiredVsPlanStatus?: string
  zmm065ReferenceCount?: number
  gr30DayReferenceCount?: number
}

export type LiveDashboard = {
  /** The one official dependency. Null means the page cannot render its core. */
  watch: LiveWatch | null
  watchError: string | null
  summary: Section<I13Summary>
  reclassification: Section<LiveReclassification>
  exceptions: Section<LiveActExceptions>
  justifications: Section<UnifiedJustification[]>
  plans: Section<LivePlans>
  validation: Section<ValidationResult>
}

export async function loadLiveDashboard(
  filters: DashboardFilters = {}
): Promise<LiveDashboard> {
  const scope = { plant: filters.plant, material: filters.material }

  // All seven in flight together. Sequentially this would be seven round trips
  // deep on a screen whose whole job is to be glanced at.
  const [watchResult, summary, reclassification, exceptions, justifications, plans, validation] =
    await Promise.all([
      loadLiveWatch(filters).then(
        (data) => ({ ok: true as const, data }),
        (error: unknown) => ({
          ok: false as const,
          message: error instanceof Error ? error.message : String(error),
        })
      ),
      section(loadLiveSummary()),
      section(loadLiveReclassification(scope)),
      section(loadLiveActExceptions(scope)),
      section(getI13AllJustifications(scope)),
      section(loadLivePlans(scope)),
      section(
        loadLiveValidation({
          zmm065ReferenceCount: filters.zmm065ReferenceCount,
          gr30DayReferenceCount: filters.gr30DayReferenceCount,
        })
      ),
    ])

  return {
    watch: watchResult.ok ? watchResult.data : null,
    watchError: watchResult.ok ? null : watchResult.message,
    summary,
    reclassification,
    exceptions,
    justifications,
    plans,
    validation,
  }
}
