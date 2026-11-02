import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { connection } from "next/server"
import { KeyRound, LifeBuoy, User, type LucideIcon } from "lucide-react"

import { AuthButtonLink } from "@/components/auth/auth-field"
import { AuthShell } from "@/components/auth/auth-shell"
import { safeNext } from "@/lib/auth/mock-auth"
import { serverAuthMode } from "@/lib/auth/mode"

export const metadata: Metadata = { title: "Forgot password — Spares AI" }

/** The test sign-in has no passwords to reset (lib/auth/mock-auth.ts), so this says how to get in instead. */
const HELP: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: KeyRound,
    title: "There is nothing to reset",
    text: "During UAT, Spares AI uses a test sign-in that does not check passwords. Enter your username and any password.",
  },
  {
    icon: User,
    title: "Your username",
    text: "Usually your first and last name with a dot between them, like lynn.boyce.",
  },
  {
    icon: LifeBuoy,
    title: "Still can't get in?",
    text: "Ask the Spares AI support team.",
  },
]

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>
}) {
  // With Microsoft sign-in the password is the Microsoft account's, and
  // Microsoft's own sign-in page deals with it.
  await connection()
  if (serverAuthMode() === "entra") redirect("/login")
  const { next } = await searchParams
  const target = safeNext(typeof next === "string" ? next : undefined)

  return (
    <AuthShell title="Forgot your password?" description="Here’s how to get back into Spares AI.">
      <div className="flex flex-col gap-[18px]">
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {HELP.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex items-start gap-3 rounded-xl border border-aurora-line bg-aurora-field p-3.5">
              <span className="grid size-9 flex-none place-items-center rounded-[10px] bg-aurora-blue/10 text-aurora-blue">
                <Icon aria-hidden className="size-[18px]" />
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <strong className="text-sm font-semibold text-aurora-ink">{title}</strong>
                <span className="text-[13px] leading-snug text-aurora-muted">{text}</span>
              </span>
            </li>
          ))}
        </ul>
        <AuthButtonLink href={`/login?next=${encodeURIComponent(target)}`}>Back to sign in</AuthButtonLink>
      </div>
    </AuthShell>
  )
}
