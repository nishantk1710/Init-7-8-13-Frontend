import type { InitiativeId } from "@/lib/domain/contracts"

/**
 * One colour per area on Home -- the total bar, the legend, the card's top edge
 * and the dot on each priority row all use the same one. Existing theme
 * colours only.
 */
export const AREA_FILL: Record<InitiativeId, string> = {
  "initiative-7": "bg-primary-strong",
  "initiative-8": "bg-chart-3",
  "initiative-13": "bg-chart-2",
}

/**
 * The area card's accent, in the Overview KPI card's idiom: a 3px bar down the
 * left edge and a tinted chip behind the icon. Whole class names, because
 * Tailwind cannot see one assembled from pieces.
 */
export type AreaAccent = { bar: string; chip: string }

export const AREA_ACCENT: Record<InitiativeId, AreaAccent> = {
  "initiative-7": { bar: "before:bg-primary-strong", chip: "bg-primary-strong/10 text-primary-strong" },
  "initiative-8": { bar: "before:bg-chart-3", chip: "bg-chart-3/10 text-chart-3" },
  "initiative-13": { bar: "before:bg-chart-2", chip: "bg-chart-2/10 text-chart-2" },
}

/** Pending approvals: not an area of its own, a cut across the three. */
export const APPROVALS_FILL = "bg-muted-foreground"
export const APPROVALS_ACCENT: AreaAccent = {
  bar: "before:bg-muted-foreground",
  chip: "bg-muted text-muted-foreground",
}
