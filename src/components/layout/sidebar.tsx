"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useRef, useSyncExternalStore, type ComponentType } from "react"
import { ChevronRight, ListChecks, PanelLeftClose, PanelLeftOpen, Plus } from "lucide-react"

import { SidebarAccount } from "@/components/auth/sidebar-account"
import { ThemeToggle } from "@/components/shared/theme-toggle"
import {
  ICONS,
  INITIATIVE_NAV_SECTIONS,
  QUICK_ACTIONS,
} from "@/lib/constants"
import { ASSISTANT_REQUESTS } from "@/lib/assistant/request/flag"
import { useUnreadNotifications } from "@/hooks/use-unread-notifications"
import { CODING_CANDIDATES_PATH, useUnscreenedCandidates } from "@/hooks/use-unscreened-candidates"
import { NOTIFICATIONS_PATH, unreadBadge } from "@/lib/notifications"
import { cn } from "@/lib/utils"

type NavLink = {
  label: string
  href: string
  icon: ComponentType<{ className?: string }>
  badge?: number
}

type NavGroup = { title: string; links: NavLink[] }

/**
 * What a person opened or closed, per browser: which groups are open, and
 * whether the panel itself is down to its rail. A convenience only: storage can
 * be empty, blocked or throw (a private window, cleared site data), and then
 * every group simply starts in its default state and the panel starts open.
 */
const GROUPS_KEY = "spares.sidebar.groups"
const COLLAPSED_KEY = "spares.sidebar.collapsed"
const NO_TOGGLES: Record<string, boolean> = {}
const listeners = new Set<() => void>()
let toggles: Record<string, boolean> | null = null
let collapsed: boolean | null = null

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

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

function readCollapsed(): boolean {
  if (collapsed !== null) return collapsed
  try {
    collapsed = window.localStorage.getItem(COLLAPSED_KEY) === "1"
  } catch {
    collapsed = false
  }
  return collapsed
}

function writeCollapsed(next: boolean) {
  collapsed = next
  try {
    window.localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0")
  } catch {
    // Kept for this page view only.
  }
  listeners.forEach((listener) => listener())
}

function useGroupToggles(): Record<string, boolean> {
  return useSyncExternalStore(subscribe, readToggles, () => NO_TOGGLES)
}

/** False on the server: the panel renders open and narrows once hydrated. */
function useCollapsed(): boolean {
  return useSyncExternalStore(subscribe, readCollapsed, () => false)
}

/** Whether `href` is the page, or a page under it: /repairable-spares/repair-register/4500-10 is in the register. */
function within(pathname: string, href: string): boolean {
  const path = href.split("?")[0]
  return pathname === path || pathname.startsWith(`${path}/`)
}

/**
 * The app's side navigation: a floating, rounded panel -- light in light mode,
 * dark in dark mode -- with the logo at the top, the current page drawn as a
 * pill that runs out to the panel's edge with curved flares above and below, and
 * Logout at the foot.
 *
 * - Home comes first;
 * - every group collapses, and the one holding the current page starts open. A
 *   group someone opens or closes stays that way in their browser;
 * - the whole panel collapses to a rail of icons, which stays that way in their
 *   browser too. The rail drops the group headings rather than shrinking them:
 *   a heading nobody can read is a row of pixels charging for vertical space,
 *   and every link is reachable from the rail whichever group it sits in;
 * - the current page stays highlighted on the pages under it -- a repair line
 *   lights up Repair Register.
 *
 * Colours come from the `--nav-*` tokens in globals.css.
 */
export function Sidebar() {
  const pathname = usePathname()
  const opened = useGroupToggles()
  const isCollapsed = useCollapsed()
  const unreadNotifications = useUnreadNotifications()
  // Repair Candidates waiting for the AI screen (4-Nov-2026).
  const unscreenedCandidates = useUnscreenedCandidates(pathname)

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
      links: section.items.map((item) => ({
        label: item.label,
        href: item.href,
        icon: ICONS[item.icon],
        badge: item.href === CODING_CANDIDATES_PATH ? unscreenedCandidates : undefined,
      })),
    })),
    {
      title: "More",
      links: QUICK_ACTIONS.filter((action) => action !== home).map((action) => ({
        label: action.label,
        href: action.href,
        icon: ICONS[action.icon],
        badge: action.href === NOTIFICATIONS_PATH ? unreadBadge(unreadNotifications) : action.badge,
      })),
    },
  ]

  // The most specific link the current page is under: Sessions, not "Open the
  // assistant", on /assistant/sessions/SXXXX.
  const allLinks = [...(home ? [home.href] : []), ...groups.flatMap((g) => g.links.map((l) => l.href))]
  const active = allLinks
    .filter((href) => !href.includes("?") && within(pathname, href))
    .sort((a, b) => b.length - a.length)[0]

  const HomeIcon = home ? ICONS[home.icon] : null

  // The rail lists every link rather than only the open group's, so it is
  // taller than the panel (1,144px against 619px, measured) and the scrollbar
  // is hidden by design. Without this the current page can sit below the fold
  // with nothing on screen marked, which reads as "no page is current".
  // `nearest` does nothing when the link is already in view, so this is inert
  // in the expanded panel and on the pages that fit.
  const activeRef = useRef<HTMLAnchorElement | null>(null)
  useEffect(() => {
    const show = () => activeRef.current?.scrollIntoView({ block: "nearest" })
    show()
    // The panel animates its width for 200ms, and a scroll worked out while
    // that is still running lands short of the mark. Once more when it has
    // settled; by then the first call has usually already done it.
    const settled = window.setTimeout(show, 260)
    return () => window.clearTimeout(settled)
  }, [isCollapsed, active])

  return (
    <div className="flex shrink-0 py-3 pl-3">
      <aside
        className={cn(
          "flex flex-col overflow-hidden rounded-[28px] bg-nav-bg text-nav-fg shadow-xl ring-1 ring-nav-border",
          "transition-[width] duration-200 ease-out motion-reduce:transition-none",
          isCollapsed ? "w-[72px]" : "w-[232px]"
        )}
      >
        <div className={cn("flex items-start gap-2 pt-5 pb-3", isCollapsed ? "justify-center px-3" : "px-5")}>
          {!isCollapsed && (
            <Link
              href="/home"
              aria-label="ProcureAssistAI home"
              className="group block min-w-0 flex-1 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              {/* Transparent-ground marks, one per theme: brand colours on the light
                  panel, a white wordmark (globe unchanged) on the dark one. */}
              <span className="inline-flex py-1">
                <Image
                  src="/brand/vedanta-zinc-logo.png"
                  alt="Vedanta Zinc International"
                  width={245}
                  height={70}
                  priority
                  className="h-9 w-auto dark:hidden"
                />
                <Image
                  src="/brand/vedanta-zinc-logo-dark.png"
                  alt="Vedanta Zinc International"
                  width={245}
                  height={70}
                  priority
                  className="hidden h-9 w-auto dark:block"
                />
              </span>
              <span className="mt-2 block text-[13px] font-semibold text-nav-fg">ProcureAssistAI</span>
            </Link>
          )}
          <button
            type="button"
            onClick={() => writeCollapsed(!isCollapsed)}
            aria-expanded={!isCollapsed}
            aria-controls="sidebar-nav"
            title={isCollapsed ? "Expand the menu" : "Collapse the menu"}
            className="shrink-0 rounded-lg p-1.5 text-nav-muted transition-colors outline-none hover:bg-nav-hover hover:text-nav-fg focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            {isCollapsed ? (
              <PanelLeftOpen aria-hidden="true" className="size-[18px]" />
            ) : (
              <PanelLeftClose aria-hidden="true" className="size-[18px]" />
            )}
            <span className="sr-only">{isCollapsed ? "Expand the menu" : "Collapse the menu"}</span>
          </button>
        </div>

        <nav
          id="sidebar-nav"
          aria-label="Main"
          className="min-h-0 flex-1 overflow-y-auto pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <div className={cn("pb-1", isCollapsed ? "px-2" : "px-3")}>
            <Link
              href="/assistant"
              title={isCollapsed ? "New session" : undefined}
              className={cn(
                "flex items-center rounded-xl border border-dashed border-nav-muted/40 text-[13px] transition-colors",
                isCollapsed ? "mx-auto size-10 justify-center" : "gap-2 px-4 py-2",
                pathname === "/assistant" ? "bg-nav-hover text-nav-fg" : "text-nav-muted hover:bg-nav-hover hover:text-nav-fg"
              )}
            >
              <Plus className="size-4 shrink-0" />
              <span className={cn("font-medium", isCollapsed && "sr-only")}>New session</span>
            </Link>
          </div>

          {home && HomeIcon && (
            <div className="-my-2 py-4">
              <NavItem
                link={{ label: home.label, href: home.href, icon: HomeIcon }}
                active={active === home.href}
                collapsed={isCollapsed}
                innerRef={active === home.href ? activeRef : undefined}
              />
            </div>
          )}

          {groups.map((group, index) =>
            isCollapsed ? (
              // No heading to collapse under: the links stand on their own, with
              // a rule between groups so the rail is not one undivided column.
              <div key={group.title}>
                {index > 0 && <div aria-hidden="true" className="mx-auto my-2 h-px w-8 bg-nav-muted/25" />}
                {group.links.map((link) => (
                  <NavItem
                    key={link.href}
                    link={link}
                    active={link.href === active}
                    collapsed
                    innerRef={link.href === active ? activeRef : undefined}
                  />
                ))}
              </div>
            ) : (
              <NavSection
                key={group.title}
                title={group.title}
                open={opened[group.title] ?? group.links.some((link) => link.href === active)}
                holdsCurrent={group.links.some((link) => link.href === active)}
                onToggle={() =>
                  writeToggle(
                    group.title,
                    !(opened[group.title] ?? group.links.some((link) => link.href === active))
                  )
                }
              >
                {group.links.map((link) => (
                  <NavItem
                    key={link.href}
                    link={link}
                    active={link.href === active}
                    collapsed={false}
                    innerRef={link.href === active ? activeRef : undefined}
                  />
                ))}
              </NavSection>
            )
          )}
        </nav>

        <div className={cn("pt-2 pb-4", isCollapsed ? "px-2" : "px-3")}>
          <SidebarAccount collapsed={isCollapsed}>
            <ThemeToggle compact={isCollapsed} />
          </SidebarAccount>
        </div>
      </aside>
    </div>
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
        className="mx-3 flex w-[calc(100%-1.5rem)] items-center gap-1.5 rounded-md px-3 pt-3 pb-1.5 text-left text-[11px] font-medium tracking-[0.5px] text-nav-muted uppercase transition-colors outline-none hover:text-nav-fg focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <ChevronRight
          aria-hidden="true"
          className={cn("size-3.5 shrink-0 transition-transform duration-200 motion-reduce:transition-none", open && "rotate-90")}
        />
        <span className="min-w-0 flex-1 truncate">{title}</span>
        {holdsCurrent && !open && <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-nav-active" />}
      </button>
      {/* Grid rows animate the height without measuring it. The inner box is padded and
          pulled back by the same amount so the active pill's flares, which poke 16px above
          and below it, are not clipped. It ignores the pointer so that padding never covers
          the group header above it; the links turn the pointer back on. */}
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div
          className={cn(
            "pointer-events-none -my-4 flex min-h-0 flex-col overflow-hidden py-4 transition-[visibility] duration-200 motion-reduce:transition-none",
            // Clipping is to the padding box, so the tops of the closed links would show in that padding
            // as dashes above the next heading. Hidden once the collapse finishes, shown as it starts.
            !open && "invisible"
          )}
          inert={!open}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

/**
 * The current page is a pill that runs to the panel's right edge. The two flares
 * above and below it are 16px squares: the far corner is filled with the accent,
 * the near corner is cut away by a quarter circle, which makes the pill's ends
 * curve into the edge. (Class names are written out in full so Tailwind sees them.)
 */
const ACTIVE_ITEM = cn(
  "ml-3 rounded-l-full bg-nav-active pr-5 pl-4 font-medium text-nav-active-fg",
  "before:pointer-events-none before:absolute before:-top-4 before:right-0 before:size-4",
  "before:bg-[image:radial-gradient(circle_at_0_0,transparent_16px,var(--nav-active)_16.5px)]",
  "after:pointer-events-none after:absolute after:-bottom-4 after:right-0 after:size-4",
  "after:bg-[image:radial-gradient(circle_at_0_100%,transparent_16px,var(--nav-active)_16.5px)]"
)

function NavItem({
  link,
  active,
  collapsed,
  innerRef,
}: {
  link: NavLink
  active: boolean
  collapsed: boolean
  /** Set on the current page's link, so the panel can scroll it into view. */
  innerRef?: React.Ref<HTMLAnchorElement>
}) {
  const Icon = link.icon

  if (collapsed) {
    // A square, centred in the rail. The edge-to-edge pill above needs the
    // panel's full width to read as one, so the rail marks the current page
    // with a plain rounded tile instead.
    return (
      <Link
        ref={innerRef}
        href={link.href}
        aria-current={active ? "page" : undefined}
        title={link.label}
        className={cn(
          "pointer-events-auto relative mx-auto my-1 flex size-10 items-center justify-center rounded-xl transition-colors",
          active
            ? "bg-nav-active font-medium text-nav-active-fg"
            : "text-nav-muted hover:bg-nav-hover hover:text-nav-fg"
        )}
      >
        <Icon className="size-4 shrink-0" />
        {/* The count has nowhere to go at this width, so it becomes a dot. The
            number is still announced, and the panel shows it when opened. */}
        {link.badge ? (
          <span
            aria-hidden="true"
            className="absolute top-1.5 right-1.5 size-2 rounded-full bg-destructive ring-2 ring-nav-bg"
          />
        ) : null}
        <span className="sr-only">
          {link.label}
          {link.badge ? ` (${link.badge})` : ""}
        </span>
      </Link>
    )
  }

  return (
    <Link
      ref={innerRef}
      href={link.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "pointer-events-auto relative my-0.5 flex items-center gap-3 py-2.5 text-[13px] transition-colors",
        active ? ACTIVE_ITEM : "mx-3 rounded-xl px-4 text-nav-muted hover:bg-nav-hover hover:text-nav-fg"
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className="min-w-0 truncate">{link.label}</span>
      {link.badge ? (
        <span className="ml-auto shrink-0 rounded-full bg-destructive/15 px-1.5 py-0.5 text-[11px] font-medium text-destructive">
          {link.badge}
        </span>
      ) : null}
    </Link>
  )
}
