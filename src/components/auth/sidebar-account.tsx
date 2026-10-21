"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LogOut } from "lucide-react"

import { Avatar } from "@/components/ui/avatar"
import { useCurrentUser } from "@/hooks/use-current-user"
import { signOut } from "@/lib/auth/mock-auth"
import { cn } from "@/lib/utils"

/**
 * The signed-in user at the foot of the sidebar: a link to /profile and a
 * sign-out button. Used by both sidebars (live and demo), so the profile is
 * one click away on every page.
 */
export function SidebarAccount() {
  const user = useCurrentUser()
  const pathname = usePathname()
  const isActive = pathname === "/profile"

  return (
    <div className="mx-2 my-0.5 flex items-center gap-1">
      <Link
        href="/profile"
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] transition-colors",
          isActive ? "bg-accent text-accent-foreground" : "text-foreground hover:bg-muted"
        )}
      >
        <Avatar name={user?.name ?? " "} size="sm" />
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="truncate font-medium">{user?.name ?? " "}</span>
          <span className="truncate text-[11px] text-muted-foreground">My profile</span>
        </span>
      </Link>
      <button
        type="button"
        onClick={signOut}
        aria-label="Sign out"
        title="Sign out"
        className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <LogOut className="size-4" />
      </button>
    </div>
  )
}
