import { describe, expect, it } from 'vitest'
import { vertexGenerateContentUrl } from './llm.ts'

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
