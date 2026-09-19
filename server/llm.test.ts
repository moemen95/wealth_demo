import { describe, expect, it } from 'vitest'
import { GeminiParseError, geminiThinkingBudget, geminiThinkingConfig, parseGeminiJson, vertexGenerateContentUrl } from './llm.ts'

describe('Gemini thinking control', () => {
  it('uses a budget for 2.5 (0 flash / 128 pro), a level for 3.x+, nothing for older models', () => {
    expect(geminiThinkingConfig('gemini-2.5-flash')).toEqual({ thinkingBudget: 0 })
    expect(geminiThinkingConfig('gemini-2.5-flash-lite')).toEqual({ thinkingBudget: 0 })
    expect(geminiThinkingConfig('gemini-2.5-pro')).toEqual({ thinkingBudget: 128 })
    expect(geminiThinkingConfig('gemini-3-pro-preview')).toEqual({ thinkingLevel: 'low' })
    expect(geminiThinkingConfig('gemini-3.8-flash')).toEqual({ thinkingLevel: 'low' })
    expect(geminiThinkingConfig('gemini-2.0-flash')).toBeNull()
    expect(geminiThinkingConfig('gemini-1.5-pro')).toBeNull()
  })

  it('honours env overrides', () => {
    expect(geminiThinkingConfig('gemini-3.8-flash', { GEMINI_THINKING_LEVEL: 'minimal' })).toEqual({ thinkingLevel: 'minimal' })
    expect(geminiThinkingConfig('gemini-2.5-flash', { GEMINI_THINKING_BUDGET: '512' })).toEqual({ thinkingBudget: 512 })
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

  it('reports truncation by finish reason (with token usage) instead of a bare SyntaxError', () => {
    const truncated = { ...reply('{\n  "headline": "You’re cl', 'MAX_TOKENS'), usageMetadata: { thoughtsTokenCount: 8100, candidatesTokenCount: 12 } }
    let err: unknown
    try {
      parseGeminiJson(truncated)
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(GeminiParseError)
    expect((err as GeminiParseError).finishReason).toBe('MAX_TOKENS')
    expect(String(err)).toMatch(/truncated.*thoughts=8100 output=12/)
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
