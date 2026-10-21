"use client"

import { AlertCircle, Eye, EyeOff, LockKeyhole, type LucideIcon } from "lucide-react"
import { useState, type ReactNode } from "react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

type AuthFieldProps = React.ComponentProps<typeof Input> & {
  id: string
  label: ReactNode
  icon: LucideIcon
  /** Shown at the right of the label row, e.g. "Optional". */
  hint?: ReactNode
  /** A control inside the input's right edge, e.g. a show-password button. */
  trailing?: ReactNode
}

/** A labelled input with a leading icon, sized for the sign-in pages. */
export function AuthField({ id, label, icon: Icon, hint, trailing, className, ...props }: AuthFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      <div className="relative">
        <Icon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input id={id} className={cn("h-10 pl-9", trailing ? "pr-10" : null, className)} {...props} />
        {trailing && <div className="absolute inset-y-0 right-1 flex items-center">{trailing}</div>}
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
          className="rounded-md p-2 text-muted-foreground transition-colors hover:text-foreground"
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      }
    />
  )
}

export function FormError({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      <div>{children}</div>
    </div>
  )
}
