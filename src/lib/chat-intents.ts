// The Spares Assistant's business-question intent routing (§30-31) — the
// user is never asked to pick a module; free text is matched against
// keyword buckets and answered from the same selectors that already feed
// Home/Action Center/Approvals. No invented numbers: every answer reads
// real data, or says plainly that there's none.

import { getInitiative7GlobalActions } from "@/features/initiative-7/selectors/global-actions"
import { getInitiative8GlobalActions } from "@/features/initiative-8/selectors/global-actions"
import { getInitiative13GlobalActions } from "@/features/initiative-13/selectors/global-actions"
import { getInitiative7Material360Signal } from "@/features/initiative-7/selectors/material-360-adapter"
import { getInitiative8Material360Signal } from "@/features/initiative-8/selectors/material-360-adapter"
import { getInitiative13Material360Signal } from "@/features/initiative-13/selectors/material-360-adapter"
import { isOARMaterial } from "@/features/initiative-13/selectors/oar-lookup"
import { getPendingApprovals } from "@/lib/approvals"

export type BusinessIntent = "stock" | "repair" | "oar" | "approval"

const KEYWORDS: Record<BusinessIntent, string[]> = {
  approval: ["my approval", "needs approval", "waiting for my decision", "pending approval", "approvals"],
  repair: ["under repair", "repair chain", "overdue repair", "repairs are overdue", "duplicate procurement", "coming back"],
  oar: ["oar material", "oar materials", "planned use", "planned consumption", "redeploy", "unused stock", "another plant"],
  stock: ["critical spares", "at risk", "stock-out", "stockout", "excess stock", "excess inventory", "reorder point", " rop "],
}

function includesAny(haystack: string, needles: string[]): boolean {
  return needles.some((n) => haystack.includes(n))
}

/** General, module-agnostic business questions — no specific material named. */
export function classifyIntent(text: string): BusinessIntent | null {
  const lower = ` ${text.toLowerCase()} `
  if (includesAny(lower, KEYWORDS.approval)) return "approval"
  if (includesAny(lower, KEYWORDS.repair)) return "repair"
  if (includesAny(lower, KEYWORDS.oar)) return "oar"
  if (includesAny(lower, KEYWORDS.stock)) return "stock"
  return null
}

export function answerForIntent(intent: BusinessIntent): string {
  switch (intent) {
    case "stock": {
      const actions = getInitiative7GlobalActions()
      if (actions.length === 0) return "Nothing is flagged for inventory planning right now — no materials need review."
      const top = actions.slice(0, 3).map((a) => `• ${a.title}`).join("\n")
      return `${actions.length} inventory item${actions.length === 1 ? "" : "s"} need review right now:\n\n${top}\n\nSee Inventory Planning for the full list.`
    }
    case "repair": {
      const actions = getInitiative8GlobalActions()
      if (actions.length === 0) return "No open repair-related items right now — nothing overdue or flagged."
      const top = actions.slice(0, 3).map((a) => `• ${a.title}`).join("\n")
      return `${actions.length} repair-related item${actions.length === 1 ? "" : "s"} need attention:\n\n${top}\n\nSee Repairable Spares for the full list.`
    }
    case "oar": {
      const actions = getInitiative13GlobalActions()
      if (actions.length === 0) return "All OAR materials are currently within their planned usage dates."
      const top = actions.slice(0, 3).map((a) => `• ${a.title}`).join("\n")
      return `${actions.length} OAR item${actions.length === 1 ? "" : "s"} need attention:\n\n${top}\n\nSee OAR Utilization for the full list.`
    }
    case "approval": {
      const approvals = getPendingApprovals()
      if (approvals.length === 0) return "You're up to date — nothing is waiting on your decision."
      const top = approvals.slice(0, 3).map((a) => `• ${a.title}`).join("\n")
      return `${approvals.length} item${approvals.length === 1 ? "" : "s"} waiting for your decision:\n\n${top}\n\nSee Approvals for the full list.`
    }
  }
}

/** Questions about the material already loaded in this session ("this material..."). */
export function answerForThisMaterial(text: string, materialId: string): string | null {
  const lower = text.toLowerCase()
  if (lower.includes("oar")) {
    return isOARMaterial(materialId)
      ? "Yes — this material is classified as OAR (Order-As-Required)."
      : "No — this is a stocked (non-OAR) material."
  }
  if (lower.includes("rop") || lower.includes("safety stock") || lower.includes("stock level")) {
    const signal = getInitiative7Material360Signal(materialId)
    if (!signal) return "There's no inventory-planning recommendation on record for this material."
    return signal.lines.map((l) => `${l.label}: ${l.value}`).join("\n")
  }
  if (lower.includes("repair")) {
    const signal = getInitiative8Material360Signal(materialId)
    if (!signal) return "There's no repair chain on record for this material."
    return signal.lines.map((l) => `${l.label}: ${l.value}`).join("\n")
  }
  if (lower.includes("another plant") || lower.includes("available") || lower.includes("redeploy")) {
    const signal = getInitiative13Material360Signal(materialId)
    if (!signal) return "There's no OAR utilisation or cross-plant availability data on record for this material."
    return signal.lines.map((l) => `${l.label}: ${l.value}`).join("\n")
  }
  return null
}
