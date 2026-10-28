import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { connection } from "next/server"

import { auth } from "@/auth"
import { AuthShell } from "@/components/auth/auth-shell"
import { LoginForm } from "@/components/auth/login-form"
import { MicrosoftSignIn } from "@/components/auth/microsoft-sign-in"
import { entraSettings, missingEntraSettings } from "@/lib/auth/entra"
import { safeNext } from "@/lib/auth/mock-auth"
import { serverAuthMode } from "@/lib/auth/mode"

export const metadata: Metadata = { title: "Sign in — Spares AI" }

/** Where src/proxy.ts sends anyone without a session, with `next` = where they were going. */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[]; error?: string | string[] }>
}) {
  // Rendered per request: AUTH_MODE is a runtime setting.
  await connection()
  const { next, error } = await searchParams
  const target = safeNext(typeof next === "string" ? next : undefined)

  if (serverAuthMode() === "entra") {
    const missing = missingEntraSettings(entraSettings())
    const session = missing.length === 0 ? await auth() : null
    // Already signed in, with a session that still renews: go on.
    if (session && !session.error) redirect(target)
    return (
      <AuthShell title="Welcome back" description="Sign in to Spares AI with your VZI Microsoft account.">
        <MicrosoftSignIn
          next={target}
          error={session?.error ?? (typeof error === "string" ? error : undefined)}
          missingSettings={missing}
        />
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Welcome back"
      description="Sign in to Spares AI to continue."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link
            href={`/signup?next=${encodeURIComponent(target)}`}
            className="font-medium text-brand-link underline-offset-4 hover:underline"
          >
            Create an account
          </Link>
        </>
      }
    >
      <LoginForm next={target} />
    </AuthShell>
  )
}
