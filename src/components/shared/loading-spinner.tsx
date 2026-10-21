import { cn } from "@/lib/utils"

export type SpinnerTone = "primary" | "danger" | "success" | "warning"

// One colour only: the petals are all `currentColor`, and the theme colour is the text colour of the spinner. The class names
// are written out whole so the stylesheet generator can see them.
const COLOUR: Record<SpinnerTone, string> = {
  primary: "text-primary",
  danger: "text-destructive",
  success: "text-success",
  warning: "text-warning",
}

const SIZE = { sm: "size-8", md: "size-12" } as const

export type SpinnerSize = keyof typeof SIZE

const PETAL_COUNT = 12

/** One teardrop pointing at the centre: a rounded end at the rim narrowing toward the middle. Drawn at 12 o'clock. */
const PETAL = "M50 34 C46 30 44 22 44 16 A6 6 0 0 1 56 16 C56 22 54 30 50 34 Z"

/** The petals in one place so a test can read them: clockwise from 12 o'clock, each lighter than the one before it, from
 * fully dark down to a pale trace -- the single colour fading, not a second colour. */
export const PETALS = Array.from({ length: PETAL_COUNT }, (_, i) => ({
  angle: i * (360 / PETAL_COUNT),
  opacity: Number((1 - (i / PETAL_COUNT) * 0.88).toFixed(3)),
}))

/**
 * A petal spinner, centred in the space the content will fill: twelve teardrops in a ring, dark to light, turning in twelve
 * steps. Give it the height of that content (`className`) so the layout does not jump when the content arrives. `tone` picks
 * the one theme colour; `label` is what a screen reader announces and is not drawn. The turning is in globals.css
 * (`spinner-petals`) and slows right down for anyone who has asked for reduced motion.
 */
export function LoadingSpinner({
  label,
  className,
  tone = "primary",
  size = "md",
}: {
  label: string
  className?: string
  tone?: SpinnerTone
  /** `sm` for a small card, `md` (the default) for a card or a chart. A whole page uses `PageLoader`. */
  size?: SpinnerSize
}) {
  return (
    <div role="status" aria-label={label} className={cn("flex items-center justify-center", className)}>
      <svg
        viewBox="0 0 100 100"
        aria-hidden="true"
        className={cn("spinner-petals shrink-0", SIZE[size], COLOUR[tone])}
        fill="currentColor"
      >
        {PETALS.map((petal) => (
          <path key={petal.angle} d={PETAL} opacity={petal.opacity} transform={`rotate(${petal.angle} 50 50)`} />
        ))}
      </svg>
      <span className="sr-only">{label}</span>
    </div>
  )
}
