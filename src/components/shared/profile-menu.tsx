"use client"

import { ChevronDown, LogOut, Settings, User } from "lucide-react"
import { useRouter } from "next/navigation"

import { useRole } from "@/components/shared/role-context"
import { Avatar } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useCurrentUser } from "@/hooks/use-current-user"
import { signOutEverywhere } from "@/lib/auth/sign-out"
import { SHARED_ROLES, type SharedRole } from "@/lib/shared-data/users"

/**
 * Avatar + "Viewing as {role}" menu, shared by Home, Approvals and Audit.
 * Replaces Home's old role `<Select>`.
 *
 * The person shown is the test sign-in's user (lib/auth/mock-auth.ts). It
 * shows the role in the place an email address would go; "Viewing as" stays a
 * view preference, not an assigned role. "Settings" is present to match the
 * design but disabled: there is no settings page.
 */
export function ProfileMenu() {
  const { role, setRole } = useRole()
  const router = useRouter()
  // Blank until the session is read in the browser (see useCurrentUser).
  const profileName = useCurrentUser()?.name ?? " "

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Profile menu. Viewing as ${role}`}
        className="flex items-center gap-2.5 rounded-full border border-border bg-card py-1.5 pr-3 pl-1.5 text-left shadow-xs transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 data-popup-open:bg-muted"
      >
        <Avatar name={profileName} />
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-sm font-medium text-foreground">
            {profileName}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            Viewing as {role}
          </span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={8} className="w-72 p-0">
        <div className="flex items-center gap-3 p-4">
          <Avatar name={profileName} size="lg" />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-foreground">
              {profileName}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              Viewing as {role}
            </div>
          </div>
        </div>

        <DropdownMenuSeparator className="m-0" />

        <DropdownMenuGroup className="p-1.5">
          <DropdownMenuLabel className="px-2 pt-2 pb-1 text-[11px] font-semibold tracking-wider uppercase">
            Viewing as
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={role}
            onValueChange={(value) => setRole(value as SharedRole)}
          >
            {SHARED_ROLES.map((r) => (
              // Choosing a role is a commit, not a toggle: close the menu so the
              // page underneath is immediately usable. (base-ui radio items stay
              // open by default.)
              <DropdownMenuRadioItem key={r} value={r} closeOnClick className="px-2 py-2">
                {r}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>

        <DropdownMenuSeparator className="m-0" />

        <div className="p-1.5">
          <DropdownMenuItem onClick={() => router.push("/profile")} className="px-2 py-2">
            <User /> My profile
          </DropdownMenuItem>
          <DropdownMenuItem disabled className="px-2 py-2">
            <Settings /> Settings
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void signOutEverywhere()} variant="destructive" className="px-2 py-2">
            <LogOut /> Sign out
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
