import type { ApiFlow } from "@/lib/api/assistant"

/**
 * The assistant's two conversations, by the module each belongs to. The
 * backend's flow codes (`i08`, `i13`) are identifiers, never shown.
 */
export const FLOW_LABEL: Record<ApiFlow, string> = {
  i08: "Repairable Spares",
  i13: "OAR Spares",
  none: "No assistant flow",
}

/** A flow code the label map does not know still reads as words, not a code. */
export function flowLabel(flow: string): string {
  return (FLOW_LABEL as Record<string, string>)[flow] ?? flow.replace(/_/g, " ")
}
