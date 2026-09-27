"use server"

import { revalidatePath } from "next/cache"

/**
 * Re-render the screens a finished conversation changes.
 *
 * When an I13 conversation captures a plan, the backend updates that
 * material's WATCH row and re-runs exception detection for it before the last
 * turn returns (`app/assistant/downstream.py`). These pages render dynamically
 * already; revalidating them as well means a router-cached copy from earlier in
 * the visit is not what the planner sees when they follow a link from the
 * finished conversation.
 */
export async function revalidateAfterConversation(flow: string): Promise<void> {
  revalidatePath("/assistant/sessions", "layout")
  if (flow === "i13") {
    revalidatePath("/oar-utilization", "layout")
  }
  if (flow === "i08") {
    revalidatePath("/repairable-spares/justifications")
  }
}
