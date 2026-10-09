/**
 * The Utilisation Dashboard's Details tabs, in display order. `?tab=` opens
 * one directly.
 *
 * Exceptions were a tab here until the Exceptions screen became their one home;
 * the dashboard keeps only their status summary (FR-10's "exception status").
 * An old `?tab=exceptions` link, like any unknown value, opens the first tab.
 */
export const DETAIL_TABS = ["non-movers", "plan", "plans", "justifications"] as const

export type DetailTabId = (typeof DETAIL_TABS)[number]

export function resolveDetailTab(tab: string | undefined): DetailTabId {
  return DETAIL_TABS.find((t) => t === tab) ?? DETAIL_TABS[0]
}
