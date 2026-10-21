import type { Metadata } from "next"
import Link from "next/link"

import { AuthShell } from "@/components/auth/auth-shell"
import { LoginForm } from "@/components/auth/login-form"
import { safeNext } from "@/lib/auth/mock-auth"

export const metadata: Metadata = { title: "Sign in — Spares AI" }

/** Where src/proxy.ts sends anyone without a session, with `next` = where they were going. */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>
}) {
  const { next } = await searchParams
  const target = safeNext(typeof next === "string" ? next : undefined)

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
