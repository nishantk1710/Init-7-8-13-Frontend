"use client"

import Link from "next/link"
import { ArrowRight, Loader2, User } from "lucide-react"
import { useState } from "react"

import { AuthField, FormError, PasswordField } from "@/components/auth/auth-field"
import { Button } from "@/components/ui/button"
import { normaliseUsername, signIn, type AuthResult } from "@/lib/auth/mock-auth"

type Failure = Extract<AuthResult, { ok: false }>

export function LoginForm({ next }: { next: string }) {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [failure, setFailure] = useState<Failure | null>(null)
  const [pending, setPending] = useState(false)

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const result = signIn(username)
    if (!result.ok) {
      setFailure(result)
      return
    }
    setPending(true)
    // A full load, so src/proxy.ts sees the new session cookie.
    window.location.assign(next)
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <AuthField
        id="login-username"
        label="Username"
        icon={User}
        value={username}
        onChange={(e) => {
          setUsername(e.target.value)
          setFailure(null)
        }}
        autoComplete="username"
        autoCapitalize="none"
        autoFocus
        spellCheck={false}
        placeholder="Enter your username"
        aria-invalid={failure ? true : undefined}
        required
      />

      <PasswordField
        id="login-password"
        label="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="current-password"
        placeholder="Enter your password"
        required
      />

      {failure && (
        <FormError>
          {failure.error}{" "}
          {failure.reason === "unknown-user" && (
            <Link
              href={`/signup?username=${encodeURIComponent(normaliseUsername(username))}`}
              className="font-medium underline underline-offset-4"
            >
              Create an account
            </Link>
          )}
        </FormError>
      )}

      <Button type="submit" size="lg" disabled={pending} className="mt-1 h-10 w-full">
        {pending ? (
          <>
            <Loader2 className="animate-spin" /> Signing in…
          </>
        ) : (
          <>
            Sign in <ArrowRight />
          </>
        )}
      </Button>
    </form>
  )
}
