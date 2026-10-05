import { FlaskConical } from "lucide-react"

/**
 * The line across every assistant screen while the demo switch is on.
 *
 * Invented data must never sit unlabelled where a real record would be. The
 * session log in particular exists to show what was actually recorded, so a
 * demo of it says so on every screen, not in a footnote.
 */
export function DemoStrip() {
  return (
    <div
      role="note"
      className="flex shrink-0 items-center gap-2 border-b border-warning/40 bg-warning/10 px-6 py-1.5 text-xs text-foreground"
    >
      <FlaskConical className="size-3.5 shrink-0 text-warning" aria-hidden />
      <span>
        <span className="font-medium">Demo:</span> scripted data. Nothing is recorded and
        nothing reaches SAP.
      </span>
    </div>
  )
}

/** Beside a demo session reference, so it is never quoted as a real one. */
export function DemoChip() {
  return (
    <span className="rounded border border-warning/50 bg-warning/10 px-1.5 py-0.5 font-sans text-[10px] font-semibold tracking-wide text-warning uppercase">
      Demo
    </span>
  )
}
