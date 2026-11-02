"use client"

import Link from "next/link"
import { AtSign, Mail, User } from "lucide-react"
import { useState } from "react"

import { AuthDone, AuthField, AuthSubmit, FormError, PasswordField } from "@/components/auth/auth-field"
import { signUp, usernameFromName, type AuthResult } from "@/lib/auth/mock-auth"

type Failure = Extract<AuthResult, { ok: false }>

export function SignupForm({ next, initialUsername }: { next: string; initialUsername: string }) {
  const [name, setName] = useState("")
  const [username, setUsername] = useState(initialUsername)
  // Until the username is typed into, it follows the name: "Lynn Boyce" -> "lynn.boyce".
  const [usernameEdited, setUsernameEdited] = useState(initialUsername !== "")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [failure, setFailure] = useState<Failure | null>(null)
  const [done, setDone] = useState(false)

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const result = signUp({ name, username, email })
    if (!result.ok) {
      setFailure(result)
      return
    }
    setDone(true)
    window.location.assign(next)
  }

  if (done) return <AuthDone title="Account created">Loading your spares workspace…</AuthDone>

  return (
    <form onSubmit={submit} className="flex flex-col gap-[18px]">
      {/* Side by side, so the card still fits a laptop screen without scrolling. */}
      <div className="grid gap-[18px] sm:grid-cols-2 sm:gap-3">
        <AuthField
          id="signup-name"
          label="Full name"
          icon={User}
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            if (!usernameEdited) setUsername(usernameFromName(e.target.value))
            setFailure(null)
          }}
          autoComplete="name"
          autoFocus
          placeholder="Your full name"
          required
        />

        <AuthField
          id="signup-username"
          label="Username"
          icon={AtSign}
          value={username}
          onChange={(e) => {
            setUsername(e.target.value)
            setUsernameEdited(true)
            setFailure(null)
          }}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="e.g. first.last"
          aria-invalid={failure && failure.reason !== "invalid" ? true : undefined}
          required
        />
      </div>

      <AuthField
        id="signup-email"
        label="Email"
        hint="Optional"
        icon={Mail}
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
        placeholder="name@company.com"
      />

      <PasswordField
        id="signup-password"
        label="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="new-password"
        placeholder="Create a password"
        required
      />

      {failure && (
        <FormError>
          {failure.error}{" "}
          {failure.reason === "taken" && (
            <Link href={`/login?next=${encodeURIComponent(next)}`} className="font-semibold underline underline-offset-4">
              Sign in instead
            </Link>
          )}
        </FormError>
      )}

      <AuthSubmit pendingLabel="Creating account…">Create account</AuthSubmit>
    </form>
  )
}
