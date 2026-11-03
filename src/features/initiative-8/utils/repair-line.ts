import type { RepairChain } from "@/features/initiative-8/types/repair"
import { isPrOnly } from "@/features/initiative-8/utils/status"

/**
 * A repair line the way people find it in SAP, for the register and its
 * export (28-Oct-2026).
 *
 * Rows of the same part looked identical on the register: seven lines for one
 * material, told apart by nothing on screen. The repair line is what tells
 * them apart, written as SAP people write it -- `4500001719/10` for a repair
 * PO line, `PR 2000028756/10` for a PR raised for repair with no PO yet.
 */

function documentLine(document: string, line: string | undefined): string {
  return line ? `${document}/${line}` : document
}

/** `4500001719/10` on a PO row, `PR 2000028756/10` on a PR row. */
export function repairLineLabel(chain: Pick<RepairChain, "lineKind" | "repairPO" | "repairPR">): string {
  if (!isPrOnly(chain) && chain.repairPO) return documentLine(chain.repairPO.documentNumber, chain.repairPO.line)
  return `PR ${documentLine(chain.repairPR.documentNumber, chain.repairPR.line)}`
}
