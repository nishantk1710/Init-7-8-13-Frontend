"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LogOut } from "lucide-react"

import { Avatar } from "@/components/ui/avatar"
import { useCurrentUser } from "@/hooks/use-current-user"
import { signOut } from "@/lib/auth/mock-auth"
import { cn } from "@/lib/utils"

/**
 * The foot of the sidebar: the signed-in user (a link to /profile), whatever
 * `children` the sidebar puts between (the theme toggle), then Logout.
 */
export function SidebarAccount({ children }: { children?: React.ReactNode }) {
  const user = useCurrentUser()
  const pathname = usePathname()
  const isActive = pathname === "/profile"

  return (
    <div className="flex flex-col gap-1">
      <Link
        href="/profile"
        className={cn(
          "flex min-w-0 items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] text-nav-fg transition-colors",
          isActive ? "bg-nav-hover" : "hover:bg-nav-hover"
        )}
      >
        <Avatar name={user?.name ?? " "} size="sm" />
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="truncate font-medium">{user?.name ?? " "}</span>
          <span className="truncate text-[11px] text-nav-muted">My profile</span>
        </span>
      </Link>
      {children}
      <button
        type="button"
        onClick={signOut}
        className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-nav-btn px-4 py-2.5 text-[13px] font-semibold text-nav-btn-fg shadow-sm transition-opacity hover:opacity-90"
      >
        <LogOut className="size-4" />
        Logout
      </button>
    </div>
  )
}
