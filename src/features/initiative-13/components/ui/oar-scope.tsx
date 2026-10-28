import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/**
 * The scrolling body of an OAR Utilization screen. `.oar-scope` (globals.css)
 * carries the page background and the indigo primary, and
 * re-points the shared tokens so the shadcn controls inside follow -- applied
 * per screen, so the summary report's print page and the rest of the app keep
 * theirs.
 */
export function OarScope({ children }: { children: ReactNode }) {
  return (
    <div className={cn("oar-scope min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6")}>
      <div className="mx-auto flex max-w-7xl flex-col gap-5">{children}</div>
    </div>
  )
}

/** Title (24px, semibold -- the size the other modules use), then a line with the subtitle and, on the right, the screen's actions. */
export function OarPageHeader({
  title,
  subtitle,
  actions,
  notes,
  meta,
}: {
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
  /** Small print about the figures on the page, under the subtitle line. */
  notes?: ReactNode
  /** Top right, level with the title: when the figures date from, and the like. */
  meta?: ReactNode
}) {
  return (
    <header className="flex flex-col gap-2">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-1">
        <h1 className="text-2xl leading-tight font-semibold tracking-tight text-ink">{title}</h1>
        {meta && <div className="ml-auto max-w-full text-right">{meta}</div>}
      </div>
      {(subtitle || actions) && (
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {subtitle && <p className="min-w-0 text-sm text-ink-muted lg:flex-1">{subtitle}</p>}
          {/* One row from `sm` up; it only wraps on a phone, where there is no room. */}
          {actions && (
            <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap lg:ml-auto lg:shrink-0">{actions}</div>
          )}
        </div>
      )}
      {notes && <div className="flex flex-col gap-0.5 text-xs text-ink-muted">{notes}</div>}
    </header>
  )
}

/** A small rounded chip for "Data as of …" and similar facts about the data. */
export function InfoChip({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-action bg-action/10 px-3 text-[0.8rem] font-semibold whitespace-nowrap text-action shadow-sm">
      {icon}
      {children}
    </span>
  )
}

/** The view tabs on one row, the filters on the row under them. */
export function ToolbarRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-1">{children}</div>
}
