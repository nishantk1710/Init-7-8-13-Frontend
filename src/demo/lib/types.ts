// Domain types for the Spares AI mockup. All data is mock/local — see mock-data.ts.

export type Category = "Flotation" | "Conveyance" | "Milling" | "Instrumentation"

export type LifecycleStatus = "Active" | "EOL" | "Obsolete"

export interface Material {
  id: string // material code, format 500-XXXXX
  description: string
  manufacturer: string
  manufacturerPartNo: string
  specs: Record<string, string>
  category: Category
  lifecycleStatus: LifecycleStatus
  lastPoPrice: number // ZAR
  lastPoDate: string // pre-formatted "DD MMM YYYY"
  lastVendor: string
  stockLevel: number
  leadTimeDays: number
}

// ---- Chat domain ----

export type MessageRole = "user" | "ai"

/** Key into the ICONS registry in constants.ts */
export type IconKey =
  | "cpu"
  | "message-circle"
  | "search"
  | "chart-bar"
  | "clipboard-check"
  | "history"
  | "droplet"
  | "arrows-right-left"
  | "wrench"
  | "gauge"
  | "settings"
  | "help"
  | "copy"
  | "sliders"
  | "lightbulb"
  | "send"
  | "eye"
  | "file-text"
  | "check"
  | "info"
  | "trending-down"
  | "trending-up"
  | "mail"
  | "clock"
  | "alert-triangle"
  | "ellipsis-vertical"
  | "check-circle"
  | "layers"
  | "package"
  | "rotate-ccw"
  | "activity"
  | "layout-dashboard"
  | "inbox"
  | "cancel"

export interface ChatOption {
  id: string
  icon: IconKey
  label: string
  description: string
}

export interface OptionGroupData {
  id: string
  options: ChatOption[]
  /** the suggested default (live groups) or the final answer (locked groups) */
  defaultSelectedId?: string
  /** true = already answered when the session was authored; always disabled */
  locked?: boolean
  /** historical confirmation timestamp, used only when locked */
  resolvedAt?: string
  /** if true, resolving this (via a live click) advances the workflow stepper */
  advancesWorkflow?: boolean
}

export interface ActionOptionsData {
  id: string
  actions: ChatOption[]
  /** id of the action styled with a permanent success accent, e.g. "proceed" */
  accentId?: string
  /** set when this action was already taken earlier in the session's history */
  resolvedActionId?: string
}

export interface ChatMessage {
  id: string
  role: MessageRole
  timestamp: string // pre-formatted "10:23 AM"
  authorLabel: string // "You" | "Spares Assistant"
  text?: string // supports **bold** lite markdown
  /** materialId — renders the Material Assistant's classification card inline, in-transcript. */
  classification?: string
  options?: OptionGroupData
  actions?: ActionOptionsData
  footerNote?: string
}

export type WorkflowStepStatus = "done" | "active" | "pending"

export interface WorkflowStepData {
  id: string
  label: string
  status: WorkflowStepStatus
  meta?: string
  /** visual tone override for the active step, e.g. escalated/overdue */
  tone?: "default" | "warning" | "danger"
}

export type EmailStatus = "sent" | "pending" | "escalated"

export interface EmailNotificationData {
  id: string
  status: EmailStatus
  text: string
  time: string
}

export interface TraceTag {
  label: string
  kind: "cat" | "tier" | "status"
}

export interface TraceInfo {
  tags: TraceTag[]
  material: string
  equipment: string
  requester: string
  specMatch: string
  selectionsDone: number
  selectionsTotal: number
}

export type SessionStatus =
  | "in_progress"
  | "pending_approval"
  | "escalated"
  | "completed"
  | "new"

export interface NavBadge {
  type: "count" | "alert"
  value?: number
}

export interface ChatSession {
  id: string // e.g. "SPR-2847"
  title: string // full chat header title
  navLabel: string // short sidebar label
  navSubtitle: string
  navBadge?: NavBadge
  category: Category
  status: SessionStatus
  materialId: string
  requester: string
  date: string // pre-formatted "DD MMM YYYY" — when the session was opened
  messages: ChatMessage[]
  workflow: WorkflowStepData[]
  emails: EmailNotificationData[]
  trace: TraceInfo
}

