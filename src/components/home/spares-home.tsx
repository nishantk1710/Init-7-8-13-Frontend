import Link from "next/link"
import type { CSSProperties, ReactNode } from "react"
import { ArrowRight, Layers, MessageCircle, Package, Wrench } from "lucide-react"

import { HomeGreeting } from "@/components/home/home-greeting"
import { ProfileMenu } from "@/components/shared/profile-menu"
import { buttonVariants } from "@/components/ui/button"
import { initiative7Manifest } from "@/features/initiative-7/manifest"
import { initiative8Manifest } from "@/features/initiative-8/manifest"
import { initiative13Manifest } from "@/features/initiative-13/manifest"
import { ICONS, QUICK_ACTIONS } from "@/lib/constants"
import type { InitiativeManifest } from "@/lib/domain/manifest"
import { cn } from "@/lib/utils"

type ModuleCard = {
  manifest: InitiativeManifest
  code: string
  icon: ReactNode
  /** The module's colour, as a CSS value: the icon chip, the header tint and the motif. */
  accent: string
  /** Class for the icon chip's fill; whole class names so Tailwind can see them. */
  chip: string
  motif: ReactNode
}

const MODULES: ModuleCard[] = [
  {
    manifest: initiative7Manifest,
    code: "Initiative 07",
    icon: <Package className="size-7" />,
    accent: "var(--primary-strong)",
    chip: "bg-primary-strong",
    motif: (
      <>
        <rect x="10" y="40" width="12" height="24" rx="2" />
        <rect x="30" y="28" width="12" height="36" rx="2" />
        <rect x="50" y="14" width="12" height="50" rx="2" />
        <rect x="70" y="34" width="12" height="30" rx="2" />
        <path d="M4 64h88" />
      </>
    ),
  },
  {
    manifest: initiative8Manifest,
    code: "Initiative 08",
    icon: <Wrench className="size-7" />,
    accent: "var(--chart-3)",
    chip: "bg-chart-3",
    motif: (
      <>
        <circle cx="48" cy="38" r="12" />
        <circle cx="48" cy="38" r="26" strokeDasharray="6 6" />
        <path d="M48 6v8M48 62v8M16 38h8M72 38h8" />
      </>
    ),
  },
  {
    manifest: initiative13Manifest,
    code: "Initiative 13",
    icon: <Layers className="size-7" />,
    accent: "var(--chart-2)",
    chip: "bg-chart-2",
    motif: (
      <>
        <path d="M4 54c14 0 14-30 28-30s14 24 28 24 14-34 30-34" />
        <path d="M4 66h88" />
      </>
    ),
  },
]

/** What each cross-module destination is for, keyed by its QUICK_ACTIONS href. */
const CROSS_MODULE: Record<string, string> = {
  "/actions": "Everything waiting on you",
  "/approvals": "Approve or reject requests",
  "/audit": "Who changed what, and when",
}

/**
 * Home: the landing page. It is a launcher: it shows where to go and nothing
 * about the state of the work, so it fetches no data, cannot fail when a module
 * is down, and renders instantly. The live counts, approvals and activity live
 * on each module's Overview, the Action Center, Approvals and the Audit trail.
 *
 * Everything on it comes from the module manifests and `QUICK_ACTIONS`, so a
 * renamed or moved module needs no edit here.
 */
export function SparesHome() {
  const crossModule = QUICK_ACTIONS.filter((action) => action.href in CROSS_MODULE)

  return (
    // `oar-scope` (globals.css) is the blue page theme the OAR screens use: page
    // background, slate ink and borders, the sidebar's blue as the primary.
    <div className="oar-scope min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
      <div className="mx-auto flex max-w-[1240px] flex-col gap-7">
        <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
          <div className="min-w-0">
            <HomeGreeting />
            <h1 className="mt-0.5 text-balance text-2xl font-semibold tracking-tight text-foreground sm:text-[26px]">
              Where do you want to work today?
            </h1>
          </div>
          <div className="ml-auto shrink-0">
            <ProfileMenu />
          </div>
        </header>

        <AssistantBanner />

        <section aria-labelledby="home-modules" className="flex flex-col gap-4">
          <div>
            <h2 id="home-modules" className="text-base font-semibold text-foreground">
              Modules
            </h2>
            <p className="text-[13px] text-muted-foreground">Choose where to work.</p>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {MODULES.map((module) => (
              <ModuleLink key={module.manifest.id} module={module} />
            ))}
          </div>
        </section>

        <section aria-labelledby="home-across" className="flex flex-col gap-4">
          <h2 id="home-across" className="text-base font-semibold text-foreground">
            Across all modules
          </h2>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {crossModule.map((action) => {
              const Icon = ICONS[action.icon]
              return (
                <Link
                  key={action.href}
                  href={action.href}
                  className={cn(
                    "group flex items-center gap-3.5 rounded-[14px] border border-border bg-card px-[18px] py-4 shadow-xs",
                    "transition-[box-shadow,border-color] duration-150 hover:border-primary/40 hover:shadow-lg motion-reduce:transition-none",
                    "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  )}
                >
                  <span
                    aria-hidden
                    className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-primary-tint text-primary-ink"
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-foreground">{action.label}</span>
                    <span className="block text-xs text-muted-foreground">{CROSS_MODULE[action.href]}</span>
                  </span>
                  <ArrowRight
                    aria-hidden
                    className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                  />
                </Link>
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}

/** The reservation assistant: a flat band in the page's blue, with two ways in. */
function AssistantBanner() {
  return (
    <section
      aria-labelledby="home-assistant"
      className="relative flex flex-wrap items-center justify-between gap-x-8 gap-y-5 overflow-hidden rounded-[20px] bg-primary px-5 py-[22px] text-white sm:px-8 sm:py-7"
    >
      <svg
        aria-hidden
        viewBox="0 0 360 400"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="pointer-events-none absolute -top-8 -right-5 h-[200%] w-[360px] opacity-15"
      >
        {[60, 100, 140, 180, 220].map((r) => (
          <circle key={r} cx="260" cy="150" r={r} />
        ))}
      </svg>
      <div className="relative min-w-0">
        <p className="text-xs font-medium tracking-[0.08em] text-white/75 uppercase">Reservation assistant</p>
        <h2 id="home-assistant" className="mt-1.5 text-balance text-xl font-semibold">
          Check a material before you reserve it
        </h2>
        <p className="mt-1.5 max-w-[56ch] text-sm leading-relaxed text-white/85">
          Ask about a material and get guidance from Inventory Planning, Repairable Spares and OAR Utilization at the
          moment of reservation.
        </p>
      </div>
      <div className="relative flex flex-wrap gap-2.5">
        <Link
          href="/assistant"
          className={cn(
            buttonVariants({ size: "lg" }),
            "h-11 gap-2 bg-white px-4 text-primary-ink hover:bg-primary-tint focus-visible:ring-white/60"
          )}
        >
          <MessageCircle />
          Start new session
        </Link>
        <Link
          href="/assistant/sessions"
          className={cn(
            buttonVariants({ size: "lg", variant: "ghost" }),
            "h-11 border-white/40 px-4 text-white hover:bg-white/12 hover:text-white focus-visible:ring-white/60"
          )}
        >
          View sessions
        </Link>
      </div>
    </section>
  )
}

/**
 * One module as a large card. The whole card is the link; the button is a
 * styled span, because a button inside a link is not valid markup.
 */
function ModuleLink({ module }: { module: ModuleCard }) {
  const { manifest } = module
  return (
    <Link
      href={manifest.href}
      style={{ "--accent": module.accent } as CSSProperties}
      className={cn(
        "group flex min-h-[380px] flex-col rounded-2xl border border-border bg-card shadow-xs",
        "transition-[box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:shadow-lg motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      )}
    >
      <div className="relative flex-1 overflow-hidden rounded-t-[15px] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--accent)_11%,var(--card)),var(--card))] p-8 pb-6">
        <svg
          aria-hidden
          viewBox="0 0 96 72"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="absolute top-5 right-5 h-[105px] w-[140px] text-[var(--accent)] opacity-50"
        >
          {module.motif}
        </svg>
        <span
          aria-hidden
          className={cn("relative grid size-14 place-items-center rounded-[14px] text-white", module.chip)}
        >
          {module.icon}
        </span>
        <p className="mt-7 text-xs font-medium tracking-[0.06em] text-muted-foreground uppercase">{module.code}</p>
        <h3 className="mt-1 mb-2.5 text-2xl font-semibold tracking-tight text-foreground">{manifest.name}</h3>
        <p className="text-[15px] leading-relaxed text-muted-foreground">{manifest.description}</p>
      </div>
      <div className="px-8 pt-2 pb-8">
        <span
          className={cn(
            buttonVariants({ size: "lg" }),
            "h-12 w-full gap-2 text-[15px] group-hover:bg-primary/80"
          )}
        >
          Open {manifest.name}
          <ArrowRight />
        </span>
      </div>
    </Link>
  )
}
