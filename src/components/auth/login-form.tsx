"use client"

import Link from "next/link"
import { User } from "lucide-react"
import { useState } from "react"

import {
  AuthCheckbox,
  AuthDone,
  AuthField,
  AuthLink,
  AuthSubmit,
  FormError,
  PasswordField,
} from "@/components/auth/auth-field"
import { normaliseUsername, signIn, type AuthResult } from "@/lib/auth/mock-auth"

type Failure = Extract<AuthResult, { ok: false }>

export function LoginForm({ next }: { next: string }) {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  // Checked by default: the thirty-day session the test sign-in always had.
  const [remember, setRemember] = useState(true)
  const [failure, setFailure] = useState<Failure | null>(null)
  const [done, setDone] = useState(false)

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const result = signIn(username, { remember })
    if (!result.ok) {
      setFailure(result)
      return
    }
    setDone(true)
    // A full load, so src/proxy.ts sees the new session cookie. The
    // confirmation shows while it happens.
    window.location.assign(next)
  }

  if (done) return <AuthDone title="You’re in">Loading your spares workspace…</AuthDone>

  return (
    <form onSubmit={submit} className="flex flex-col gap-[18px]">
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
        hint={
          <AuthLink href={`/forgot-password?next=${encodeURIComponent(next)}`} className="font-medium">
            Forgot password?
          </AuthLink>
        }
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="current-password"
        placeholder="Enter your password"
        required
      />

      <AuthCheckbox label="Keep me signed in" checked={remember} onChange={(e) => setRemember(e.target.checked)} />

      {failure && (
        <FormError>
          {failure.error}{" "}
          {failure.reason === "unknown-user" && (
            <Link
              href={`/signup?username=${encodeURIComponent(normaliseUsername(username))}&next=${encodeURIComponent(next)}`}
              className="font-semibold underline underline-offset-4"
            >
              Create an account
            </Link>
          )}
        </FormError>
      )}

      <AuthSubmit pendingLabel="Signing in…">Sign in</AuthSubmit>
    </form>
  )
}
