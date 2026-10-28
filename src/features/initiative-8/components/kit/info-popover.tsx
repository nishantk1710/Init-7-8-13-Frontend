"use client"

import type { ReactNode } from "react"
import { Popover } from "@base-ui/react/popover"
import { Info } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * The ⓘ beside a summary line or a heading, opening a short note.
 *
 * Where the explanations went (I08_Live_UI_Redesign_Plan.md, Q2): the
 * paragraphs that sat above the tables -- how each check works, what a filter
 * narrows, how a list is ranked -- are still one click away, and no longer
 * stand between a person and the first row.
 *
 * The popup is portalled out of the page, so it carries `i08-scope` itself.
 */
export function InfoPopover({
  title,
  children,
  align = "start",
  className,
}: {
  title: string
  children: ReactNode
  align?: "start" | "center" | "end"
  className?: string
}) {
  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label={`About: ${title}`}
        className={cn(
          "inline-grid size-6 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-i08-link focus-visible:ring-2 focus-visible:ring-ring/50 data-[popup-open]:bg-muted data-[popup-open]:text-i08-link",
          className,
        )}
      >
        <Info className="size-4" aria-hidden="true" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={6} align={align} className="isolate z-50 outline-none">
          <Popover.Popup className="i08-scope w-[min(380px,calc(100vw-2rem))] origin-(--transform-origin) rounded-xl border border-border bg-popover p-4 text-[13.5px] leading-relaxed text-muted-foreground shadow-lg outline-none duration-150 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
            <Popover.Title className="mb-1.5 text-sm font-semibold text-foreground">{title}</Popover.Title>
            <div className="space-y-2">{children}</div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}

/**
 * A button that opens a small panel: "More filters" and "Columns".
 *
 * `badge` is how many of the panel's own settings are on, so a filter tucked
 * behind the button is never invisible.
 */
export function PopoverButton({
  label,
  icon,
  badge,
  align = "start",
  children,
}: {
  label: string
  icon?: ReactNode
  badge?: number
  align?: "start" | "center" | "end"
  children: ReactNode
}) {
  return (
    <Popover.Root>
      <Popover.Trigger className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground shadow-xs transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 data-[popup-open]:bg-muted [&_svg]:size-4">
        {icon}
        {label}
        {badge ? (
          <span className="inline-grid min-w-5 place-items-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground tabular-nums">
            {badge}
          </span>
        ) : null}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={6} align={align} className="isolate z-50 outline-none">
          <Popover.Popup className="i08-scope w-[min(300px,calc(100vw-2rem))] origin-(--transform-origin) rounded-xl border border-border bg-popover p-3.5 text-sm text-foreground shadow-lg outline-none duration-150 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
            <Popover.Title className="sr-only">{label}</Popover.Title>
            {children}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
