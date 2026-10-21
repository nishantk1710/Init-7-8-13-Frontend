import Image from "next/image"
import type { ReactNode } from "react"
import { Gauge, MessageCircle, TrendingUp, Wrench, type LucideIcon } from "lucide-react"

const HIGHLIGHTS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: TrendingUp, title: "Inventory Planning", text: "Right max levels and reorder points" },
  { icon: Wrench, title: "Repairable Spares", text: "Repair before buying new" },
  { icon: Gauge, title: "OAR Utilization", text: "Every ordered spare tracked to use" },
  { icon: MessageCircle, title: "Reservation Assistant", text: "Stock checked before you reserve" },
]

/** The striped globe from the Vedanta mark, as a large backdrop. */
function GlobeStripes({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 400" aria-hidden className={className}>
      <defs>
        <clipPath id="auth-globe">
          <circle cx="200" cy="200" r="196" />
        </clipPath>
      </defs>
      <g clipPath="url(#auth-globe)" fill="none" strokeLinecap="round" strokeWidth="15">
        {Array.from({ length: 12 }, (_, i) => {
          const y = 8 + i * 34
          const green = i % 4 === 1
          return (
            <path
              key={i}
              d={`M-20 ${y + 30} C 90 ${y - 25}, 200 ${y + 55}, 420 ${y - 10}`}
              stroke={green ? "#73b522" : "#ffffff"}
              strokeOpacity={green ? 0.45 : 0.08}
            />
          )
        })}
      </g>
      <circle cx="200" cy="200" r="196" fill="none" stroke="#ffffff" strokeOpacity="0.12" strokeWidth="2" />
    </svg>
  )
}

/**
 * The frame around /login and /signup: one brand canvas in the Vedanta
 * palette (`.brand-scope` in globals.css), the pitch on the left and the form
 * in a card on the right; the card alone on narrow screens. Sized to fit a
 * laptop screen at 100% without scrolling. These pages sit outside both app
 * trees; src/proxy.ts lets them through without a session.
 */
export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string
  description: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <main className="brand-scope relative min-h-0 flex-1 overflow-y-auto bg-linear-to-br from-brand via-brand-deep to-brand-navy">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-0 opacity-50"
          style={{
            backgroundImage: "radial-gradient(rgba(255,255,255,0.12) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
        <div className="absolute top-1/4 -left-40 size-[28rem] rounded-full bg-brand-green/20 blur-3xl" />
        <div className="absolute -top-40 right-1/4 size-[26rem] rounded-full bg-sky-400/15 blur-3xl" />
        <GlobeStripes className="absolute -right-36 -bottom-56 w-[40rem]" />
      </div>

      <div className="relative mx-auto flex min-h-full w-full max-w-6xl items-center gap-12 px-5 py-4 sm:px-8 lg:gap-16 lg:px-10">
        <section className="hidden min-w-0 flex-1 text-white lg:block">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-[0.12em] uppercase ring-1 ring-white/20">
            <span className="size-1.5 rounded-full bg-brand-green-light" />
            Spares AI
          </span>

          <h2 className="mt-5 max-w-xl text-[2rem] leading-[1.15] font-semibold tracking-tight xl:text-[2.5rem]">
            Smarter spares decisions,{" "}
            <span className="text-brand-green-light">from reservation to repair.</span>
          </h2>
          <p className="mt-3 max-w-md text-[15px] leading-relaxed text-white/75">
            Planning, repairs and utilisation of spares, together in one place.
          </p>

          <ul className="mt-7 grid max-w-xl grid-cols-2 gap-2.5">
            {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
              <li
                key={title}
                className="flex items-start gap-3 rounded-xl bg-white/[0.07] p-3.5 ring-1 ring-white/10 backdrop-blur-sm"
              >
                <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-green/15 ring-1 ring-brand-green-light/30">
                  <Icon className="size-4 text-brand-green-light" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{title}</span>
                  <span className="block text-[13px] leading-snug text-white/70">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mx-auto w-full max-w-[420px] shrink-0 rounded-2xl bg-card p-7 shadow-2xl ring-1 shadow-black/30 ring-black/5 sm:p-8 lg:mx-0">
          {/* The logo has a white ground, so in dark mode it sits on a white chip. */}
          <div className="inline-flex dark:rounded-lg dark:bg-white dark:px-2.5 dark:py-1.5">
            <Image
              src="/brand/vedanta-zinc-logo.png"
              alt="Vedanta Zinc International"
              width={245}
              height={70}
              priority
              className="h-10 w-auto"
            />
          </div>

          <h1 className="mt-6 text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>

          <div className="mt-6">{children}</div>

          {footer && <p className="mt-6 text-center text-sm text-muted-foreground">{footer}</p>}
        </section>
      </div>
    </main>
  )
}
