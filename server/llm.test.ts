import { describe, expect, it } from 'vitest'
import { geminiThinkingBudget, parseGeminiJson, vertexGenerateContentUrl } from './llm.ts'

describe('Gemini thinking budget', () => {
  it('turns thinking off for 2.5 flash, keeps the minimum for 2.5 pro, omits it otherwise', () => {
    expect(geminiThinkingBudget('gemini-2.5-flash')).toBe(0)
    expect(geminiThinkingBudget('gemini-2.5-flash-lite')).toBe(0)
    expect(geminiThinkingBudget('gemini-2.5-pro')).toBe(128)
    expect(geminiThinkingBudget('gemini-2.0-flash')).toBeNull()
    expect(geminiThinkingBudget('gemini-2.5-flash', '512')).toBe(512)
  })
})

describe('Gemini response parsing', () => {
  const reply = (text: string, finishReason = 'STOP') => ({ candidates: [{ content: { parts: [{ text }] }, finishReason }] })

  it('parses plain JSON and fenced JSON, ignoring thought parts', () => {
    const obj = { headline: 'h', narrative: 'n' }
    expect(parseGeminiJson(reply(JSON.stringify(obj)))).toEqual(obj)
    expect(parseGeminiJson(reply('```json\n' + JSON.stringify(obj) + '\n```'))).toEqual(obj)
    expect(
      parseGeminiJson({ candidates: [{ content: { parts: [{ text: 'reasoning…', thought: true }, { text: JSON.stringify(obj) }] } }] }),
    ).toEqual(obj)
  })

  it('reports truncation by finish reason instead of a bare SyntaxError', () => {
    expect(() => parseGeminiJson(reply('{\n  "headline": "You’re cl', 'MAX_TOKENS'))).toThrow(/finishReason MAX_TOKENS.*truncated/)
  })

  it('reports blocked prompts', () => {
    expect(() => parseGeminiJson({ promptFeedback: { blockReason: 'SAFETY' } })).toThrow(/blocked.*SAFETY/)
  })
})

describe('Vertex AI endpoint', () => {
  it('uses a region-prefixed host for regional locations', () => {
    expect(vertexGenerateContentUrl('us-central1', 'tng-chatai-lab', 'gemini-2.5-flash')).toBe(
      'https://us-central1-aiplatform.googleapis.com/v1/projects/tng-chatai-lab/locations/us-central1/publishers/google/models/gemini-2.5-flash:generateContent',
    )
  })

  it('uses the bare host for the global location', () => {
    expect(vertexGenerateContentUrl('global', 'tng-chatai-lab', 'gemini-2.5-flash')).toBe(
      'https://aiplatform.googleapis.com/v1/projects/tng-chatai-lab/locations/global/publishers/google/models/gemini-2.5-flash:generateContent',
    )
  })
})
