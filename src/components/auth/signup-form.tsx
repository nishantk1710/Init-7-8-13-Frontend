"use client"

import Link from "next/link"
import { ArrowRight, AtSign, Loader2, Mail, User } from "lucide-react"
import { useState } from "react"

import { AuthField, FormError, PasswordField } from "@/components/auth/auth-field"
import { Button } from "@/components/ui/button"
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
  const [pending, setPending] = useState(false)

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const result = signUp({ name, username, email })
    if (!result.ok) {
      setFailure(result)
      return
    }
    setPending(true)
    window.location.assign(next)
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
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
            <Link href="/login" className="font-medium underline underline-offset-4">
              Sign in instead
            </Link>
          )}
        </FormError>
      )}

      <Button type="submit" size="lg" disabled={pending} className="mt-1 h-10 w-full">
        {pending ? (
          <>
            <Loader2 className="animate-spin" /> Creating account…
          </>
        ) : (
          <>
            Create account <ArrowRight />
          </>
        )}
      </Button>
    </form>
  )
}
