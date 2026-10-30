import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { connection } from "next/server"

import { AuthLink } from "@/components/auth/auth-field"
import { AuthShell } from "@/components/auth/auth-shell"
import { SignupForm } from "@/components/auth/signup-form"
import { normaliseUsername, safeNext } from "@/lib/auth/mock-auth"
import { serverAuthMode } from "@/lib/auth/mode"

export const metadata: Metadata = { title: "Create account — Spares AI" }

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[]; username?: string | string[] }>
}) {
  // With Microsoft sign-in, accounts are created in Entra ID, not here.
  await connection()
  if (serverAuthMode() === "entra") redirect("/login")
  const { next, username } = await searchParams
  const target = safeNext(typeof next === "string" ? next : undefined)

  return (
    <AuthShell
      title="Create your account"
      description="Set up your Spares AI account to get started."
      footer={
        <>
          Already have an account? <AuthLink href={`/login?next=${encodeURIComponent(target)}`}>Sign in</AuthLink>
        </>
      }
    >
      <SignupForm
        next={target}
        initialUsername={typeof username === "string" ? normaliseUsername(username) : ""}
      />
    </AuthShell>
  )
}
