import Image from "next/image"
import { Inter, Plus_Jakarta_Sans } from "next/font/google"
import type { CSSProperties, ReactNode } from "react"
import { Gauge, MessageCircle, TrendingUp, Wrench, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

// The design's two faces, loaded for these pages only (the app itself is in Geist).
const display = Plus_Jakarta_Sans({ variable: "--font-aurora-display", subsets: ["latin"] })
const text = Inter({ variable: "--font-aurora-text", subsets: ["latin"] })

const HIGHLIGHTS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: TrendingUp, title: "Inventory Planning", text: "Right max levels and reorder points" },
  { icon: Wrench, title: "Repairable Spares", text: "Repair before buying new" },
  { icon: Gauge, title: "OAR Utilization", text: "Every ordered spare tracked to use" },
  { icon: MessageCircle, title: "Reservation Assistant", text: "Stock checked before you reserve" },
]

/** Sparks rising from the bottom edge: where, how big (px), how long and when (s). */
const PARTICLES = [
  { left: "8%", size: 4, duration: 9, delay: 0 },
  { left: "18%", size: 3, duration: 12, delay: 2 },
  { left: "27%", size: 5, duration: 10, delay: 4 },
  { left: "41%", size: 3, duration: 13, delay: 1 },
  { left: "55%", size: 4, duration: 11, delay: 5 },
  { left: "66%", size: 3, duration: 9, delay: 3 },
  { left: "78%", size: 5, duration: 14, delay: 6 },
  { left: "90%", size: 3, duration: 10, delay: 2.5 },
]

/** The globe's stripes, top to bottom; the pattern repeats every seven. */
const WAVES = [
  { color: "#3B7BD0", opacity: 0.35 },
  { color: "#8DC63F", opacity: 0.85 },
  { color: "#3B7BD0", opacity: 0.35 },
  { color: "#3B7BD0", opacity: 0.28 },
  { color: "#3B7BD0", opacity: 0.35 },
  { color: "#3B7BD0", opacity: 0.28 },
  { color: "#3B7BD0", opacity: 0.35 },
]

function delay(seconds: number): CSSProperties {
  return { animationDelay: `${seconds}s` }
}

/**
 * The striped globe from the Vedanta mark. Each stripe is a wave one 200-unit
 * wavelength longer than the globe on the left, so sliding the stripes right
 * by one wavelength (.aurora-waves) loops without a seam.
 */
function Globe() {
  return (
    <svg
      viewBox="0 0 700 700"
      className="aurora-globe absolute -right-[180px] -bottom-[260px] size-[760px] opacity-90"
    >
      <defs>
        <clipPath id="aurora-globe-clip">
          <circle cx="350" cy="350" r="330" />
        </clipPath>
        <radialGradient id="aurora-globe-shade" cx="35%" cy="30%" r="75%">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="1" stopColor="#021029" stopOpacity="0.75" />
        </radialGradient>
      </defs>
      <circle cx="350" cy="350" r="330" fill="#0A2E63" />
      <g clipPath="url(#aurora-globe-clip)">
        <g className="aurora-waves" fill="none" strokeWidth="22">
          {Array.from({ length: 14 }, (_, i) => {
            const wave = WAVES[i % WAVES.length]
            return (
              <path
                key={i}
                d={`M-200 ${26 + i * 52} q50 -16 100 0${" t100 0".repeat(10)}`}
                stroke={wave.color}
                strokeOpacity={wave.opacity}
              />
            )
          })}
        </g>
      </g>
      <circle cx="350" cy="350" r="330" fill="url(#aurora-globe-shade)" />
      <circle cx="350" cy="350" r="330" fill="none" stroke="#8DC63F" strokeOpacity="0.25" strokeWidth="1.5" />
    </svg>
  )
}

/** Everything behind the content: light, dots, a beam, sparks and the globe. */
function Atmosphere() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="aurora-blob-1 absolute top-[30%] -left-[10%] size-[560px] rounded-full bg-[#2E8B57] opacity-[0.32] blur-[110px]" />
      <div className="aurora-blob-2 absolute -top-[15%] right-[5%] size-[620px] rounded-full bg-[#1E6FD9] opacity-40 blur-[120px]" />
      <div className="aurora-blob-3 absolute -bottom-[25%] left-[35%] size-[520px] rounded-full bg-[#5FD0C4] opacity-[0.18] blur-[120px]" />
      <div className="aurora-dots absolute inset-0" />
      <div className="aurora-beam absolute -top-[30%] left-[20%] h-[160%] w-[220px] bg-linear-to-b from-[rgba(180,220,255,0.22)] to-transparent to-70% blur-[30px]" />
      {PARTICLES.map((p) => (
        <span
          key={p.left}
          className="aurora-particle"
          style={{
            left: p.left,
            width: p.size,
            height: p.size,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
      <Globe />
    </div>
  )
}

/**
 * The frame around /login, /signup and /forgot-password, after the "Aurora"
 * design: the pitch on the left and the form in a white card on the right; the
 * card alone below the lg breakpoint. Sized to fit a laptop screen at 100%
 * without scrolling. These pages sit outside both app trees; src/proxy.ts lets
 * them through without a session.
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
    <main
      className={cn(
        display.variable,
        text.variable,
        "aurora relative isolate flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto"
      )}
    >
      <Atmosphere />

      <div className="relative mx-auto flex w-full max-w-[1180px] flex-1 items-center justify-between gap-14 px-4 py-8 sm:px-8 lg:py-10">
        <section className="hidden max-w-[600px] min-w-0 flex-[1_1_520px] flex-col gap-[22px] lg:flex">
          <span
            className="aurora-rise inline-flex items-center gap-2.5 self-start rounded-full border border-aurora-lime/40 bg-aurora-lime/10 px-3.5 py-[7px] text-xs font-semibold tracking-[0.18em] text-aurora-lime-pale"
            style={delay(0.1)}
          >
            <span className="aurora-pulse size-[7px] rounded-full bg-aurora-lime" />
            SPARES AI
          </span>

          {/* 60px as designed on a tall screen; smaller on a short laptop screen, so nothing scrolls. */}
          <h2 className="aurora-display m-0 text-[44px] leading-[1.04] font-extrabold tracking-[-0.035em] xl:text-[clamp(44px,7.4vh,60px)]">
            <span className="aurora-rise inline-block" style={delay(0.2)}>
              Smarter&nbsp;
            </span>
            <span className="aurora-rise inline-block" style={delay(0.3)}>
              spares&nbsp;
            </span>
            <span className="aurora-rise inline-block" style={delay(0.4)}>
              decisions,
            </span>
            <br />
            <span className="aurora-rise inline-block" style={delay(0.55)}>
              <span className="aurora-gradient-text">from reservation</span>
            </span>
            <br />
            <span className="aurora-rise inline-block" style={delay(0.7)}>
              <span className="aurora-gradient-text">to repair.</span>
            </span>
          </h2>

          <p className="aurora-rise m-0 max-w-[480px] text-lg leading-[1.6] text-aurora-mist" style={delay(0.85)}>
            Planning, repairs and utilisation of spares, together in one place.
          </p>

          <ul className="mt-2.5 grid grid-cols-2 gap-3">
            {HIGHLIGHTS.map(({ icon: Icon, title: name, text: line }, i) => (
              <li key={name} className="aurora-rise" style={delay(1 + i * 0.1)}>
                <div className="aurora-tile flex h-full items-start gap-3.5 rounded-2xl border border-white/12 bg-white/5 p-4 backdrop-blur-[10px]">
                  <span className="flex size-[38px] flex-none items-center justify-center rounded-[11px] bg-aurora-lime/16 text-aurora-lime-soft">
                    <Icon aria-hidden className="size-[18px]" />
                  </span>
                  <span className="flex min-w-0 flex-col gap-[3px]">
                    <strong className="text-[15px] font-semibold">{name}</strong>
                    <span className="text-[13px] text-aurora-haze">{line}</span>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <div className="aurora-ring mx-auto w-full max-w-[440px] shrink-0 shadow-[0_40px_100px_-30px_rgba(0,0,0,0.6)] lg:mx-0">
          <section className="aurora-card relative flex flex-col gap-[22px] rounded-[27px] bg-white px-6 pt-8 pb-7 text-aurora-ink sm:px-9 sm:pt-10 sm:pb-8">
            <Image
              src="/brand/vedanta-zinc-logo.png"
              alt="Vedanta Zinc International"
              width={245}
              height={70}
              priority
              className="h-10 w-auto self-start"
            />

            <div className="flex flex-col gap-1.5">
              <h1 className="aurora-display m-0 text-[28px] leading-tight font-bold tracking-[-0.02em]">{title}</h1>
              <p className="m-0 text-sm text-aurora-muted">{description}</p>
            </div>

            <div>{children}</div>

            {footer && (
              <p data-auth-footer className="m-0 text-center text-sm text-aurora-muted">
                {footer}
              </p>
            )}
          </section>
        </div>
      </div>

      <p className="aurora-rise relative m-0 pb-5 text-center text-xs text-aurora-fog" style={delay(1.6)}>
        © Vedanta Zinc International · Spares AI
      </p>
    </main>
  )
}
