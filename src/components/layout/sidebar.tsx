"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSyncExternalStore, type ComponentType } from "react"
import { ChevronRight, ListChecks, Plus } from "lucide-react"

import { SidebarAccount } from "@/components/auth/sidebar-account"
import { DataModeToggle } from "@/components/shared/data-mode"
import { ThemeToggle } from "@/components/shared/theme-toggle"
import {
  CATEGORIES,
  ICONS,
  INITIATIVE_NAV_SECTIONS,
  QUICK_ACTIONS,
} from "@/lib/constants"
import { ASSISTANT_REQUESTS } from "@/lib/assistant/request/flag"
import { cn } from "@/lib/utils"

/** The page you are on: a solid indigo pill with white text, in every section. */
const ACTIVE_ITEM = "bg-primary-strong font-semibold text-white hover:bg-primary-strong-hover"

type NavLink = {
  label: string
  href: string
  icon: ComponentType<{ className?: string }>
  badge?: number
}

type NavGroup = { title: string; links: NavLink[] }

/**
 * The groups a person opened or closed, per browser. A convenience only:
 * storage can be empty, blocked or throw (a private window, cleared site
 * data), and then every group simply starts in its default state.
 */
const GROUPS_KEY = "spares.sidebar.groups"
const NO_TOGGLES: Record<string, boolean> = {}
const listeners = new Set<() => void>()
let toggles: Record<string, boolean> | null = null

function readToggles(): Record<string, boolean> {
  if (toggles) return toggles
  try {
    const stored = JSON.parse(window.localStorage.getItem(GROUPS_KEY) ?? "{}")
    toggles = stored && typeof stored === "object" ? stored : {}
  } catch {
    toggles = {}
  }
  return toggles ?? NO_TOGGLES
}

function writeToggle(title: string, open: boolean) {
  toggles = { ...readToggles(), [title]: open }
  try {
    window.localStorage.setItem(GROUPS_KEY, JSON.stringify(toggles))
  } catch {
    // Kept for this page view only.
  }
  listeners.forEach((listener) => listener())
}

function useGroupToggles(): Record<string, boolean> {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    readToggles,
    () => NO_TOGGLES
  )
}

/** Whether `href` is the page, or a page under it: /repairable-spares/repair-register/4500-10 is in the register. */
function within(pathname: string, href: string): boolean {
  const path = href.split("?")[0]
  return pathname === path || pathname.startsWith(`${path}/`)
}

/**
 * The live app's sidebar -- I08_Live_UI_Redesign_Plan.md, V4 and decision D3.
 *
 * It was 30 links in always-open groups, 1.9 screens tall, with Home the 21st
 * link under "Quick actions" and a CPU icon where the brand should be. Now:
 *
 * - the Vedanta logo heads it, on a white chip in dark mode -- it was only on
 *   the sign-in page, so users signed in on a branded page and landed in a
 *   template;
 * - Home comes first;
 * - every group collapses, and the one holding the current page starts open,
 *   so about fifteen links show rather than thirty. A group someone opens or
 *   closes stays that way in their browser;
 * - the current page stays highlighted on the pages under it -- a repair line
 *   lights up Repair Register -- where it used to match the exact address only.
 *
 * App-wide in Live mode; Snapshot renders its own copy of the old sidebar
 * (`src/demo/components/layout/sidebar.tsx`) and is unchanged.
 */
export function Sidebar() {
  const pathname = usePathname()
  const opened = useGroupToggles()

  const home = QUICK_ACTIONS.find((action) => action.href === "/home")
  const groups: NavGroup[] = [
    {
      title: "Reservation assistant",
      // Real sessions are not listed here on purpose: the sidebar renders on
      // every page, and a session is identified by a ten-character reference
      // a planner carries to SAP, not a name they would recognise in a menu.
      // The log lives at /assistant/sessions, one click away.
      links: [
        { label: "Open the assistant", icon: ICONS["message-circle"], href: "/assistant" },
        { label: "Sessions", icon: ICONS["history"], href: "/assistant/sessions" },
        // Offered only with NEXT_PUBLIC_ASSISTANT_REQUESTS (or the demo) --
        // see lib/assistant/request/flag.ts.
        ...(ASSISTANT_REQUESTS ? [{ label: "Requests", icon: ListChecks, href: "/assistant/requests" }] : []),
      ],
    },
    ...INITIATIVE_NAV_SECTIONS.map((section) => ({
      title: section.title,
      links: section.items.map((item) => ({ label: item.label, href: item.href, icon: ICONS[item.icon] })),
    })),
    {
      title: "More",
      links: QUICK_ACTIONS.filter((action) => action !== home).map((action) => ({
        label: action.label,
        href: action.href,
        icon: ICONS[action.icon],
        badge: action.badge,
      })),
    },
    {
      title: "Categories",
      links: CATEGORIES.map((category) => ({
        label: category.label,
        href: `/materials?category=${encodeURIComponent(category.label)}`,
        icon: ICONS[category.icon],
      })),
    },
  ]

  // The most specific link the current page is under: Sessions, not "Open the
  // assistant", on /assistant/sessions/SXXXX. Category links never are.
  const allLinks = [...(home ? [home.href] : []), ...groups.flatMap((g) => g.links.map((l) => l.href))]
  const active = allLinks
    .filter((href) => !href.includes("?") && within(pathname, href))
    .sort((a, b) => b.length - a.length)[0]

  const HomeIcon = home ? ICONS[home.icon] : null

  return (
    <aside className="flex w-[240px] shrink-0 flex-col overflow-y-auto border-r border-border bg-card">
      <div className="border-b border-border px-4 pt-4 pb-3.5">
        <Link href="/home" aria-label="Spares AI home" className="group block rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
          {/* The logo has a white ground, so in dark mode it sits on a white chip. */}
          <span className="inline-flex dark:rounded-md dark:bg-white dark:px-2 dark:py-1">
            <Image
              src="/brand/vedanta-zinc-logo.png"
              alt="Vedanta Zinc International"
              width={245}
              height={70}
              priority
              className="h-8 w-auto"
            />
          </span>
          <span className="mt-2 block text-[13px] font-semibold text-foreground">Spares AI</span>
        </Link>
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

      {home && HomeIcon && (
        <div className="pt-1">
          <NavItem link={{ label: home.label, href: home.href, icon: HomeIcon }} active={active === home.href} />
        </div>
      )}

      {groups.map((group) => {
        const holdsCurrent = group.links.some((link) => link.href === active)
        const open = opened[group.title] ?? holdsCurrent
        return (
          <NavSection
            key={group.title}
            title={group.title}
            open={open}
            holdsCurrent={holdsCurrent}
            onToggle={() => writeToggle(group.title, !open)}
          >
            {group.links.map((link) => (
              <NavItem key={link.href} link={link} active={link.href === active} />
            ))}
          </NavSection>
        )
      })}

      <div className="mt-auto border-t border-border py-1">
        <SidebarAccount />
        <DataModeToggle />
        <ThemeToggle />
      </div>
    </aside>
  )
}

function NavSection({
  title,
  open,
  holdsCurrent,
  onToggle,
  children,
}: {
  title: string
  open: boolean
  /** The current page is in this group: marked while the group is closed. */
  holdsCurrent: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="py-0.5">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="mx-2 flex w-[calc(100%-1rem)] items-center gap-1.5 rounded-md px-2 pt-2.5 pb-1.5 text-left text-[11px] font-medium tracking-[0.5px] text-muted-foreground uppercase transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <ChevronRight
          aria-hidden="true"
          className={cn("size-3.5 shrink-0 transition-transform duration-200 motion-reduce:transition-none", open && "rotate-90")}
        />
        <span className="min-w-0 flex-1 truncate">{title}</span>
        {holdsCurrent && !open && <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-primary" />}
      </button>
      {/* Grid rows animate the height without measuring it. */}
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="flex min-h-0 flex-col overflow-hidden" inert={!open}>
          {children}
        </div>
      </div>
    </div>
  )
}

function NavItem({ link, active }: { link: NavLink; active: boolean }) {
  const Icon = link.icon
  return (
    <Link
      href={link.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "mx-2 my-0.5 flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] transition-colors",
        active ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className="min-w-0 truncate">{link.label}</span>
      {link.badge ? (
        <span className="ml-auto shrink-0 rounded-full bg-destructive/10 px-1.5 py-0.5 text-[11px] font-medium text-destructive">
          {link.badge}
        </span>
      ) : null}
    </Link>
  )
}
