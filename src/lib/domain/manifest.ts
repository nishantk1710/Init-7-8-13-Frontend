import type { InitiativeId } from "@/lib/domain/contracts"
import type { IconKey } from "@/lib/types"

export interface ManifestNavItem {
  label: string
  icon: IconKey
  href: string
}

export interface ManifestNavSection {
  title: string
  items: ManifestNavItem[]
}

/**
 * Static, non-business shape every initiative exposes from its
 * `manifest.ts` — identity and sidebar nav items (fixed at scaffold time so
 * the sidebar never needs another edit). Business content (health/metrics/
 * actions) lives in that initiative's own `selectors/summary.ts`, imported
 * and re-exported alongside this. The Spares Assistant's suggested
 * questions are a single flat, module-agnostic list (`lib/constants.ts`'s
 * `SUGGESTED_QUESTIONS`) — never scoped per module.
 */
export interface InitiativeManifest {
  id: InitiativeId
  name: string
  description: string
  href: string
  navSection: ManifestNavSection
}
