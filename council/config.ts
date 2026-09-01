export type Seat = {
  id: number
  model: string
  label: string
  lab: string
}

export type CouncilConfig = {
  drafters: Seat[]
  judge: Seat
  timeoutMs: number
}

// Verified against the OpenRouter catalog on 2026-09-01 — spec section 5.
// Four labs, so no lab both drafts and judges.
export const DEFAULT_CONFIG: CouncilConfig = {
  drafters: [
    { id: 1, model: 'anthropic/claude-sonnet-5', label: 'Seat 1', lab: 'Anthropic' },
    { id: 2, model: 'openai/gpt-5.4', label: 'Seat 2', lab: 'OpenAI' },
    { id: 3, model: 'google/gemini-3.1-pro-preview', label: 'Seat 3', lab: 'Google' },
  ],
  judge: { id: 0, model: 'x-ai/grok-4.6', label: 'Judge', lab: 'xAI' },
  timeoutMs: Number(process.env.COUNCIL_TIMEOUT_MS ?? 90_000),
}

export const QUORUM_MIN_DRAFTERS = 2
