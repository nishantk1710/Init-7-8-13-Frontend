// Where the app's backend data comes from: the live backend, or the recorded
// demo dataset. Switched at RUNTIME, per browser, from the sidebar toggle --
// one build, one deployment, either data source.
//
//   live   every call goes to NEXT_PUBLIC_API_BASE_URL, as it always has.
//   demo   every call is answered from src/mocks/responses/ -- real responses
//          recorded from the backend (scripts/mock-data/record.mts), so the
//          screens render exactly as they do live. Nothing is written: POSTs
//          are refused with a sentence, apart from the assistant, which plays
//          a scripted conversation (src/mocks/assistant.ts).
//
// Why a toggle at all: the deployed app has to keep working while the Azure
// backend integration settles. Demo mode is the known-good fallback one click
// away, and the live-mode health check (components/shared/data-mode-banner.tsx)
// offers it the moment the backend stops answering.
//
// NOT TO BE CONFUSED WITH lib/dataset-mode.ts, which is older and different:
// that build-time flag decides whether the remaining hand-written scenario
// fixtures label themselves. This one decides whether the backend is called.
//
// The mode lives in a COOKIE rather than localStorage because server
// components fetch too, and a server only sees cookies.

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

/** The mode in the browser. Synchronous: it is only a cookie read. */
export function clientDataMode(): DataMode {
  return parseDataMode(readCookie(document.cookie)) ?? DEFAULT_DATA_MODE
}

/**
 * The mode for the current request, on either side.
 *
 * On the server this reads the request's cookie, which makes the calling route
 * dynamic -- necessary, since the same URL renders different data per mode.
 * Next's own control-flow errors (the one that marks a route dynamic during a
 * build) are rethrown untouched; swallowing it would prerender the page with
 * one mode baked in and the toggle would silently stop working there.
 */
export async function currentDataMode(): Promise<DataMode> {
  if (typeof window !== "undefined") return clientDataMode()
  const [{ cookies }, { unstable_rethrow }] = await Promise.all([
    import("next/headers"),
    import("next/navigation"),
  ])
  try {
    const store = await cookies()
    return parseDataMode(store.get(DATA_MODE_COOKIE)?.value) ?? DEFAULT_DATA_MODE
  } catch (error) {
    unstable_rethrow(error)
    // Outside a request altogether (a test, a script): there is no cookie.
    return DEFAULT_DATA_MODE
  }
}

/** Switch mode and reload, so server and client both refetch in the new mode. */
export function setDataMode(mode: DataMode): void {
  const oneYear = 60 * 60 * 24 * 365
  document.cookie = `${DATA_MODE_COOKIE}=${mode}; path=/; max-age=${oneYear}; samesite=lax`
  window.location.reload()
}
