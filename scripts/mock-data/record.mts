/**
 * Records real backend responses as the app's demo dataset.
 *
 * Demo mode (src/lib/data-mode.ts) never talks to the backend: it answers every
 * request from ONE file, src/mocks/demo-dataset.json. That file is built here,
 * from responses recorded off the real backend serving its seeded extracts, so
 * demo mode shows real SAP-shaped data in exactly the wire format the screens
 * already parse -- nothing is written by hand, and nothing is synthetic.
 *
 * Raw recordings land in .mock-recordings/ (gitignored, one file per request,
 * and large). Only the small bundle is committed.
 *
 * Four steps, in order (see docs-eng/demo-mode.md for the full walkthrough):
 *
 *   1. proxy   node scripts/mock-data/record.mts proxy
 *              Listens on :8765, forwards to the backend on :8000, and saves
 *              every successful GET. Point a dev server at it:
 *                NEXT_PUBLIC_API_BASE_URL=http://localhost:8765/api \
 *                NEXT_PUBLIC_DEFAULT_DATA_MODE=live npx next dev -p 3100
 *
 *   2. crawl   node scripts/mock-data/record.mts crawl http://localhost:3100
 *              Loads every route in a headless browser so both server- and
 *              client-side fetches go through the proxy. Then click through
 *              anything interactive you want covered (filters, tabs) by hand.
 *
 *   3. seed    node scripts/mock-data/record.mts seed
 *              Fetches the detail endpoints for ids found in the recorded
 *              lists, so opening a row works in demo mode too.
 *
 *   4. bundle  node scripts/mock-data/record.mts bundle
 *              Writes src/mocks/demo-dataset.json: BUNDLE_ROWS rows per list,
 *              the first page only, and the detail responses of exactly the
 *              rows kept -- so every row on a demo screen opens.
 *
 * Only GETs are recorded. Every POST in this backend writes to an append-only
 * table, and a demo dataset is not worth permanent rows in somebody's database.
 */

import { createHash } from "node:crypto"
import { spawn } from "node:child_process"
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { createServer } from "node:http"
import path from "node:path"

import { mockKey } from "../../src/mocks/key.ts"
import type { RecordedResponse } from "../../src/mocks/types.ts"

const ROOT = path.resolve(import.meta.dirname, "../..")
const OUT = path.join(ROOT, ".mock-recordings")
const BUNDLE = path.join(ROOT, "src/mocks/demo-dataset.json")
const BACKEND = process.env.MOCK_BACKEND_URL ?? "http://localhost:8000"
const API_PREFIX = "/api"
const PORT = Number(process.env.MOCK_PROXY_PORT ?? 8765)
/** Who the recorder says it is. Reads are logged on some routes. */
const ACTOR = "MOCK-DATA-RECORDER"

const KEPT_HEADERS = ["x-total-count", "content-disposition", "retry-after"]

type Row = Record<string, unknown>

/** The envelope fields list responses carry their rows under. */
const LIST_FIELDS = ["items", "rows", "data", "results", "recommendations", "sessions", "reports"]

function fileFor(key: string): string {
  const slug = key
    .replace(/^GET \//, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80)
  const hash = createHash("sha1").update(key).digest("hex").slice(0, 8)
  return path.join(OUT, `${slug || "root"}-${hash}.json`)
}

/** Strip the /api prefix: the frontend's paths are relative to API_BASE_URL. */
function apiPath(url: string): string {
  return url.startsWith(API_PREFIX) ? url.slice(API_PREFIX.length) || "/" : url
}

async function save(pathWithQuery: string, response: Response): Promise<RecordedResponse | null> {
  if (!response.ok) return null
  const contentType = response.headers.get("content-type") ?? "application/json"
  const isJson = contentType.includes("json")
  const bytes = Buffer.from(await response.arrayBuffer())
  const body: unknown = isJson ? capRows(JSON.parse(bytes.toString("utf8"))) : bytes.toString("base64")
  const headers: Record<string, string> = {}
  for (const name of KEPT_HEADERS) {
    const value = response.headers.get(name)
    if (value !== null) headers[name] = value
  }
  const recorded: RecordedResponse = {
    key: mockKey("GET", pathWithQuery),
    status: response.status,
    contentType,
    headers,
    body,
    ...(isJson ? {} : { encoding: "base64" as const }),
  }
  write(recorded)
  return recorded
}

function write(recorded: RecordedResponse): void {
  mkdirSync(OUT, { recursive: true })
  // Minified: these are data, not something anyone reviews line by line.
  writeFileSync(fileFor(recorded.key), JSON.stringify(recorded) + "\n")
}

/**
 * Rows kept per raw recording. A few routes return their whole population when
 * asked without a limit -- /i13/reclassification is 18 MB -- and even the
 * gitignored raw folder should not hold that.
 */
const MAX_ROWS = Number(process.env.MOCK_MAX_ROWS ?? 1000)

const TOTAL_FIELDS = ["total", "total_count", "totalCount", "count"]

/**
 * Keep the first `limit` rows of a list body. With `adjustTotals`, a reported
 * total is clamped to the same limit, so a screen's "N of M" and any
 * page-until-total loop agree with what the bundle actually holds.
 */
function capRows(body: unknown, limit = MAX_ROWS, adjustTotals = false): unknown {
  if (Array.isArray(body)) return body.slice(0, limit)
  if (body && typeof body === "object") {
    const envelope = body as Row
    for (const field of LIST_FIELDS) {
      const value = envelope[field]
      if (!Array.isArray(value)) continue
      const next: Row = { ...envelope, [field]: value.slice(0, limit) }
      if (adjustTotals) {
        for (const name of TOTAL_FIELDS) {
          if (typeof next[name] === "number") next[name] = Math.min(next[name] as number, limit)
        }
      }
      return next
    }
  }
  return body
}

async function fetchBackend(pathWithQuery: string): Promise<Response> {
  return fetch(`${BACKEND}${API_PREFIX}${pathWithQuery}`, {
    headers: { "X-Actor-Id": ACTOR, Accept: "application/json" },
  })
}

// --- 1. proxy ---------------------------------------------------------------

function proxy(): void {
  const server = createServer(async (req, res) => {
    const cors = {
      "Access-Control-Allow-Origin": req.headers.origin ?? "*",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Expose-Headers": "X-Total-Count, Content-Disposition, Retry-After",
    }
    if (req.method === "OPTIONS") {
      res.writeHead(204, cors).end()
      return
    }
    if (req.method !== "GET") {
      // Refused rather than forwarded: see the note at the top of the file.
      res
        .writeHead(405, { ...cors, "Content-Type": "application/json" })
        .end(JSON.stringify({ detail: "The mock-data recorder only forwards GETs." }))
      return
    }
    const target = apiPath(req.url ?? "/")
    try {
      const upstream = await fetchBackend(target)
      const copy = upstream.clone()
      const recorded = await save(target, copy)
      console.log(`${recorded ? "saved" : `skip ${upstream.status}`}  GET ${target}`)
      const headers: Record<string, string> = { ...cors }
      upstream.headers.forEach((value, name) => {
        if (!["content-encoding", "content-length", "transfer-encoding", "connection"].includes(name)) {
          headers[name] = value
        }
      })
      res.writeHead(upstream.status, headers).end(Buffer.from(await upstream.arrayBuffer()))
    } catch (error) {
      console.error(`fail   GET ${target}: ${String(error)}`)
      res.writeHead(502, cors).end()
    }
  })
  server.listen(PORT, () => console.log(`recording proxy on :${PORT} -> ${BACKEND}`))
}

// --- 2. crawl ---------------------------------------------------------------

function routes(): string[] {
  const app = path.join(ROOT, "src/app")
  const found: string[] = []
  const walk = (dir: string, route: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        if (entry.name === "page.tsx") found.push(route || "/")
        continue
      }
      // Dynamic segments are covered by seed, from real ids.
      if (entry.name.startsWith("[")) continue
      walk(path.join(dir, entry.name), `${route}/${entry.name}`)
    }
  }
  walk(app, "")
  return found.sort()
}

function browserPath(): string {
  const candidates = [
    process.env.MOCK_BROWSER,
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "/usr/bin/google-chrome",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ]
  const found = candidates.find((candidate) => candidate && existsSync(candidate))
  if (!found) throw new Error("No Chromium browser found; set MOCK_BROWSER to one.")
  return found
}

function load(browser: string, url: string): Promise<void> {
  return new Promise((resolve) => {
    // --virtual-time-budget lets client-side effects (and their fetches)
    // settle before the DOM is dumped and the browser exits.
    const child = spawn(
      browser,
      ["--headless=new", "--disable-gpu", "--no-first-run", "--virtual-time-budget=30000", "--dump-dom", url],
      { stdio: ["ignore", "ignore", "ignore"] }
    )
    const timer = setTimeout(() => child.kill(), 90_000)
    child.on("exit", () => {
      clearTimeout(timer)
      resolve()
    })
  })
}

async function crawl(base: string, extra: string[]): Promise<void> {
  const browser = browserPath()
  for (const route of [...routes(), ...extra]) {
    process.stdout.write(`crawl  ${route} ... `)
    await load(browser, `${base}${route}`)
    console.log("done")
  }
}

// --- 3. seed ----------------------------------------------------------------

function recorded(): RecordedResponse[] {
  if (!existsSync(OUT)) return []
  return readdirSync(OUT)
    .filter((name) => name.endsWith(".json"))
    .map((name) => JSON.parse(readFileSync(path.join(OUT, name), "utf8")) as RecordedResponse)
}

/** Rewrite every recording through capRows and minified JSON. */
function compact(): void {
  const all = recorded()
  for (const response of all) {
    write(response.encoding ? response : { ...response, body: capRows(response.body) })
  }
  console.log(`compact: rewrote ${all.length} recordings`)
}

/** The rows of a list response, whichever envelope the route uses. */
function rowsOf(body: unknown): Row[] {
  if (Array.isArray(body)) return body as Row[]
  if (body && typeof body === "object") {
    for (const field of LIST_FIELDS) {
      const value = (body as Row)[field]
      if (Array.isArray(value)) return value as Row[]
    }
  }
  return []
}

function pick(row: Row, ...names: string[]): string | undefined {
  for (const name of names) {
    const value = row[name]
    if (typeof value === "string" || typeof value === "number") return String(value)
  }
  return undefined
}

const enc = encodeURIComponent

/** I08 rows nest identity: `material: {materialId}`, `plant: {plantId}`. */
function i8Material(row: Row): string | undefined {
  const material = row.material
  return material && typeof material === "object" ? pick(material as Row, "materialId") : pick(row, "materialId")
}

function i8Plant(row: Row): string | undefined {
  const plant = row.plant
  return plant && typeof plant === "object" ? pick(plant as Row, "plantId") : pick(row, "plant")
}

/**
 * For each recorded list, the detail routes a row on it links to.
 * Keyed by the list's pathname; the function gets one row.
 */
const DETAIL_ROUTES: Record<string, (row: Row) => string[]> = {
  "/v1/i7/recommendations": (row) => {
    const id = pick(row, "id", "recommendation_id", "recommendationId")
    if (!id) return []
    const base = `/v1/i7/recommendations/${enc(id)}`
    return [base, `${base}/trace`, `${base}/forecast-history`, `${base}/workflow-state`, `${base}/approval-history`, `${base}/adoption`]
  },
  "/v1/i7/reports/quarterly": (row) => {
    const quarter = pick(row, "quarter")
    return quarter ? [`/v1/i7/reports/quarterly/${enc(quarter)}`, `/v1/i7/reports/quarterly/${enc(quarter)}/status`, `/v1/i7/reports/quarterly/${enc(quarter)}/export`] : []
  },
  "/i8/register": (row) => {
    // The row id is `{EBELN}-{EBELP}`, split on the LAST hyphen, exactly as
    // features/initiative-8/data/live-repair-detail.ts does.
    const id = pick(row, "id") ?? ""
    const cut = id.lastIndexOf("-")
    const material = i8Material(row)
    const plant = i8Plant(row)
    return [
      ...(cut > 0 ? [`/i8/register/${enc(id.slice(0, cut))}/${enc(id.slice(cut + 1))}`] : []),
      ...(material ? [`/i8/universe/${enc(material)}`] : []),
      ...(material && plant ? [`/i8/repairable-unit?material=${enc(material)}&plant=${enc(plant)}`] : []),
    ]
  },
  "/i8/universe": (row) => {
    const material = i8Material(row)
    return material ? [`/i8/universe/${enc(material)}`] : []
  },
  "/i13/ledger": (row) => {
    const id = pick(row, "ledger_id", "ledgerId", "id")
    return id ? [`/i13/ledger/${enc(id)}`] : []
  },
  "/i13/act/exceptions": (row) => {
    const id = pick(row, "exception_id", "exceptionId", "id")
    return id ? [`/i13/act/exceptions/${enc(id)}`, `/i13/act/exceptions/${enc(id)}/history`] : []
  },
  "/i13/act/utilisation": (row) => {
    const material = pick(row, "material", "material_id", "materialId")
    const plant = pick(row, "plant")
    return material && plant ? [`/i13/act/utilisation/${enc(material)}/${enc(plant)}`] : []
  },
  "/i13/usage-patterns": (row) => {
    const material = pick(row, "material", "material_id", "materialId")
    const plant = pick(row, "plant")
    return material && plant ? [`/i13/usage-patterns/${enc(material)}/${enc(plant)}`] : []
  },
  "/assistant/sessions": (row) => {
    const id = pick(row, "sessionId", "session_id")
    return id ? [`/assistant/sessions/${enc(id)}`] : []
  },
}

/** Rows per list in the committed bundle -- and so rows whose details are recorded. */
const BUNDLE_ROWS = Number(process.env.MOCK_BUNDLE_ROWS ?? 20)

/** The detail routes the first `limit` rows of each list link to. */
function detailTargets(responses: RecordedResponse[], limit: number): Set<string> {
  const wanted = new Set<string>()
  for (const response of responses) {
    const pathname = response.key.replace(/^GET /, "").split("?")[0]
    const detail = DETAIL_ROUTES[pathname]
    if (!detail) continue
    for (const row of rowsOf(response.body).slice(0, limit)) {
      for (const target of detail(row)) wanted.add(target)
    }
  }
  return wanted
}

async function seed(): Promise<void> {
  const all = recorded()
  const have = new Set(all.map((r) => r.key))
  const wanted = detailTargets(all, BUNDLE_ROWS)
  const todo = [...wanted].filter((target) => !have.has(mockKey("GET", target)))
  console.log(`seed: ${todo.length} detail routes to record (${wanted.size - todo.length} already present)`)
  for (const target of todo) {
    const response = await fetchBackend(target)
    const saved = await save(target, response)
    console.log(`${saved ? "saved" : `skip ${response.status}`}  GET ${target}`)
  }
}

// --- 4. bundle --------------------------------------------------------------

/** A request for a page beyond the first. The bundle keeps first pages only. */
function isLaterPage(key: string): boolean {
  const params = new URLSearchParams(key.split("?")[1] ?? "")
  return Number(params.get("page") ?? "1") > 1 || Number(params.get("offset") ?? "0") > 0
}

function bundle(): void {
  const all = recorded()
  const lists = all.filter((r) => !isLaterPage(r.key))

  // A detail recording is kept only when a row that survives the trim links to
  // it; one reachable only from a trimmed-away row would be dead weight.
  const reachable = new Set([...detailTargets(all, Infinity)].map((t) => mockKey("GET", t)))
  const kept = new Set([...detailTargets(lists, BUNDLE_ROWS)].map((t) => mockKey("GET", t)))

  const recordings = lists
    .filter((r) => !reachable.has(r.key) || kept.has(r.key))
    .map((r): RecordedResponse => {
      if (r.encoding) return r
      const body = capRows(r.body, BUNDLE_ROWS, true)
      const headers = { ...r.headers }
      if ("x-total-count" in headers) {
        headers["x-total-count"] = String(Math.min(Number(headers["x-total-count"]), BUNDLE_ROWS))
      }
      return { ...r, body, headers }
    })
    .sort((a, b) => a.key.localeCompare(b.key))

  writeFileSync(
    BUNDLE,
    JSON.stringify({ rowsPerList: BUNDLE_ROWS, recordings }) + "\n"
  )
  const size = (readFileSync(BUNDLE).length / 1024).toFixed(0)
  console.log(`bundle: ${recordings.length} of ${all.length} recordings, ${size} KB -> ${path.relative(ROOT, BUNDLE)}`)
}

// ---------------------------------------------------------------------------

const [command, ...rest] = process.argv.slice(2)
if (command === "proxy") proxy()
else if (command === "crawl") await crawl(rest[0] ?? "http://localhost:3100", rest.slice(1))
else if (command === "seed") await seed()
else if (command === "compact") compact()
else if (command === "bundle") bundle()
else {
  console.error("usage: record.mts proxy | crawl <base-url> [extra routes...] | seed | compact | bundle")
  process.exit(1)
}
