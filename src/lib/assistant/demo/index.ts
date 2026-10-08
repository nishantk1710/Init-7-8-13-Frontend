/**
 * The demo's stand-ins for the assistant routes. **Temporary** -- see `flag.ts`.
 *
 * Same signatures and the same response shapes as the live calls in
 * `lib/api/assistant.ts`, which branch here when the flag is on, so no
 * component has to know which it is talking to. Each call waits a moment, so
 * the conversation's "thinking" state shows as it does against the backend.
 */

import { ApiError } from "@/lib/api/client"
import type {
  AnswerResponse,
  MaterialSearchResponse,
  SessionListResponse,
  SessionTraceResponse,
  StartSessionRequest,
  StartSessionResponse,
} from "@/lib/api/assistant"
import { searchDemoMaterials } from "@/lib/assistant/demo/catalogue"
import { mintDemoSessionId } from "@/lib/assistant/demo/ids"
import {
  answerDemoRun,
  linkDemoReservation,
  startDemoRun,
  summaryOf,
  traceOf,
  unlinkDemoReservations,
} from "@/lib/assistant/demo/script"
import { allRuns, getRun, resetRuns, saveRun } from "@/lib/assistant/demo/store"

function pause(min = 450, max = 800): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, min + Math.random() * (max - min)))
}

function now(): string {
  return new Date().toISOString()
}

function notFound(sessionId: string): ApiError {
  return new ApiError(
    `session ${sessionId} not found`,
    404,
    undefined,
    `Session ${sessionId} was not found.`
  )
}

export async function searchMaterials(q: string): Promise<MaterialSearchResponse> {
  await pause(150, 300)
  return searchDemoMaterials(q)
}

export async function startSession(body: StartSessionRequest): Promise<StartSessionResponse> {
  await pause()
  const { run, response } = startDemoRun(body, { sessionId: mintDemoSessionId(), now: now() })
  // Stored the moment it is minted, as live writes the row: a reload lands on
  // the trace, which has to be able to find it.
  if (run) saveRun(run)
  return response
}

export async function postTurn(
  sessionId: string,
  answer: Record<string, unknown>
): Promise<AnswerResponse> {
  await pause()
  const run = getRun(sessionId)
  if (!run) throw notFound(sessionId)
  const result = answerDemoRun(run, answer, now())
  saveRun(result.run)
  return result.response
}

export function getSession(sessionId: string): SessionTraceResponse {
  const run = getRun(sessionId)
  if (!run) throw notFound(sessionId)
  return traceOf(run, now())
}

export function listSessions(): SessionListResponse {
  const runs = allRuns()
  return {
    items: runs.map((run) => summaryOf(run, now())),
    total: runs.length,
    note: "",
  }
}

/** The simulated SAP reservation: SGTXT = the session ID. One per session. */
export async function simulateReservation(sessionId: string): Promise<string> {
  await pause(300, 500)
  const run = getRun(sessionId)
  if (!run) throw notFound(sessionId)
  if (run.linkedReservations.length > 0) return run.linkedReservations[0].reservationNumber
  const taken = allRuns().reduce((count, r) => count + r.linkedReservations.length, 0)
  const number = String(99000001 + taken)
  saveRun(linkDemoReservation(run, number, now()))
  return number
}

export async function removeReservations(sessionId: string): Promise<void> {
  await pause(200, 350)
  const run = getRun(sessionId)
  if (!run) throw notFound(sessionId)
  saveRun(unlinkDemoReservations(run))
}

export function resetDemo(): void {
  resetRuns()
}
