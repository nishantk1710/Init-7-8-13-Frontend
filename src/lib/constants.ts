import {
  Cpu,
  MessageCircle,
  Search,
  ChartBar,
  ClipboardCheck,
  History,
  Droplet,
  ArrowLeftRight,
  Wrench,
  Gauge,
  Settings,
  CircleQuestionMark,
  Copy,
  SlidersHorizontal,
  Lightbulb,
  Send,
  Eye,
  FileText,
  Check,
  Info,
  TrendingDown,
  TrendingUp,
  Mail,
  Clock,
  TriangleAlert,
  EllipsisVertical,
  CircleCheck,
  Layers,
  Package,
  RotateCcw,
  Activity,
  LayoutDashboard,
  Inbox,
  CircleX,
  type LucideIcon,
} from "lucide-react"

import type { Category, IconKey } from "@/lib/types"
import { initiative7Manifest } from "@/features/initiative-7/manifest"
import { initiative8Manifest } from "@/features/initiative-8/manifest"
import { initiative13Manifest } from "@/features/initiative-13/manifest"

export const ICONS: Record<IconKey, LucideIcon> = {
  cpu: Cpu,
  "message-circle": MessageCircle,
  search: Search,
  "chart-bar": ChartBar,
  "clipboard-check": ClipboardCheck,
  history: History,
  droplet: Droplet,
  "arrows-right-left": ArrowLeftRight,
  wrench: Wrench,
  gauge: Gauge,
  settings: Settings,
  help: CircleQuestionMark,
  copy: Copy,
  sliders: SlidersHorizontal,
  lightbulb: Lightbulb,
  send: Send,
  eye: Eye,
  "file-text": FileText,
  check: Check,
  info: Info,
  "trending-down": TrendingDown,
  "trending-up": TrendingUp,
  mail: Mail,
  clock: Clock,
  "alert-triangle": TriangleAlert,
  "ellipsis-vertical": EllipsisVertical,
  "check-circle": CircleCheck,
  layers: Layers,
  package: Package,
  "rotate-ccw": RotateCcw,
  activity: Activity,
  "layout-dashboard": LayoutDashboard,
  inbox: Inbox,
  cancel: CircleX,
}

export const CATEGORIES: { label: Category; icon: IconKey }[] = [
  { label: "Flotation", icon: "droplet" },
  { label: "Conveyance", icon: "arrows-right-left" },
  { label: "Milling", icon: "wrench" },
  { label: "Instrumentation", icon: "gauge" },
]

/**
 * Fixed categorical identity color per plant area — validated for CVD/contrast
 * (dataviz skill, 4-slot categorical palette). Assigned by entity, never by
 * rank, so a filtered view can't repaint the survivors.
 */
export const CATEGORY_COLORS: Record<Category, string> = {
  Milling: "var(--chart-1)",
  Conveyance: "var(--chart-2)",
  Flotation: "var(--chart-3)",
  Instrumentation: "var(--chart-4)",
}

/** Sidebar nav sections owned by Initiative 7/8/13 — sourced directly from
 * each initiative's manifest so this file never needs another edit once a
 * manifest's page list is final. */
export const INITIATIVE_NAV_SECTIONS = [
  initiative7Manifest.navSection,
  initiative8Manifest.navSection,
  initiative13Manifest.navSection,
]

export const QUICK_ACTIONS: {
  label: string
  icon: IconKey
  href: string
  badge?: number
}[] = [
  {
    label: "Home",
    icon: "layout-dashboard",
    href: "/home",
  },
  { label: "Search materials", icon: "search", href: "/materials" },
  // Pending items across every module surface in the Action Center, which
  // links straight into each module's own action surface.
  { label: "Action Center", icon: "inbox", href: "/actions" },
  // Decisions waiting on someone specifically — a filtered, decision-shaped
  // view over the same underlying items as the Action Center.
  { label: "Approvals", icon: "clipboard-check", href: "/approvals" },
  { label: "Audit trail", icon: "history", href: "/audit" },
]

/**
 * The Spares Assistant's suggested-question chips — one flat list, always
 * shown. There is deliberately no "pick a module first" selector: the
 * assistant routes each question to the right area internally (see
 * `chat-workspace.tsx`'s intent handling in `handleSend`), the same way a
 * user would never be asked to choose which module to talk to.
 */
export const SUGGESTED_QUESTIONS: string[] = [
  "Which critical spares are at risk?",
  "What needs my approval?",
  "Is this material OAR or non-OAR?",
  "Why is the recommended ROP for this material higher?",
  "Do we already have this material under repair?",
  "Which repairs are overdue?",
  "Which OAR materials are overdue?",
  "Do we have this material available at another plant?",
]

export const DEFAULT_SESSION_ID = "SPR-2847"

/** Hardcoded blank chat opened by the sidebar "New session" button (mock). */
export const NEW_SESSION_ID = "SPR-2900"
