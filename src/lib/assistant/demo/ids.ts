/**
 * Demo session references.
 *
 * The same shape as a real one -- ten characters of Crockford base32 with a
 * check character, computed exactly as `app/assistant/ids.py` does -- so the
 * banner, the copy button and the trace look as they will in production.
 *
 * **The prefix is `D`, never `S`.** The backend's `ids.parse()` refuses an ID
 * that does not start with `S`, so a demo reference typed into a real
 * reservation can never link to a real session or count toward FR-4. It reports
 * as an invalid reference, which is the truthful answer.
 */

export const DEMO_PREFIX = "D"

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
const MODULUS = ALPHABET.length
const LENGTH = 10

/** Odd weights 1, 3, 5, ... -- invertible mod 32, as in the backend. */
function weight(position: number): number {
  return 2 * position + 1
}

function inverse(value: number): number {
  for (let candidate = 1; candidate < MODULUS; candidate += 1) {
    if ((value * candidate) % MODULUS === 1) return candidate
  }
  throw new Error(`${value} has no inverse mod ${MODULUS}`)
}

/** The character that makes the whole ID's weighted sum zero mod 32. */
export function checkCharacter(body: string): string {
  let total = 0
  for (let index = 0; index < body.length; index += 1) {
    const value = ALPHABET.indexOf(body[index])
    if (value < 0) throw new Error(`${body[index]} is not a session ID character`)
    total += weight(index) * value
  }
  const position = ((-total * inverse(weight(body.length))) % MODULUS + MODULUS) % MODULUS
  return ALPHABET[position]
}

/** Whether a full ID's check character matches. */
export function isWellFormed(id: string): boolean {
  if (id.length !== LENGTH) return false
  return checkCharacter(id.slice(0, -1)) === id.slice(-1)
}

/** A demo ID from a fixed payload, for the two seeded sessions. */
export function demoIdFrom(payload: string): string {
  const body = DEMO_PREFIX + payload.toUpperCase()
  return body + checkCharacter(body)
}

/** A new random demo ID. */
export function mintDemoSessionId(random: () => number = Math.random): string {
  let payload = ""
  for (let i = 0; i < LENGTH - DEMO_PREFIX.length - 1; i += 1) {
    payload += ALPHABET[Math.floor(random() * MODULUS)]
  }
  return demoIdFrom(payload)
}

export function isDemoSessionId(id: string | null | undefined): boolean {
  return typeof id === "string" && id.startsWith(DEMO_PREFIX) && isWellFormed(id)
}
