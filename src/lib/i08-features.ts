/**
 * The I08 complete-flow switch (29-Oct-2026).
 *
 * The complete flow -- repair PRs, stock by condition, declaring the faulty
 * unit from the assistant, R-reference links, the new exception checks, the
 * notification log -- is merged but not yet approved. One backend setting
 * (`I8_COMPLETE_FLOW_ENABLED`, off by default) decides whether it is served,
 * and these helpers are the frontend's one reading of it.
 *
 * Read on the server, where each page already fetches, and handed down as a
 * plain boolean prop, so a page never draws the new UI and then takes it away.
 *
 * - Repairable Spares pages read it from the snapshot's `rules`
 *   (`completeFlowEnabled`).
 * - Assistant pages read `GET /api/i8/features`, which never waits for the
 *   snapshot.
 *
 * Anything but a clear "on" is off: an absent field (an older backend), a 404
 * (no route yet) or any failed request. Showing an unapproved feature by
 * accident is the failure this switch exists to prevent; hiding an approved
 * one for one page load is not.
 *
 * Only new features are switched. The readability and bug fixes that shipped
 * with them stay on either way.
 */

import { getI8Features, getSnapshot, type ApiI8Features, type ApiSnapshotRules } from "@/lib/api/i8"

/**
 * Is a switch on? The backend's rules map is typed as strings and integers,
 * so a Python `True` may arrive as `true`, `1` or `"True"`. Anything else --
 * absent included -- is off.
 */
export function switchIsOn(value: unknown): boolean {
  if (typeof value === "boolean") return value
  if (typeof value === "number") return value !== 0
  if (typeof value === "string") return ["true", "1", "yes", "on"].includes(value.trim().toLowerCase())
  return false
}

/** The switch, from `GET /api/i8/snapshot`'s `rules`. Off when absent. */
export function completeFlowFromRules(
  rules: Pick<ApiSnapshotRules, "completeFlowEnabled"> | null | undefined,
): boolean {
  return switchIsOn(rules?.completeFlowEnabled)
}

/** The switch, from `GET /api/i8/features`. Off when absent. */
export function completeFlowFromFeatures(body: ApiI8Features | null | undefined): boolean {
  return switchIsOn(body?.completeFlowEnabled)
}

/** For a Repairable Spares page with no snapshot fetch of its own. Never throws. */
export async function loadCompleteFlowFromSnapshot(
  fetchSnapshot: () => Promise<{ rules?: Pick<ApiSnapshotRules, "completeFlowEnabled"> | null }> = getSnapshot,
): Promise<boolean> {
  try {
    return completeFlowFromRules((await fetchSnapshot()).rules)
  } catch {
    return false
  }
}

/** For an assistant page. A 404 or any other failure is off. Never throws. */
export async function loadCompleteFlowFromFeatures(
  fetchFeatures: () => Promise<ApiI8Features | null | undefined> = getI8Features,
): Promise<boolean> {
  try {
    return completeFlowFromFeatures(await fetchFeatures())
  } catch {
    return false
  }
}
