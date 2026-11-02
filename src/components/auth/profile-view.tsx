"use client"

import { AtSign, CalendarDays, Clock, LogOut, Mail, ShieldCheck, User, UserRound } from "lucide-react"
import { useState, type ReactNode } from "react"

import { PageHeader } from "@/components/shared/page-header"
import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { useCurrentUser } from "@/hooks/use-current-user"
import { useRoles } from "@/hooks/use-roles"
import { roleLabel } from "@/lib/auth/roles"
import { updateProfile, type MockUser } from "@/lib/auth/mock-auth"
import { signOutEverywhere } from "@/lib/auth/sign-out"

function formatWhen(iso: string | undefined): string {
  if (!iso) return "—"
  const date = new Date(iso)
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
}

/** /profile, in both app trees. */
export function ProfileView() {
  const user = useCurrentUser()

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
        <PageHeader
          title="My profile"
          description="Your account details and how you appear in Spares AI."
          actions={
            <Button variant="outline" onClick={() => void signOutEverywhere()}>
              <LogOut /> Sign out
            </Button>
          }
        />
        {user ? (
          <ProfileContent key={user.username} user={user} />
        ) : (
          <>
            <Skeleton className="h-44 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </>
        )}
      </div>
    </div>
  )
}

function DetailRow({ icon: Icon, label, children }: { icon: typeof User; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-3">
      <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="truncate text-sm font-medium text-foreground">{children}</dd>
      </div>
    </div>
  )
}

/** The user's roles from GET /api/me, or what explains their absence. */
function RoleList() {
  const { roles, loading, failed, authEnabled } = useRoles()
  if (loading) return <>…</>
  if (failed) return <>Could not be read</>
  if (!authEnabled) return <>Not assigned (test sign-in)</>
  if (roles.length === 0) return <>None — ask VZI IT to assign you a role</>
  return <span className="whitespace-normal">{roles.map(roleLabel).join(", ")}</span>
}

function ProfileContent({ user }: { user: MockUser }) {
  const { roles } = useRoles()
  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email)
  const [saved, setSaved] = useState(false)
  const dirty = name.trim() !== user.name || email.trim() !== user.email
  // Signed in with Microsoft: name and e-mail are the account's, not editable here.
  const fromMicrosoft = user.source === "entra"

  function save(event: React.FormEvent) {
    event.preventDefault()
    if (updateProfile(user.username, { name, email })) setSaved(true)
  }

  return (
    <>
      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <div className="relative h-28 bg-linear-to-r from-indigo-600 via-indigo-500 to-sky-500">
          <div
            aria-hidden
            className="absolute inset-0 opacity-60"
            style={{
              backgroundImage: "radial-gradient(rgba(255,255,255,0.18) 1px, transparent 1px)",
              backgroundSize: "18px 18px",
            }}
          />
        </div>
        <div className="flex flex-col gap-4 px-6 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-end gap-4">
            <Avatar name={user.name} className="relative -mt-10 size-20 text-xl ring-4 ring-card" />
            <div className="min-w-0 pb-1">
              <h2 className="truncate text-xl font-semibold text-foreground">{user.name}</h2>
              <p className="truncate text-sm text-muted-foreground">@{user.username}</p>
            </div>
          </div>
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            Active
          </span>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <section className="rounded-xl border border-border bg-card p-5 shadow-xs">
          <h3 className="text-sm font-semibold text-foreground">Account details</h3>
          <dl className="mt-2 divide-y divide-border">
            <DetailRow icon={AtSign} label="Username">
              {user.username}
            </DetailRow>
            <DetailRow icon={Mail} label="Email">
              {user.email || "Not set"}
            </DetailRow>
            <DetailRow icon={ShieldCheck} label={roles.length === 1 ? "Role" : "Roles"}>
              <RoleList />
            </DetailRow>
            <DetailRow icon={CalendarDays} label="Member since">
              {formatWhen(user.createdAt)}
            </DetailRow>
            <DetailRow icon={Clock} label="Last sign-in">
              {formatWhen(user.lastSignInAt)}
            </DetailRow>
          </dl>
        </section>

        {fromMicrosoft ? (
          <section className="rounded-xl border border-border bg-card p-5 shadow-xs">
            <h3 className="text-sm font-semibold text-foreground">Your Microsoft account</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              You signed in with your VZI Microsoft account. Your name and email come from that account, and your
              roles are assigned by VZI IT in Microsoft Entra ID — ask them for any change.
            </p>
          </section>
        ) : (
        <section className="rounded-xl border border-border bg-card p-5 shadow-xs">
          <h3 className="text-sm font-semibold text-foreground">Edit profile</h3>
          <p className="mt-1 text-sm text-muted-foreground">Update the name and email shown across the app.</p>

          <form onSubmit={save} className="mt-5 flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="profile-name">Display name</Label>
              <div className="relative">
                <UserRound className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="profile-name"
                  className="h-10 pl-9"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    setSaved(false)
                  }}
                  required
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="profile-email">Email</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="profile-email"
                  type="email"
                  className="h-10 pl-9"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    setSaved(false)
                  }}
                  placeholder="name@company.com"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button type="submit" size="lg" className="h-10" disabled={!dirty || !name.trim()}>
                Save changes
              </Button>
              {dirty && (
                <Button
                  type="button"
                  variant="ghost"
                  size="lg"
                  className="h-10"
                  onClick={() => {
                    setName(user.name)
                    setEmail(user.email)
                  }}
                >
                  Cancel
                </Button>
              )}
              {saved && !dirty && <span className="text-sm text-emerald-700 dark:text-emerald-400">Changes saved</span>}
            </div>
          </form>
        </section>
        )}
      </div>
    </>
  )
}
