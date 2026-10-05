/**
 * Where demo sessions live: this browser's localStorage, and nowhere else.
 *
 * Not a server: a mock held in a Next.js route handler would lose its state
 * between instances, and nothing here may reach the backend's append-only
 * tables. The two seeded sessions are always present; a run started here is
 * added beside them, and a change to a seeded one (a simulated reservation) is
 * stored over it.
 *
 * Every read and write is wrapped: storage can be missing (private windows,
 * blocked site data) and the demo must still run, just without remembering.
 */

import { seededRuns, type DemoRun } from "@/lib/assistant/demo/script"

const KEY = "spares-assistant-demo-runs-v1"
const EVENT = "spares-assistant-demo-change"

/** Kept in memory as well, so a browser without storage still finishes a run. */
let memory: Record<string, DemoRun> | null = null

function read(): Record<string, DemoRun> {
  if (memory) return memory
  try {
    const raw = window.localStorage.getItem(KEY)
    memory = raw ? (JSON.parse(raw) as Record<string, DemoRun>) : {}
  } catch {
    memory = {}
  }
  return memory
}

function write(runs: Record<string, DemoRun>): void {
  memory = runs
  try {
    window.localStorage.setItem(KEY, JSON.stringify(runs))
  } catch {
    // Storage refused. The run carries on from memory for this page.
  }
  try {
    window.dispatchEvent(new Event(EVENT))
  } catch {
    // No window (tests). Nothing is listening.
  }
}

/** Every demo session, newest first. */
export function allRuns(): DemoRun[] {
  const stored = read()
  const byId = new Map<string, DemoRun>()
  for (const run of seededRuns()) byId.set(run.sessionId, run)
  for (const run of Object.values(stored)) byId.set(run.sessionId, run)
  return [...byId.values()].sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))
}

export function getRun(sessionId: string): DemoRun | undefined {
  return allRuns().find((run) => run.sessionId === sessionId.trim().toUpperCase())
}

export function saveRun(run: DemoRun): void {
  write({ ...read(), [run.sessionId]: run })
}

/** Forget everything run in this browser. The seeded two come back as they were. */
export function resetRuns(): void {
  write({})
}

/** Called whenever a demo session changes, in this tab. */
export function subscribe(listener: () => void): () => void {
  window.addEventListener(EVENT, listener)
  return () => window.removeEventListener(EVENT, listener)
}
