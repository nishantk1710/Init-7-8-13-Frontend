"use client"

import { useState } from "react"
import { Check, Copy, FlaskConical } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import type { ApiReasonCategory } from "@/lib/api/assistant-requests"
import { ASSISTANT_DEMO } from "@/lib/assistant/demo/flag"
import type { Justification } from "@/lib/assistant/request/lines"
import { RequiredMark } from "@/components/assistant/step-form"
import { cn } from "@/lib/utils"

/**
 * Small pieces shared by the multi-material request screens.
 * Presentation only.
 */

/** The native select the step form uses, at the same size as `Input`. */
export const SELECT_CLASS = cn(
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2 text-sm transition-colors outline-none",
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
  "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
  "aria-invalid:border-destructive dark:bg-input/30"
)

/** Shown only in the offline demo -- live screens carry no banner. */
export function DemoBanner({ children }: { children?: React.ReactNode }) {
  if (!ASSISTANT_DEMO) return null
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-warning/40 bg-warning/10 px-4 py-2.5 text-xs text-foreground">
      <FlaskConical className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
      <span>
        <span className="font-semibold">Preview on mock data.</span>{" "}
        {children ??
          "Materials, stock and suggestions are invented to show every case. Nothing is sent to the backend or SAP; requests are kept in this browser only."}
      </span>
    </div>
  )
}

export type ChipTone = "ready" | "todo" | "muted" | "warn" | "bad"

const TONE: Record<ChipTone, string> = {
  ready: "border-success/30 bg-success/10 text-success",
  todo: "border-warning/40 bg-warning/15 text-warning",
  muted: "border-border bg-muted text-muted-foreground",
  warn: "border-warning/40 bg-warning/15 text-warning",
  bad: "border-destructive/30 bg-destructive/10 text-destructive",
}

export function Chip({
  tone,
  children,
  className,
  title,
}: {
  tone: ChipTone
  children: React.ReactNode
  className?: string
  title?: string
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        TONE[tone],
        className
      )}
    >
      {children}
    </span>
  )
}

/** Reason + free text, as the single-material chat asks for them. */
export function JustificationFields({
  idPrefix,
  prompt,
  value,
  onChange,
  showErrors,
  reasons,
}: {
  idPrefix: string
  prompt: string
  value: Justification
  onChange: (next: Justification) => void
  showErrors: boolean
  /** What submit accepts -- from the preview, never a list of our own. */
  reasons: readonly ApiReasonCategory[]
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3">
      <span className="text-xs font-medium text-foreground">{prompt}</span>
      <div className="grid gap-2 sm:grid-cols-[14rem_1fr]">
        <label htmlFor={`${idPrefix}-reason`} className="text-[11px] font-medium text-muted-foreground">
          Reason <RequiredMark />
        </label>
        <label htmlFor={`${idPrefix}-text`} className="hidden text-[11px] font-medium text-muted-foreground sm:block">
          In your own words <RequiredMark />
        </label>
        <select
          id={`${idPrefix}-reason`}
          aria-label="Reason"
          aria-required
          className={SELECT_CLASS}
          value={value.reasonCategory}
          aria-invalid={showErrors && !value.reasonCategory}
          onChange={(e) => onChange({ ...value, reasonCategory: e.target.value })}
        >
          <option value="">Choose a reason…</option>
          {reasons.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <label htmlFor={`${idPrefix}-text`} className="text-[11px] font-medium text-muted-foreground sm:hidden">
          In your own words <RequiredMark />
        </label>
        <Textarea
          id={`${idPrefix}-text`}
          aria-label="In your own words"
          aria-required
          rows={1}
          placeholder="In your own words -- the part a reviewer actually reads"
          value={value.freeText}
          aria-invalid={showErrors && !value.freeText.trim()}
          onChange={(e) => onChange({ ...value, freeText: e.target.value })}
          className="min-h-8 text-sm"
        />
      </div>
    </div>
  )
}

/**
 * One line's department: a code from the plant's list
 * (`GET /assistant/departments?plant=`, the plant's own codes).
 *
 * A native select rather than a searchable popover: it sits inside a table,
 * which would clip one.
 *
 * While the backend's list has not loaded, a 5-digit code can be typed
 * instead -- the backend then accepts any code of that shape, as the opener does.
 */
export function DepartmentSelect({
  codes,
  value,
  onChange,
  label,
  invalid,
  disabled,
}: {
  codes: readonly string[]
  value: string
  onChange: (code: string) => void
  label: string
  invalid: boolean
  disabled?: boolean
}) {
  if (codes.length === 0) {
    return (
      <input
        aria-label={label}
        inputMode="numeric"
        maxLength={5}
        placeholder="5 digits"
        className={cn(SELECT_CLASS, "w-28 font-mono")}
        value={value}
        disabled={disabled}
        aria-invalid={invalid}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 5))}
      />
    )
  }
  return (
    <select
      aria-label={label}
      className={cn(SELECT_CLASS, "w-28 font-mono")}
      value={value}
      disabled={disabled}
      aria-invalid={invalid}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Choose…</option>
      {codes.map((code) => (
        <option key={code} value={code}>
          {code}
        </option>
      ))}
    </select>
  )
}

/** A category as the conversation labels it: URGENT_BREAKDOWN -> Urgent Breakdown. */
export function reasonLabel(value: string): string {
  return value
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ")
}

/** A reference with a copy button, for `R…` and `R…/n`. */
export function CopyReference({
  value,
  size = "md",
  hint = "Type it into the reservation item's text (SGTXT) in SAP.",
}: {
  value: string
  size?: "md" | "lg"
  hint?: string
}) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      toast.success(`${value} copied`, { description: hint })
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      toast.error("Could not copy", { description: "Select the reference and copy it by hand." })
    }
  }

  return (
    <span className="inline-flex items-center gap-1">
      <span
        className={cn(
          "font-mono font-semibold tracking-wider text-foreground select-all",
          size === "lg" && "ai-gradient-text text-xl font-bold tracking-[0.18em]"
        )}
      >
        {value}
      </span>
      <Button
        type="button"
        variant="ghost"
        size={size === "lg" ? "icon-sm" : "icon-xs"}
        onClick={copy}
        aria-label={`Copy ${value}`}
      >
        {copied ? <Check className="text-success" /> : <Copy />}
      </Button>
    </span>
  )
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—"
  const [y, m, d] = iso.split("-").map(Number)
  if (!y || !m || !d) return iso
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}
