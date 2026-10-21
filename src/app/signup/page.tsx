import type { Metadata } from "next"
import Link from "next/link"

import { AuthShell } from "@/components/auth/auth-shell"
import { SignupForm } from "@/components/auth/signup-form"
import { normaliseUsername, safeNext } from "@/lib/auth/mock-auth"

export const metadata: Metadata = { title: "Create account — Spares AI" }

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[]; username?: string | string[] }>
}) {
  const { next, username } = await searchParams
  const target = safeNext(typeof next === "string" ? next : undefined)

  return (
    <AuthShell
      title="Create your account"
      description="Set up your Spares AI account to get started."
      footer={
        <>
          Already have an account?{" "}
          <Link
            href={`/login?next=${encodeURIComponent(target)}`}
            className="font-medium text-brand-link underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
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
