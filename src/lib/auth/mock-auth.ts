// Mock sign-in for UAT, until Entra ID sign-in lands.
//
// NOT AUTHENTICATION. Any password is accepted, and the "session" is a plain
// cookie holding a username that anyone can edit. It decides who the app greets
// and nothing else: no roles, no views, and it is deliberately not connected to
// lib/api/actor.ts, so nothing written to the backend's append-only tables is
// stamped with a name nobody proved.
//
//   accounts  the UAT participants below, plus anyone who signs up in this
//             browser (localStorage -- a sign-up exists only where it was made)
//   session   the SESSION_COOKIE cookie, read by src/proxy.ts on every request
//             to send a visitor without one to /login
//
// Kept free of imports and of browser globals at module level: src/proxy.ts
// imports it too.

export const SESSION_COOKIE = "spares-user"

/** Pages a visitor can open without signing in. */
export const PUBLIC_PATHS = ["/login", "/signup"] as const

export const DEFAULT_LANDING = "/home"

/** "entra": the user signed in with Microsoft (hooks/use-current-user.ts), not here. */
export type AccountSource = "uat" | "signup" | "entra"

export interface MockUser {
  username: string
  name: string
  email: string
  source: AccountSource
  /** ISO timestamps; absent until they happen in this browser. */
  createdAt?: string
  lastSignInAt?: string
}

/**
 * The named UAT participants (Technical Walkthrough v4.0, section 4.1). No
 * application role is attached: for now everyone is just a user.
 */
export const UAT_USERS: readonly MockUser[] = [
  { username: "chardon.links", name: "Chardon Links", email: "", source: "uat" },
  { username: "simone", name: "Simone", email: "", source: "uat" },
  { username: "lynn.boyce", name: "Lynn Boyce", email: "", source: "uat" },
  { username: "alistair", name: "Alistair", email: "", source: "uat" },
  { username: "paul.damons", name: "Paul Damons", email: "", source: "uat" },
  { username: "jacobus.matthys", name: "Jacobus Matthys", email: "", source: "uat" },
]

/** Self-registered accounts, and edits to anyone's profile, in this browser. */
const ACCOUNTS_STORAGE_KEY = "spares.accounts"

/** Fired on window whenever the session or an account changes in this tab. */
const AUTH_CHANGE_EVENT = "spares-auth-change"

const THIRTY_DAYS = 60 * 60 * 24 * 30

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

/**
 * Where to go after signing in. Only a path on this site: `next` comes from the
 * query string, and an absolute or protocol-relative URL there would make the
 * login page an open redirect.
 */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return DEFAULT_LANDING
  }
  if (isPublicPath(next.split("?")[0])) return DEFAULT_LANDING
  return next
}

export function normaliseUsername(value: string): string {
  return value.trim().toLowerCase()
}

/** "Lynn Boyce" -> "lynn.boyce": the suggestion the sign-up form offers. */
export function usernameFromName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
}

/** Letters, digits, dot, dash and underscore; it travels in a cookie. */
export function isValidUsername(username: string): boolean {
  return /^[a-z0-9._-]{2,40}$/.test(username)
}

// ---------------------------------------------------------------- browser only

function readStoredAccounts(): Record<string, MockUser> {
  try {
    const raw = window.localStorage.getItem(ACCOUNTS_STORAGE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === "object" ? (parsed as Record<string, MockUser>) : {}
  } catch {
    return {}
  }
}

function writeStoredAccounts(accounts: Record<string, MockUser>): void {
  try {
    window.localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts))
  } catch {
    // Storage blocked: the UAT accounts still work, sign-ups do not persist.
  }
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT))
}

/** Every account this browser knows: the UAT list, then sign-ups. */
export function listUsers(): MockUser[] {
  const stored = readStoredAccounts()
  const uat = UAT_USERS.map((u) => ({ ...u, ...stored[u.username], source: "uat" as const }))
  const signups = Object.values(stored).filter(
    (u) => u.source === "signup" && !UAT_USERS.some((x) => x.username === u.username)
  )
  return [...uat, ...signups]
}

export function findUser(username: string): MockUser | null {
  const key = normaliseUsername(username)
  return listUsers().find((u) => u.username === key) ?? null
}

function readSessionUsername(): string | null {
  for (const part of document.cookie.split(";")) {
    const [name, ...value] = part.trim().split("=")
    if (name === SESSION_COOKIE) {
      const username = decodeURIComponent(value.join("="))
      return username || null
    }
  }
  return null
}

/** The signed-in user, or null. A cookie naming an unknown account counts as signed in as that bare username. */
export function currentUser(): MockUser | null {
  const username = readSessionUsername()
  if (!username) return null
  return findUser(username) ?? { username, name: username, email: "", source: "signup" }
}

export type AuthResult =
  | { ok: true; user: MockUser }
  | { ok: false; reason: "unknown-user" | "taken" | "invalid"; error: string }

/** Any password is accepted; only the username has to exist. */
export function signIn(username: string): AuthResult {
  const user = findUser(username)
  if (!user) {
    return { ok: false, reason: "unknown-user", error: "We couldn't find an account with that username." }
  }

  const secure = window.location.protocol === "https:" ? "; secure" : ""
  document.cookie = `${SESSION_COOKIE}=${encodeURIComponent(user.username)}; path=/; max-age=${THIRTY_DAYS}; samesite=lax${secure}`

  const now = new Date().toISOString()
  const stored = readStoredAccounts()
  stored[user.username] = { ...user, createdAt: user.createdAt ?? now, lastSignInAt: now }
  writeStoredAccounts(stored)
  return { ok: true, user }
}

export function signUp(input: {
  name: string
  username: string
  email: string
}): AuthResult {
  const username = normaliseUsername(input.username)
  const name = input.name.trim()
  if (!name) return { ok: false, reason: "invalid", error: "Enter your name." }
  if (!isValidUsername(username)) {
    return {
      ok: false,
      reason: "invalid",
      error: "Use 2–40 letters, digits, dots, dashes or underscores for the username.",
    }
  }
  if (findUser(username)) {
    return { ok: false, reason: "taken", error: "That username is already taken." }
  }

  const stored = readStoredAccounts()
  stored[username] = {
    username,
    name,
    email: input.email.trim(),
    source: "signup",
    createdAt: new Date().toISOString(),
  }
  writeStoredAccounts(stored)
  return signIn(username)
}

export function updateProfile(username: string, changes: { name: string; email: string }): MockUser | null {
  const user = findUser(username)
  if (!user) return null
  const stored = readStoredAccounts()
  const updated = { ...user, name: changes.name.trim() || user.name, email: changes.email.trim() }
  stored[user.username] = updated
  writeStoredAccounts(stored)
  return updated
}

/** End the session and go back to the login page. */
export function signOut(): void {
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; samesite=lax`
  window.location.assign("/login")
}

/**
 * For useSyncExternalStore: a string that changes whenever the session or any
 * account does, so a component re-reads currentUser() exactly then.
 */
export function authSnapshot(): string {
  let accounts = ""
  try {
    accounts = window.localStorage.getItem(ACCOUNTS_STORAGE_KEY) ?? ""
  } catch {
    // Storage blocked.
  }
  return `${readSessionUsername() ?? ""}\u0000${accounts}`
}

export function subscribeAuth(onChange: () => void): () => void {
  window.addEventListener(AUTH_CHANGE_EVENT, onChange)
  window.addEventListener("storage", onChange)
  return () => {
    window.removeEventListener(AUTH_CHANGE_EVENT, onChange)
    window.removeEventListener("storage", onChange)
  }
}
