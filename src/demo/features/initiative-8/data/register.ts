import { DECLARATIONS } from "@demo/features/initiative-8/data/declarations"
import { EXCEPTIONS } from "@demo/features/initiative-8/data/exceptions"
import { JUSTIFICATIONS } from "@demo/features/initiative-8/data/justifications"
import { REPAIR_CHAINS } from "@demo/features/initiative-8/data/repair-chains"
import type {
  JustificationEntry,
  RepairChain,
  RepairJustification,
} from "@demo/features/initiative-8/types/repair"

/**
 * The register's rows: each repair chain with its declaration and its
 * justification joined on — what the Declaration Queue and Justifications
 * screens showed before they were folded into the register (08-Oct-2026).
 *
 * Its own module because `data/declarations.ts` and `data/exceptions.ts` both
 * import the chains; joining inside `repair-chains.ts` would be a cycle.
 *
 * The rules are the backend's (`app/initiatives/i8/line_justifications.py`),
 * so the Snapshot register reads the way the live one does:
 *
 * - **Recorded** — a justification for the same material and plant, recorded
 *   while the line was out (on or after the day it was raised, before it came
 *   back).
 * - **Missing** — an `UNJUSTIFIED_ACQUISITION` exception names the line, and
 *   its purchase is not one a justification answers. Missing wins over
 *   Recorded: it is the one somebody has to act on.
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** "22 Aug 2026" or "22 Aug 2026, 10:42" as a day count; undefined if unreadable. */
function dayOf(display: string | undefined): number | undefined {
  const match = display?.match(/^(\d{1,2}) (\w{3}) (\d{4})/)
  if (!match) return undefined
  const month = MONTHS.indexOf(match[2])
  if (month < 0) return undefined
  return Date.UTC(Number(match[3]), month, Number(match[1])) / 86_400_000
}

function wasOutOn(chain: RepairChain, display: string): boolean {
  const day = dayOf(display)
  const raised = dayOf(chain.raisedAt)
  if (day === undefined || raised === undefined || day < raised) return false
  const received = dayOf(chain.receivedAt)
  return received === undefined || day < received
}

function samePart(chain: RepairChain, entry: JustificationEntry): boolean {
  return (
    entry.material.materialId === chain.material.materialId &&
    entry.plant.plantId === chain.plant.plantId
  )
}

function sameDocument(
  a: { documentNumber: string; line?: string } | undefined,
  b: { documentNumber: string; line?: string } | undefined,
): boolean {
  return !!a && !!b && a.documentNumber === b.documentNumber && a.line === b.line
}

function justificationOf(chain: RepairChain): RepairJustification | undefined {
  const forPart = JUSTIFICATIONS.filter((entry) => samePart(chain, entry))
  const recorded = forPart.filter((entry) => wasOutOn(chain, entry.recordedAt))
  const unjustified = EXCEPTIONS.filter(
    (exception) =>
      exception.type === "UNJUSTIFIED_ACQUISITION" &&
      exception.repairId === chain.id &&
      // A purchase a justification answers is not an exception -- the same
      // rule the backend applies before it raises one.
      !forPart.some((entry) => sameDocument(entry.acquisitionLine, exception.acquisitionLine)),
  )
  if (recorded.length === 0 && unjustified.length === 0) return undefined

  return {
    status: unjustified.length > 0 ? "MISSING" : "RECORDED",
    entries: [...recorded]
      .sort((a, b) => (dayOf(b.recordedAt) ?? 0) - (dayOf(a.recordedAt) ?? 0))
      .map((entry) => ({
        id: entry.id,
        reasonCategory: entry.reasonCategory,
        freeText: entry.freeText,
        author: entry.author,
        recordedAt: entry.recordedAt,
        sessionId: entry.sessionId,
      })),
    unjustifiedPurchases: unjustified.map((exception) => ({
      exceptionId: exception.id,
      purchase: exception.acquisitionLine ?? exception.repairLine,
      raisedAt: exception.raisedAt,
      preAutomation: exception.preAutomation,
    })),
  }
}

function withDeclarationAndJustification(chain: RepairChain): RepairChain {
  const declaration = DECLARATIONS.find((d) => d.relatedRepairId === chain.id)
  return {
    ...chain,
    declaredBy: declaration?.declaredBy ?? chain.declaredBy,
    declaredAt: declaration?.declaredAt ?? chain.declaredAt,
    condition: declaration?.condition ?? chain.condition,
    declarationNextAction: declaration?.nextAction ?? chain.declarationNextAction,
    requester: declaration?.requester ?? chain.requester,
    justification: justificationOf(chain),
  }
}

export const REGISTER_CHAINS: RepairChain[] = REPAIR_CHAINS.map(withDeclarationAndJustification)

export function getRegisterChainById(id: string): RepairChain | undefined {
  return REGISTER_CHAINS.find((chain) => chain.id === id)
}
