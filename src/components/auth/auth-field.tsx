"use client"

// The pieces the sign-in forms are built from, in the "Aurora" style
// (globals.css, .aurora-*). They sit on the auth card's white ground in both
// themes, so they use the fixed aurora colours rather than the theme tokens.

import Link from "next/link"
import { AlertCircle, ArrowRight, Check, Eye, EyeOff, LockKeyhole, type LucideIcon } from "lucide-react"
import { useState, type ReactNode } from "react"
import { useFormStatus } from "react-dom"

import { cn } from "@/lib/utils"

type AuthFieldProps = React.ComponentProps<"input"> & {
  id: string
  label: ReactNode
  icon: LucideIcon
  /** Shown at the right of the label row, e.g. "Optional" or a "Forgot password?" link. */
  hint?: ReactNode
  /** A control inside the input's right edge, e.g. a show-password button. */
  trailing?: ReactNode
}

/** A labelled input with a leading icon, sized for the sign-in pages. */
export function AuthField({ id, label, icon: Icon, hint, trailing, className, ...props }: AuthFieldProps) {
  const invalid = props["aria-invalid"] === true || props["aria-invalid"] === "true"
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-[13px] font-semibold text-aurora-ink">
          {label}
        </label>
        {hint && <span className="text-[13px] text-aurora-muted">{hint}</span>}
      </div>
      <div
        data-invalid={invalid || undefined}
        className={cn(
          "aurora-field flex h-12 items-center gap-2.5 rounded-xl border-[1.5px] border-aurora-line bg-aurora-field pl-3.5 text-aurora-faint",
          trailing ? "pr-1" : "pr-3.5"
        )}
      >
        <Icon aria-hidden className="size-[18px] shrink-0" />
        <input
          id={id}
          className={cn(
            "h-full min-w-0 flex-1 bg-transparent text-base text-aurora-ink outline-none placeholder:text-aurora-faint autofill:shadow-[inset_0_0_0_1000px_var(--color-aurora-field)]",
            className
          )}
          {...props}
        />
        {trailing}
      </div>
    </div>
  )
}

export function PasswordField(props: Omit<AuthFieldProps, "icon" | "type" | "trailing">) {
  const [visible, setVisible] = useState(false)
  return (
    <AuthField
      {...props}
      icon={LockKeyhole}
      type={visible ? "text" : "password"}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          className="grid size-10 shrink-0 place-items-center rounded-[10px] text-aurora-muted transition-colors hover:text-aurora-ink focus-visible:ring-2 focus-visible:ring-aurora-blue/40 focus-visible:outline-none"
        >
          {visible ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
        </button>
      }
    />
  )
}

export function AuthCheckbox({ label, className, ...props }: Omit<React.ComponentProps<"input">, "type"> & { label: ReactNode }) {
  return (
    <label className={cn("flex cursor-pointer items-center gap-2.5 self-start text-sm text-aurora-body", className)}>
      <input type="checkbox" className="size-[18px] cursor-pointer accent-aurora-blue" {...props} />
      {label}
    </label>
  )
}

const CTA_CLASSES =
  "aurora-cta flex h-[52px] w-full items-center justify-center gap-2.5 rounded-[14px] text-[15px] font-semibold text-white focus-visible:ring-4 focus-visible:ring-aurora-blue/30 focus-visible:outline-none disabled:cursor-progress"

/**
 * The card's main button. Busy while `pending` is true or, when `pending` is
 * not given, while the form's server action runs (useFormStatus).
 */
export function AuthSubmit({
  children,
  pendingLabel,
  pending,
  icon,
}: {
  children: ReactNode
  pendingLabel: string
  pending?: boolean
  /** Before the label, e.g. the Microsoft logo. */
  icon?: ReactNode
}) {
  const status = useFormStatus()
  const busy = pending ?? status.pending
  return (
    <button type="submit" disabled={busy} aria-busy={busy || undefined} className={CTA_CLASSES}>
      {busy ? (
        <>
          <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />
          {pendingLabel}
        </>
      ) : (
        <>
          {icon}
          {children}
          <ArrowRight aria-hidden className="size-4" strokeWidth={2.2} />
        </>
      )}
    </button>
  )
}

/** A link that looks like the card's main button, e.g. "Back to sign in". */
export function AuthButtonLink({ children, className, ...props }: React.ComponentProps<typeof Link>) {
  return (
    <Link className={cn(CTA_CLASSES, className)} {...props}>
      {children}
      <ArrowRight aria-hidden className="size-4" strokeWidth={2.2} />
    </Link>
  )
}

export function AuthLink({ className, ...props }: React.ComponentProps<typeof Link>) {
  return (
    <Link
      className={cn(
        "font-semibold text-aurora-blue no-underline transition-colors hover:text-aurora-blue-hover focus-visible:underline focus-visible:outline-none",
        className
      )}
      {...props}
    />
  )
}

/** What replaces the form once it has done its job, e.g. "You're in". */
export function AuthDone({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div data-auth-done role="status" className="aurora-pop flex flex-col items-center gap-3 pt-7 pb-3 text-center">
      <span className="grid size-16 place-items-center rounded-full bg-aurora-success-tint text-aurora-success">
        <Check aria-hidden className="size-[30px]" strokeWidth={2.5} />
      </span>
      <strong className="text-lg font-semibold text-aurora-ink">{title}</strong>
      <span className="text-sm text-aurora-muted">{children}</span>
    </div>
  )
}

export function FormError({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-xl border border-aurora-error-line bg-aurora-error-tint px-3.5 py-3 text-sm text-aurora-error"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      <div>{children}</div>
    </div>
  )
}
