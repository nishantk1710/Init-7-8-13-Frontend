import type { Metadata } from "next"
import { connection } from "next/server"

import { DeclarationsScreen } from "@/features/initiative-8/components/declarations-screen"
import { loadDeclarationLog } from "@/features/initiative-8/data/live-declarations"

export const metadata: Metadata = {
  title: "Repair Declarations — Spares AI",
}

/**
 * Initiative 08 FR-4 — the log of condition declarations.
 *
 * Since 3-Nov-2026 a declaration is made only in the reservation assistant, by
 * the person taking the faulty unit out, so this screen lists what was
 * declared and declares nothing itself. It was a queue with three tabs and a
 * form on every row until then; which repair lines have no declaration is
 * shown on the register ("Not declared").
 *
 * The log is `GET /api/i8/attestations`, loaded whole: it holds what people
 * have declared and grows only as fast as they declare. Superseded rows are
 * kept, because they are the audit history.
 */
export default async function I08DeclarationsPage() {
  // Reads a table that changes whenever somebody declares, so a build-time
  // snapshot would be stale the moment it was built.
  await connection()
  // Null on failure, which the screen reports as such.
  const log = await loadDeclarationLog()
  return <DeclarationsScreen log={log} />
}
