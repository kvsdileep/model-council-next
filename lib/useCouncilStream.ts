'use client'

import { useCallback, useState } from 'react'
import type { CouncilEvent, Stage } from '@/council/events'
import type { CouncilConfig } from '@/council/config'
import type { CritiqueOutput, Verdict } from '@/council/schemas'
import type { Usage } from '@/council/providers/types'
import { ZERO_USAGE } from '@/council/providers/types'
import { parseEventStream } from '@/lib/sse'

export type SeatView = { text: string; status: 'streaming' | 'ok' | 'failed'; error?: string }

export type StreamState = {
  status: 'idle' | 'running' | 'done' | 'failed'
  stage: Stage | null
  drafts: Record<number, SeatView>
  critiques: Record<number, CritiqueOutput>
  verdict: Verdict | null
  confidenceAdjusted: boolean
  runId: string | null
  usage: Usage
  error?: string
}

export const INITIAL_STATE: StreamState = {
  status: 'idle',
  stage: null,
  drafts: {},
  critiques: {},
  verdict: null,
  confidenceAdjusted: false,
  runId: null,
  usage: ZERO_USAGE,
}

function seat(state: StreamState, id: number): SeatView {
  return state.drafts[id] ?? { text: '', status: 'streaming' }
}

export function reduceEvent(state: StreamState, e: CouncilEvent): StreamState {
  switch (e.type) {
    case 'run_started':
      return { ...state, status: 'running', runId: e.runId }
    case 'stage_started':
      return { ...state, stage: e.stage }
    case 'seat_started':
      return { ...state, drafts: { ...state.drafts, [e.seat]: seat(state, e.seat) } }
    case 'token':
      return {
        ...state,
        drafts: {
          ...state.drafts,
          [e.seat]: { ...seat(state, e.seat), text: seat(state, e.seat).text + e.text },
        },
      }
    case 'seat_done':
      return {
        ...state,
        drafts: { ...state.drafts, [e.seat]: { ...seat(state, e.seat), status: 'ok' } },
      }
    case 'seat_failed':
      return {
        ...state,
        drafts: {
          ...state.drafts,
          [e.seat]: { ...seat(state, e.seat), status: 'failed', error: e.reason },
        },
      }
    case 'critique_done':
      return { ...state, critiques: { ...state.critiques, [e.seat]: e.payload } }
    case 'verdict':
      return { ...state, verdict: e.payload, confidenceAdjusted: e.confidenceAdjusted }
    case 'run_done':
      return { ...state, status: 'done', usage: e.usage }
    case 'run_failed':
      return { ...state, status: 'failed', error: e.reason }
    default:
      return state
  }
}

export function useCouncilStream() {
  const [state, setState] = useState<StreamState>(INITIAL_STATE)

  const start = useCallback(async (query: string, config: CouncilConfig) => {
    setState({ ...INITIAL_STATE, status: 'running' })

    const res = await fetch('/api/council', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, config }),
    })

    if (!res.ok || !res.body) {
      const detail = await res.text()
      setState((s) => ({ ...s, status: 'failed', error: detail.slice(0, 300) }))
      return
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      // Keep the trailing partial frame in the buffer.
      const lastBreak = buffer.lastIndexOf('\n\n')
      if (lastBreak === -1) continue
      const complete = buffer.slice(0, lastBreak + 2)
      buffer = buffer.slice(lastBreak + 2)
      for (const e of parseEventStream(complete)) {
        setState((s) => reduceEvent(s, e))
      }
    }
  }, [])

  return { state, start }
}
