// Lets the Material Assistant resolve a material from a plain-language name
// ("the conveyor gearmotor", "pump seal") as well as a code — a user
// shouldn't have to memorize material numbers to ask about one (§2/§30).
// Deterministic keyword-overlap matching, not real NLU: good enough for a
// mock, and it only ever resolves to a material that genuinely exists.

import { MATERIALS } from "@/lib/shared-data/material-catalog"
import { REPAIR_CHAINS } from "@/features/initiative-8/data/repair-chains"

const STOPWORDS = new Set([
  "the", "a", "an", "this", "that", "material", "materials", "show", "me",
  "is", "are", "for", "on", "of", "type", "about", "need", "needs", "any",
  "there", "we", "do", "have", "please", "can", "you", "info", "details",
])

function significantWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
}

export interface NameMatchCandidate {
  id: string
  description: string
  score: number
}

function scoredCandidates(text: string): NameMatchCandidate[] {
  const queryWords = new Set(significantWords(text))
  if (queryWords.size === 0) return []

  const candidates = [
    ...MATERIALS.map((m) => ({ id: m.id, description: m.description })),
    ...REPAIR_CHAINS.map((c) => ({ id: c.material.materialId, description: c.material.description })),
  ]

  return candidates
    .map((c) => ({
      ...c,
      score: significantWords(c.description).filter((w) => queryWords.has(w)).length,
    }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
}

/** Resolves free text to exactly one material id by matching its
 * description's significant words — only when there's a single unambiguous
 * best match (score >= 2, and no tie at the top score). Ambiguous or weak
 * matches return null; see `findNameMatchCandidates` to surface them for
 * disambiguation instead of guessing. */
export function findMaterialIdByName(text: string): string | null {
  const scored = scoredCandidates(text)
  if (scored.length === 0) return null
  const [best, second] = scored
  if (best.score < 2) return null
  if (second && second.score === best.score) return null // ambiguous — don't guess
  return best.id
}

/** The top few plausible matches for free text that didn't resolve to a
 * single material (e.g. "impeller" alone, which matches several) — lets the
 * assistant ask the user to pick one instead of silently failing. */
export function findNameMatchCandidates(text: string, limit = 4): NameMatchCandidate[] {
  return scoredCandidates(text).slice(0, limit)
}
