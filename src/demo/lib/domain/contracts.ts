// Shared cross-initiative domain contracts — the ONLY types Initiative 7, 8
// and 13 may use to talk to each other or to the global shell. Keep this
// file small and stable: it is frozen after initial scaffolding.
// Initiative-specific fields belong in each initiative's own
// `features/initiative-N/types/*`, never here.

export type InitiativeId = "initiative-7" | "initiative-8" | "initiative-13"

export interface MaterialReference {
  materialId: string
  materialCode: string
  description: string
}

export interface PlantReference {
  plantId: string
  name: string
}

export interface SAPDocumentReference {
  type: "RR" | "RESERVATION" | "PR" | "PO" | "GR" | "GI"
  documentNumber: string
  line?: string
}

export type ActionSeverity = "info" | "warning" | "critical"

export interface GlobalAction {
  id: string
  initiative: InitiativeId
  title: string
  severity: ActionSeverity
  entityId?: string
  materialId?: string
  plantId?: string
  href: string
  createdAt: string
  dueAt?: string
}

export interface AuditEvent {
  id: string
  initiative: InitiativeId
  entityId: string
  eventType: string
  description: string
  actor?: string
  timestamp: string
}

export type InitiativeHealth = "healthy" | "attention" | "critical"

export interface InitiativeSummaryMetric {
  label: string
  value: string | number
  trend?: string
}

export interface InitiativeSummary {
  id: InitiativeId
  label: string
  href: string
  health: InitiativeHealth
  metrics: InitiativeSummaryMetric[]
  actions: GlobalAction[]
}

/**
 * What an initiative optionally contributes about one material to the
 * global Material 360 drawer — pure presentation data, never business logic.
 * Returns null when the initiative has no signal for that material.
 */
export interface Material360Signal {
  initiative: InitiativeId
  label: string
  href: string
  status: InitiativeHealth | "neutral"
  lines: { label: string; value: string }[]
}
