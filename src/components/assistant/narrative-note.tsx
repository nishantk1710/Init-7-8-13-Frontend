import { Sparkles } from "lucide-react"

import type { ApiNarrative } from "@/lib/api/assistant"

/**
 * The model's phrasing of advice the platform had already worked out.
 *
 * ## What this is allowed to be, and what it is not
 *
 * Every number the assistant states is a field the platform holds — repair
 * status, vendor, expected arrival, stock on hand, months of cover. There is
 * nothing to infer, so the model is never asked to produce a figure: it is
 * handed the finished answer and asked to write the sentence around it. A
 * fabricated number with a decimal point is indistinguishable from a real one
 * to the person about to spend money on it.
 *
 * So this renders **beside** the assessment card, never in place of it, and
 * deliberately looks secondary. If this block and the card ever disagreed, the
 * card is right.
 *
 * ## Why the model is named on screen
 *
 * A sentence a person acts on should say where it came from. The prompt id, its
 * version and the deployment are carried from the backend and shown, because
 * this programme is human-gated and audited and "the model said so" is not an
 * acceptable account of a recommendation. It is also the fastest way to tell a
 * stale prompt from a stale cache when somebody queries the wording.
 *
 * Renders nothing when no narrative was served — which is the default, since
 * the layer is off until VZI signs off on it.
 */
export function NarrativeNote({ narrative }: { narrative: ApiNarrative | null }) {
  if (!narrative?.text) return null

  return (
    <aside
      className="flex flex-col gap-1.5 rounded-xl border border-dashed border-border bg-muted/40 p-3"
      aria-label="AI-written summary"
    >
      <p className="flex items-center gap-1.5 text-[11px] tracking-[0.3px] text-muted-foreground uppercase">
        <Sparkles className="size-3" aria-hidden />
        In short
      </p>

      <p className="text-sm text-foreground">{narrative.text}</p>

      {/* Stated plainly rather than tucked into a tooltip. Somebody reading a
          sentence that will shape a purchase should be able to see, without
          hovering anything, that a model phrased it and which one. */}
      <p className="text-[11px] text-muted-foreground">
        Written by {narrative.model ?? "the configured model"}
        {narrative.promptId && (
          <>
            {" "}
            from prompt{" "}
            <span className="font-mono">
              {narrative.promptId}
              {narrative.promptVersion !== null && ` v${narrative.promptVersion}`}
            </span>
          </>
        )}
        . The figures above come from the platform, not from the model.
      </p>
    </aside>
  )
}
