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

export const AREA_BORDER: Record<InitiativeId, string> = {
  "initiative-7": "border-t-primary-strong",
  "initiative-8": "border-t-chart-3",
  "initiative-13": "border-t-chart-2",
}

/** Pending approvals: not an area of its own, a cut across the three. */
export const APPROVALS_FILL = "bg-muted-foreground"
export const APPROVALS_BORDER = "border-t-muted-foreground"
