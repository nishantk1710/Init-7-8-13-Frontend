import type { ReactNode } from "react"
import { Inter } from "next/font/google"

import { cn } from "@/lib/utils"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" })

/**
 * The scrolling body of an OAR Utilization screen. `.oar-scope` (globals.css)
 * carries the page background, the Inter font and the indigo primary, and
 * re-points the shared tokens so the shadcn controls inside follow -- applied
 * per screen, so the summary report's print page and the rest of the app keep
 * theirs.
 */
export function OarScope({ children }: { children: ReactNode }) {
  return (
    <div className={cn(inter.variable, "oar-scope min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6")}>
      <div className="mx-auto flex max-w-7xl flex-col gap-5">{children}</div>
    </div>
  )
}

/** Title (30px/800), a one-line subtitle, and the screen's actions on the right. */
export function OarPageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        <h1 className="text-[30px] leading-tight font-extrabold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 max-w-3xl text-sm text-ink-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

/** A small rounded chip for "Data as of …" and similar facts about the data. */
export function InfoChip({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-card px-3.5 text-sm font-medium text-ink-muted">
      {icon}
      {children}
    </span>
  )
}

/** The view tabs and the filters on one row, wrapping to two on narrow screens. */
export function ToolbarRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-3 xl:flex-row xl:items-center">{children}</div>
}
