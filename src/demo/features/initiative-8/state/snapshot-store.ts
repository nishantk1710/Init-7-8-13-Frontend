"use client"

import { useMemo, useSyncExternalStore } from "react"

import { REFERENCE_DATE, plantRef } from "@demo/features/initiative-8/data/config"
import { materialRef } from "@demo/features/initiative-8/data/materials"
import {
  BASE_SNAPSHOT,
  NO_ACTIONS,
  buildSnapshot,
  type I8Snapshot,
  type SnapshotActions,
} from "@demo/features/initiative-8/model/snapshot"
import type {
  DeclarationCondition,
  DeclarationRecord,
  ExceptionEvent,
  ExceptionStatus,
  JustificationEntry,
} from "@demo/features/initiative-8/types/repair"
import type { SAPDocumentReference } from "@demo/lib/domain/contracts"

/**
 * What the viewer does on the Initiative 8 Snapshot screens — declare a part,
 * amend a declaration, record a justification, work an exception, re-run the
 * coding screen — kept for the browser session, so it shows on every screen
 * and survives a reload. Nothing is posted to SAP or the backend.
 *
 * Browser storage can be missing (private windows, blocked site data); every
 * read and write is guarded, and the screens work without it — the actions
 * then last until the page is reloaded.
 */

const STORAGE_KEY = "spares-demo-i08-actions-v1"

/** The actor every session action is recorded under. */
export const YOU = "You"

let current: SnapshotActions = NO_ACTIONS
let loaded = false
const listeners = new Set<() => void>()

function read(): SnapshotActions {
  if (!loaded) {
    loaded = true
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY)
      if (raw) current = { ...NO_ACTIONS, ...(JSON.parse(raw) as Partial<SnapshotActions>) }
    } catch {
      current = NO_ACTIONS
    }
  }
  return current
}

function write(next: SnapshotActions) {
  current = next
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Storage unavailable: keep the actions in memory for this page's life.
  }
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function serverSnapshot(): SnapshotActions {
  return NO_ACTIONS
}

export function useSnapshotActions(): SnapshotActions {
  return useSyncExternalStore(subscribe, read, serverSnapshot)
}

/** Every screen's data, with this session's actions applied. */
export function useI08Snapshot(): I8Snapshot {
  const actions = useSnapshotActions()
  return useMemo(() => (actions === NO_ACTIONS ? BASE_SNAPSHOT : buildSnapshot(actions)), [actions])
}

/** "3 Sep 2026, 14:05": the Snapshot's date, the real time of day. */
export function nowStamp(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${REFERENCE_DATE}, ${pad(now.getHours())}:${pad(now.getMinutes())}`
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export interface DeclarationInput {
  materialId: string
  plantId: string
  quantity: number
  condition: DeclarationCondition
  faultCategory: string
  conditionDescription: string
  serialNumber?: string
  evidenceReference?: string
  /** Repair lines this declaration covers. Empty: declared ahead of any repair PO. */
  repairLineIds: string[]
  sessionId?: string
}

export interface JustificationInput {
  materialId: string
  plantId: string
  acquisitionLine: SAPDocumentReference
  reasonCategory: string
  freeText: string
  exceptionId?: string
  sessionId?: string
}

function appendEvent(exceptionId: string, event: Omit<ExceptionEvent, "at" | "actor">) {
  const state = read()
  const events = state.exceptionEvents[exceptionId] ?? []
  write({
    ...state,
    exceptionEvents: {
      ...state.exceptionEvents,
      [exceptionId]: [...events, { ...event, at: nowStamp(), actor: YOU }],
    },
  })
}

function makeDeclaration(state: SnapshotActions, input: DeclarationInput): DeclarationRecord {
  const { materialId, plantId, ...rest } = input
  return {
    ...rest,
    id: `DCL-${2001 + state.declarations.length}`,
    material: materialRef(materialId),
    plant: plantRef(plantId),
    declaredBy: YOU,
    declaredAt: nowStamp(),
  }
}

export const snapshotStore = {
  /** Records a new declaration (FR-4). Locked once recorded. */
  declare(input: DeclarationInput): DeclarationRecord {
    const state = read()
    const record = makeDeclaration(state, input)
    write({ ...state, declarations: [...state.declarations, record] })
    return record
  },

  /** An audited amendment: a new record that supersedes `previous`, with the reason. */
  amend(previous: DeclarationRecord, input: DeclarationInput, reason: string): DeclarationRecord {
    const state = read()
    const record = { ...makeDeclaration(state, input), supersedes: previous.id, amendmentReason: reason }
    write({ ...state, declarations: [...state.declarations, record] })
    return record
  },

  /** Records why a new unit was bought (FR-7). */
  recordJustification(input: JustificationInput): JustificationEntry {
    const state = read()
    const { materialId, plantId, ...rest } = input
    const entry: JustificationEntry = {
      ...rest,
      id: `J-${8001 + state.justifications.length}`,
      material: materialRef(materialId),
      plant: plantRef(plantId),
      source: input.exceptionId ? "EXCEPTION" : "ASSISTANT",
      author: YOU,
      recordedAt: nowStamp(),
    }
    write({ ...state, justifications: [...state.justifications, entry] })
    return entry
  },

  assignException(exceptionId: string, owner: string) {
    appendEvent(exceptionId, { kind: "ASSIGNED", owner, text: `Assigned to ${owner}` })
  },

  commentOnException(exceptionId: string, text: string) {
    appendEvent(exceptionId, { kind: "COMMENT", text })
  },

  setExceptionStatus(exceptionId: string, status: ExceptionStatus, text: string) {
    appendEvent(exceptionId, { kind: "STATUS", status, text })
  },

  /** "Run AI screen": the verdicts are kept; the screening time moves on. */
  rescreenCodingCandidates() {
    write({ ...read(), screenedAt: nowStamp() })
  },

  /** Back to the Snapshot as shipped. */
  reset() {
    write(NO_ACTIONS)
  },
}
