/**
 * Grounding check shared by the summary tests and the LLM client: a piece of copy is "grounded" when
 * every number in it is one of the registered simulation facts (in any of the ways a number is
 * formatted in prose: 1500, 1,500, or its rounded form).
 */

export function allowedTokens(facts: Record<string, unknown>): Set<string> {
  const out = new Set<string>()
  for (const v of Object.values(facts)) {
    if (typeof v !== 'number' || !Number.isFinite(v)) continue
    out.add(String(v))
    out.add(Math.round(v).toLocaleString('en-US'))
    out.add(String(Math.round(v)))
  }
  return out
}

/** Numbers in prose; commas only count inside a number ("1,500"), never trailing ("age 72, 90 points"). */
export const numbersIn = (text: string): string[] => text.match(/\d(?:[\d,]*\d)?(?:\.\d+)?/g) ?? []

/** Returns the numbers in `text` that are NOT registered facts (empty ⇒ grounded). */
export function ungroundedNumbers(text: string, facts: Record<string, unknown>): string[] {
  const allowed = allowedTokens(facts)
  return numbersIn(text).filter((n) => !allowed.has(n))
}
