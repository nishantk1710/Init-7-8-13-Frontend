// Which frontend the app serves: this branch's live frontend, or main's demo
// frontend as it was. Switched at RUNTIME, per browser, from the Data source
// toggle -- one build, one deployment, both frontends.
//
//   live   app/(live)/ + the rest of src/ -- reads the real backend
//          (NEXT_PUBLIC_API_BASE_URL), exactly as before.
//   demo   app/demo/ + src/demo/ -- main's frontend, unchanged, on its own
//          mock data. Never calls the backend.
//
// src/proxy.ts reads the cookie on every request and rewrites to the demo tree
// in demo mode, so URLs look the same in both.
//
// Why a toggle at all: the deployed app has to keep working while the Azure
// backend integration settles. Demo is the known-good fallback one click away,
// and the live-mode health check (components/shared/data-mode.tsx) offers it
// the moment the backend stops answering.
//
// NOT TO BE CONFUSED WITH lib/dataset-mode.ts, an older build-time flag that
// only decides whether the live frontend's remaining fixtures label themselves.
//
// Kept free of imports and of browser globals at module level: src/proxy.ts
// imports it too.

export type DataMode = "demo" | "live"

export const DATA_MODE_COOKIE = "spares-data-mode"

export function parseDataMode(value: string | undefined | null): DataMode | null {
  return value === "demo" || value === "live" ? value : null
}

/**
 * The mode before anybody has touched the toggle.
 *
 * Set NEXT_PUBLIC_DEFAULT_DATA_MODE=demo on a deployment whose backend is not
 * trusted yet. Unset means live, which is what local development has always
 * done -- nothing changes for anyone who does not opt in.
 */
export const DEFAULT_DATA_MODE: DataMode =
  parseDataMode(process.env.NEXT_PUBLIC_DEFAULT_DATA_MODE) ?? "live"

function readCookie(cookieHeader: string): string | undefined {
  for (const part of cookieHeader.split(";")) {
    const [name, ...value] = part.trim().split("=")
    if (name === DATA_MODE_COOKIE) return decodeURIComponent(value.join("="))
  }
  return undefined
}

/** The mode in the browser. */
export function clientDataMode(): DataMode {
  return parseDataMode(readCookie(document.cookie)) ?? DEFAULT_DATA_MODE
}

/**
 * Switch mode and load the other frontend.
 *
 * Stays on the current page when the other frontend has it too, so the same
 * screen can be compared across modes. The two frontends do not share every
 * route (main has /chat, this branch /assistant), so when the page does not
 * exist on the other side, lands on /home instead of a 404.
 */
export async function setDataMode(mode: DataMode): Promise<void> {
  const oneYear = 60 * 60 * 24 * 365
  document.cookie = `${DATA_MODE_COOKIE}=${mode}; path=/; max-age=${oneYear}; samesite=lax`
  try {
    const probe = await fetch(window.location.pathname, { method: "HEAD", cache: "no-store" })
    if (probe.ok) {
      window.location.reload()
      return
    }
  } catch {
    // Fall through to /home.
  }
  window.location.assign("/home")
}
