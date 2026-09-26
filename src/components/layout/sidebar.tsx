"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Plus } from "lucide-react"

import { DataModeToggle } from "@/components/shared/data-mode"
import { ThemeToggle } from "@/components/shared/theme-toggle"
import {
  CATEGORIES,
  ICONS,
  INITIATIVE_NAV_SECTIONS,
  QUICK_ACTIONS,
} from "@/lib/constants"
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
  const CpuIcon = ICONS["cpu"]
  const MessageIcon = ICONS["message-circle"]
  const HistoryIcon = ICONS["history"]


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
          href="/assistant"
          className={cn(
            "flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-[13px] transition-colors",
            pathname === "/assistant"
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <Plus className="size-4 shrink-0" />
          <span className="font-medium">New session</span>
        </Link>
      </div>

      {/* The reservation assistant, shared by Initiative 08 and 13.
          
          This replaces a list of "active sessions" read from `mock-data.ts` —
          hand-written conversations that wrote nothing anywhere and linked to
          a `/chat` route that no longer exists.
          
          Real sessions are not listed here on purpose. The sidebar renders on
          every page, so fetching the log would add a request to every
          navigation for a list nobody navigates by; and a session is
          identified by a ten-character reference a planner carries to SAP,
          not by a name they would recognise in a menu. The log lives at
          /assistant/sessions, one click away. */}
      <NavSection title="Reservation assistant">
        {[
          { label: "Open the assistant", icon: MessageIcon, href: "/assistant" },
          { label: "Sessions", icon: HistoryIcon, href: "/assistant/sessions" },
        ].map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon
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
              <span className="font-medium">{item.label}</span>
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
        <DataModeToggle />
        <ThemeToggle />
      </div>
    </aside>
  )
}
