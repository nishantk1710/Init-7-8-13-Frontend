"use client"

import type { CSSProperties, ReactNode } from "react"
import { Info } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

/** The accent a popup is drawn in. The same four tones the KPI cards use, so a popup matches its card. */
export type InfoTone = "info" | "success" | "warning" | "danger"

// Written out in full so Tailwind can see every class.
export const INFO_TONE: Record<
  InfoTone,
  { band: string; heading: string; callout: string; tick: string; icon: string }
> = {
  info: {
    band: "border-primary/60 bg-primary/10",
    heading: "text-primary",
    callout: "border-primary bg-primary/10",
    tick: "bg-primary",
    icon: "hover:bg-primary/15 hover:text-primary",
  },
  success: {
    band: "border-success/60 bg-success/10",
    heading: "text-success",
    callout: "border-success bg-success/10",
    tick: "bg-success",
    icon: "hover:bg-success/15 hover:text-success",
  },
  warning: {
    band: "border-warning/60 bg-warning/10",
    heading: "text-warning",
    callout: "border-warning bg-warning/10",
    tick: "bg-warning",
    icon: "hover:bg-warning/15 hover:text-warning",
  },
  danger: {
    band: "border-destructive/60 bg-destructive/10",
    heading: "text-destructive",
    callout: "border-destructive bg-destructive/10",
    tick: "bg-destructive",
    icon: "hover:bg-destructive/15 hover:text-destructive",
  },
}

/** Fade-and-rise entrance, staggered by `delayMs`. Skipped for people who ask for less motion. */
export function riseIn(delayMs = 0): { className: string; style: CSSProperties } {
  return {
    className:
      "animate-in fade-in slide-in-from-bottom-2 duration-300 [animation-fill-mode:backwards] motion-reduce:animate-none",
    style: { animationDelay: `${delayMs}ms` },
  }
}

/** Slide-in from the left, for the lines of a formula as they are written out. */
export function slideIn(delayMs = 0): { className: string; style: CSSProperties } {
  return {
    className:
      "animate-in fade-in slide-in-from-left-3 duration-300 [animation-fill-mode:backwards] motion-reduce:animate-none",
    style: { animationDelay: `${delayMs}ms` },
  }
}

/**
 * A small (i) icon that opens an explanation in a popup. The page behind stays visible through the
 * dialog's translucent overlay; Escape, the X, or a click outside closes it.
 *
 * Business-agnostic: the caller supplies the title, a one-line description, an accent tone and the body.
 */
export function InfoPopup({
  title,
  description,
  tone = "info",
  children,
  className,
}: {
  title: string
  description?: string
  tone?: InfoTone
  children: ReactNode
  className?: string
}) {
  const colours = INFO_TONE[tone]
  return (
    <Dialog>
      <DialogTrigger
        aria-label={`How "${title}" is calculated`}
        title="How is this calculated?"
        className={cn(
          "inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground outline-none transition-all duration-200 hover:scale-110 group-hover/card:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
          colours.icon,
          className
        )}
      >
        <Info className="size-3.5" aria-hidden />
      </DialogTrigger>
      <DialogContent className="max-h-[88vh] gap-0 overflow-hidden rounded-md p-0 duration-200 sm:max-w-3xl">
        <DialogHeader className={cn("gap-1 border-b-2 px-5 py-3 pr-12", colours.band)}>
          <DialogTitle className="text-base">{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="max-h-[calc(88vh-5rem)] overflow-y-auto p-5">{children}</div>
      </DialogContent>
    </Dialog>
  )
}
