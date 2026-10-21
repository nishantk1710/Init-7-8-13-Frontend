import { cn } from "@/lib/utils"

/**
 * The loader for a whole page: an hourglass, in the app's blue, that empties from top to bottom and then turns over to start
 * again. One colour -- everything is `currentColor`, and the colour is the theme's `primary` -- so it follows light and dark
 * mode.
 *
 * Use it where a page is opening (a refresh, a click in the sidebar, a page's first load). A card or chart that is waiting
 * for its own figure uses the smaller petal spinner (`LoadingSpinner`) instead.
 *
 * The motion is in globals.css (`page-loader-*`). It slows right down for anyone who has asked for reduced motion.
 * `label` is what a screen reader announces and is not drawn.
 */
export function PageLoader({ label, className }: { label: string; className?: string }) {
  return (
    <div role="status" aria-label={label} className={cn("flex flex-col items-center justify-center gap-3", className)}>
      <svg viewBox="0 0 64 64" aria-hidden="true" className="page-loader-glass size-16 shrink-0 text-primary">
        {/* The glass: a cap at each end and two bulbs meeting at the neck. */}
        <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 8 H48" />
          <path d="M16 56 H48" />
          <path d="M20 8 C20 22 30 28 32 32 C34 28 44 22 44 8" />
          <path d="M20 56 C20 42 30 36 32 32 C34 36 44 42 44 56" />
        </g>
        {/* The sand: the top empties, the bottom fills, and a thin stream falls between them while it runs. */}
        <path className="page-loader-top" fill="currentColor" d="M24 12 H40 C40 19 35 25 32 28 C29 25 24 19 24 12 Z" />
        <path className="page-loader-bottom" fill="currentColor" d="M32 37 C28 41 24 46 24 52 H40 C40 46 36 41 32 37 Z" />
        <path className="page-loader-stream" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" d="M32 30 V50" />
      </svg>
      <span className="sr-only">{label}</span>
    </div>
  )
}
