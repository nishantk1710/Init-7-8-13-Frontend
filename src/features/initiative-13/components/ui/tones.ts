import type { DisplayTone } from "@/features/initiative-13/utils/oar-display"

/** Tinted surface + ink: a pill, a sub-card, a legend chip. */
export const TONE_TINT: Record<DisplayTone, string> = {
  healthy: "bg-healthy-tint text-healthy-ink",
  caution: "bg-caution-tint text-caution-ink",
  urgent: "bg-urgent-tint text-urgent-ink",
  primary: "bg-primary-tint text-primary-ink",
  neutral: "bg-muted text-ink-muted",
}

/** A solid fill: bar segments, dots. */
export const TONE_FILL: Record<DisplayTone, string> = {
  healthy: "bg-healthy",
  caution: "bg-caution",
  urgent: "bg-urgent",
  primary: "bg-primary-strong",
  neutral: "bg-ink-muted/50",
}

/** The accent edge of a KPI or step card. */
export const TONE_BORDER: Record<DisplayTone, string> = {
  healthy: "border-healthy",
  caution: "border-caution",
  urgent: "border-urgent",
  primary: "border-primary-strong",
  neutral: "border-ink-muted/50",
}

/** Text in the tone's ink, on a white card. */
export const TONE_INK: Record<DisplayTone, string> = {
  healthy: "text-healthy-ink",
  caution: "text-caution-ink",
  urgent: "text-urgent-ink",
  primary: "text-primary-ink",
  neutral: "text-ink-muted",
}
