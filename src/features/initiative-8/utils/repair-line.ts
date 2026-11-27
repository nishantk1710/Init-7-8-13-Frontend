import type { RepairChain } from "@/features/initiative-8/types/repair"

/**
 * How a register row names itself, for the list and its export.
 *
 * Rows of the same part looked identical on the register: seven lines for one
 * material, told apart by nothing on screen (28-Oct-2026).
 *
 * **The PR, not the PO (27-Nov-2026.)** The column used to show whichever
 * document the row had -- the PO on a PO row, the PR on a PR-only row -- under
 * one heading, so the same cell meant two different things one row apart and
 * said which only by a `PR` prefix. The PR is the one document every line in
 * the register shares: measured on the production copy, 5,071 of 5,087 repair
 * PO lines carry one. The PO is a click away on the repair page, and still
 * a column behind the "+".
 */

function documentLine(document: string, line: string | undefined): string {
  return line ? `${document}/${line}` : document
}

/**
 * `2000028756/10` -- the PR this line was raised from.
 *
 * Falls back to the PO where SAP has no PR for the line -- the API sends an
 * empty document number there -- rather than leaving the row unidentifiable.
 * The 16 lines on the production copy raised straight as POs are all closed,
 * so the register does not list them today, but a row with nothing to name it
 * would be worse than an honest `PO` prefix. The prefix marks the exception,
 * so the cell is never read as a PR number that happens to look different.
 */
export function repairPrLabel(chain: Pick<RepairChain, "lineKind" | "repairPO" | "repairPR">): string {
  const pr = chain.repairPR?.documentNumber?.trim()
  if (pr) return documentLine(pr, chain.repairPR.line)
  if (chain.repairPO) return `PO ${documentLine(chain.repairPO.documentNumber, chain.repairPO.line)}`
  return "—"
}
