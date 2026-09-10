"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Plus } from "lucide-react"

import { ThemeToggle } from "@/components/shared/theme-toggle"
import {
  CATEGORIES,
  ICONS,
  INITIATIVE_NAV_SECTIONS,
  NEW_SESSION_ID,
  QUICK_ACTIONS,
} from "@/lib/constants"
import { getActiveSessions } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

function NavSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="py-1">
      <div className="px-4 pt-3 pb-1 text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase">
        {title}
      </div>
      <div className="flex flex-col">{children}</div>
    </div>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const allSessions = getActiveSessions()
  const sessions = allSessions.filter(
    (session) => session.id !== NEW_SESSION_ID
  )
  const draftSession = allSessions.find(
    (session) => session.id === NEW_SESSION_ID
  )
  const CpuIcon = ICONS["cpu"]
  const MessageIcon = ICONS["message-circle"]
  const draftHref = `/chat/${NEW_SESSION_ID}`
  const isOnDraft = pathname === draftHref

  // In-memory only — a full page refresh clears the draft tab.
  const [draftOpen, setDraftOpen] = useState(false)

  return (
    <aside className="flex w-[240px] shrink-0 flex-col overflow-y-auto border-r border-border bg-card">
      <div className="border-b border-border p-4">
        <h3 className="flex items-center gap-1.5 text-[15px] font-medium text-foreground">
          <CpuIcon className="size-[18px]" />
          Spares AI
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Vedanta spares management
        </p>
      </div>

      <div className="px-2 pt-3 pb-1">
        <Link
          href={draftHref}
          onClick={() => setDraftOpen(true)}
          className={cn(
            "flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-[13px] transition-colors",
            isOnDraft
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <Plus className="size-4 shrink-0" />
          <span className="font-medium">New session</span>
        </Link>
      </div>

      <NavSection title="Active sessions">
        {draftOpen && draftSession && (
          <Link
            href={draftHref}
            className={cn(
              "mx-2 my-0.5 flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] transition-colors",
              isOnDraft
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            <MessageIcon className="size-4 shrink-0" />
            <span className="min-w-0 flex-1">
              <span
                className={cn(
                  "block truncate font-medium",
                  isOnDraft ? "text-accent-foreground" : "text-foreground"
                )}
              >
                {draftSession.navLabel}
              </span>
              <span className="block truncate text-[11px] text-muted-foreground">
                {draftSession.navSubtitle}
              </span>
            </span>
          </Link>
        )}
        {sessions.map((session) => {
          const href = `/chat/${session.id}`
          const isActive = pathname === href
          return (
            <Link
              key={session.id}
              href={href}
              className={cn(
                "mx-2 my-0.5 flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] transition-colors",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              <MessageIcon className="size-4 shrink-0" />
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block truncate font-medium",
                    isActive ? "text-accent-foreground" : "text-foreground"
                  )}
                >
                  {session.navLabel}
                </span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {session.navSubtitle}
                </span>
              </span>
              {session.navBadge?.type === "count" && (
                <span className="shrink-0 rounded-full bg-destructive/10 px-1.5 py-0.5 text-[11px] font-medium text-destructive">
                  {session.navBadge.value}
                </span>
              )}
              {session.navBadge?.type === "alert" && (
                <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-destructive text-[11px] font-medium text-white">
                  !
                </span>
              )}
            </Link>
          )
        })}
      </NavSection>

      {INITIATIVE_NAV_SECTIONS.map((section) => (
        <NavSection key={section.title} title={section.title}>
          {section.items.map((item) => {
            const Icon = ICONS[item.icon]
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "mx-2 my-0.5 flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] transition-colors",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="size-4 shrink-0" />
                {item.label}
              </Link>
            )
          })}
        </NavSection>
      ))}

      <NavSection title="Quick actions">
        {QUICK_ACTIONS.map((action) => {
          const Icon = ICONS[action.icon]
          const isActive = pathname === action.href
          return (
            <Link
              key={action.href}
              href={action.href}
              className={cn(
                "mx-2 my-0.5 flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] transition-colors",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              <Icon className="size-4 shrink-0" />
              {action.label}
              {action.badge && (
                <span className="ml-auto shrink-0 rounded-full bg-destructive/10 px-1.5 py-0.5 text-[11px] font-medium text-destructive">
                  {action.badge}
                </span>
              )}
            </Link>
          )
        })}
      </NavSection>

      <NavSection title="Categories">
        {CATEGORIES.map((category) => {
          const Icon = ICONS[category.icon]
          return (
            <Link
              key={category.label}
              href={`/materials?category=${encodeURIComponent(category.label)}`}
              className="mx-2 my-0.5 flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Icon className="size-4 shrink-0" />
              {category.label}
            </Link>
          )
        })}
      </NavSection>

      <div className="mt-auto border-t border-border py-1">
        <ThemeToggle />
      </div>
    </aside>
  )
}
