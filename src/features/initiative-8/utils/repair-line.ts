import type { RepairChain, RepairLineException } from "@/features/initiative-8/types/repair"
import { isPrOnly } from "@/features/initiative-8/utils/status"

/**
 * A repair line the way people find it in SAP, and what the checks raised on
 * it, for the register, its export and the notification log (28-Oct-2026).
 *
 * Rows of the same part looked identical on the register: seven lines for one
 * material, told apart by nothing on screen. The repair line is what tells
 * them apart, written as SAP people write it -- `4500001719/10` for a repair
 * PO line, `PR 2000028756/10` for a repair requested with no PO yet.
 */

function documentLine(document: string, line: string | undefined): string {
  return line ? `${document}/${line}` : document
}

/** `4500001719/10` on a PO row, `PR 2000028756/10` on a PR row. */
export function repairLineLabel(chain: Pick<RepairChain, "lineKind" | "repairPO" | "repairPR">): string {
  if (!isPrOnly(chain) && chain.repairPO) return documentLine(chain.repairPO.documentNumber, chain.repairPO.line)
  return `PR ${documentLine(chain.repairPR.documentNumber, chain.repairPR.line)}`
}

/**
 * The same label from a register id: `4500001719-10` reads `4500001719/10`,
 * `PR-2000028756-10` reads `PR 2000028756/10`. Split on the last hyphen, as
 * the repair page's route is. Undefined for nothing; an id that is not a
 * register id is shown as it came.
 */
export function repairLineFromId(id: string | null | undefined): string | undefined {
  if (!id) return undefined
  const separator = id.lastIndexOf("-")
  if (separator <= 0 || separator === id.length - 1) return id
  const document = id.slice(0, separator)
  const item = id.slice(separator + 1)
  if (document.startsWith("PR-")) return `PR ${document.slice(3)}/${item}`
  if (document === "PR") return id
  return `${document}/${item}`
}

/**
 * A line's exceptions split into the ones to act on and the ones raised
 * before go-live, which need nothing: the register's badge counts the first
 * and names the second only on hover, so it agrees with the exception queue.
 */
export function splitLineExceptions(exceptions: RepairLineException[]): {
  toAct: RepairLineException[]
  earlier: RepairLineException[]
} {
  return {
    toAct: exceptions.filter((item) => !item.preAutomation),
    earlier: exceptions.filter((item) => item.preAutomation),
  }
}
