"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LogOut } from "lucide-react"

import { Avatar } from "@/components/ui/avatar"
import { useCurrentUser } from "@/hooks/use-current-user"
import { signOutEverywhere } from "@/lib/auth/sign-out"
import { cn } from "@/lib/utils"

/**
 * The foot of the sidebar: the signed-in user (a link to /profile), whatever
 * `children` the sidebar puts between (the theme toggle), then Logout.
 *
 * `collapsed` is the sidebar down to its rail: the name and the button's label
 * go, leaving the avatar and an icon, each still reachable and still named for
 * a screen reader.
 */
export function SidebarAccount({
  children,
  collapsed = false,
}: {
  children?: React.ReactNode
  collapsed?: boolean
}) {
  const user = useCurrentUser()
  const pathname = usePathname()
  const isActive = pathname === "/profile"
  const name = user?.name ?? " "

  return (
    <div className={cn("flex flex-col gap-1", collapsed && "items-center")}>
      <Link
        href="/profile"
        title={collapsed ? "My profile" : undefined}
        className={cn(
          "flex min-w-0 items-center rounded-xl text-[13px] text-nav-fg transition-colors",
          collapsed ? "size-10 justify-center" : "gap-2.5 px-3 py-2",
          isActive ? "bg-nav-hover" : "hover:bg-nav-hover"
        )}
      >
        <Avatar name={name} size="sm" />
        {collapsed ? (
          <span className="sr-only">{name}, my profile</span>
        ) : (
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate font-medium">{name}</span>
            <span className="truncate text-[11px] text-nav-muted">My profile</span>
          </span>
        )}
      </Link>
      {children}
      <button
        type="button"
        onClick={() => void signOutEverywhere()}
        title={collapsed ? "Logout" : undefined}
        className={cn(
          "mt-2 flex items-center justify-center gap-2 rounded-xl bg-nav-btn text-[13px] font-semibold text-nav-btn-fg shadow-sm transition-opacity hover:opacity-90",
          collapsed ? "size-10" : "px-4 py-2.5"
        )}
      >
        <LogOut className="size-4 shrink-0" />
        <span className={cn(collapsed && "sr-only")}>Logout</span>
      </button>
    </div>
  )
}
