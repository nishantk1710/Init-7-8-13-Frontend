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

// ---------------------------------------------------------------------------
// The chat-domain types that used to live here are gone (WS7 phase 5).
//
// ChatSession, ChatMessage, MessageRole, OptionGroupData, OptionData,
// ActionData, TraceInfo, TraceTag, WorkflowStepData, EmailNotificationData and
// EmailStatus all described the scripted mock conversation and its side
// panel. The reservation assistant types its own wire shapes against the
// backend in lib/api/assistant.ts, so none of them had a second reader.
//
// Material, Category, LifecycleStatus and IconKey above are unrelated and
// stay -- they back the material catalogue and the nav.
// ---------------------------------------------------------------------------
