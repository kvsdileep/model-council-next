import type { ZodType } from 'zod'
import type { CompleteRequest, Completion, Provider, Usage } from './providers/types'
import { ZERO_USAGE, addUsage } from './providers/types'

export class SeatFailure extends Error {
  readonly reason: string
  constructor(reason: string) {
    super(reason)
    this.name = 'SeatFailure'
    this.reason = reason
  }
}

function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${what} timed out after ${ms}ms`)), ms)
    p.then(
      (v) => { clearTimeout(timer); resolve(v) },
      (e) => { clearTimeout(timer); reject(e) },
    )
  })
}

/** One timeout-guarded attempt, then one jittered retry. Spec section 10. */
export async function callWithRetry(
  provider: Provider,
  req: CompleteRequest,
  timeoutMs: number,
): Promise<Completion> {
  try {
    return await withTimeout(provider.complete(req), timeoutMs, req.model)
  } catch (first) {
    await new Promise((r) => setTimeout(r, 250 + Math.random() * 500))
    try {
      return await withTimeout(provider.complete(req), timeoutMs, req.model)
    } catch (second) {
      throw new SeatFailure(
        `${req.model} failed twice: ${(first as Error).message} / ${(second as Error).message}`,
      )
    }
  }
}

/** Models often wrap JSON in markdown fences despite instructions. */
function stripFences(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  return (fenced ? fenced[1] : text).trim()
}

/**
 * A structured call with exactly one repair round-trip. On the first
 * validation failure the error is echoed back to the model. A second
 * failure fails the seat — there is never a third attempt. Spec section 7.
 */
export async function completeJson<T>(
  provider: Provider,
  req: CompleteRequest,
  schema: ZodType<T>,
  timeoutMs: number,
): Promise<{ value: T; usage: Usage }> {
  let usage: Usage = ZERO_USAGE

  const first = await callWithRetry(provider, { ...req, json: true }, timeoutMs)
  usage = addUsage(usage, first.usage)

  const attempt = (raw: string) => {
    try {
      return { ok: true as const, value: schema.parse(JSON.parse(stripFences(raw))) }
    } catch (e) {
      return { ok: false as const, error: (e as Error).message }
    }
  }

  const firstResult = attempt(first.text)
  if (firstResult.ok) return { value: firstResult.value, usage }

  const repairReq: CompleteRequest = {
    ...req,
    json: true,
    user: [
      req.user,
      '',
      '--- REPAIR ---',
      'Your previous response did not satisfy the required schema.',
      `Validation error: ${firstResult.error}`,
      'Return ONLY valid JSON matching the schema. No prose, no markdown fences.',
    ].join('\n'),
  }

  const second = await callWithRetry(provider, repairReq, timeoutMs)
  usage = addUsage(usage, second.usage)

  const secondResult = attempt(second.text)
  if (secondResult.ok) return { value: secondResult.value, usage }

  throw new SeatFailure(`${req.model} produced invalid JSON twice: ${secondResult.error}`)
}
