// What the operator collects about the session, and the arithmetic on it.

import type { Metrics, TokenSplit } from '../../types/index.d.ts'
import type { Usage } from './prices.ts'

export type { Metrics, RateLimit, TokenSplit } from '../../types/index.d.ts'

const ZERO: TokenSplit = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }

export const emptyMetrics = (): Metrics => ({
  turn: 0,
  model: null,
  effort: null,
  speed: null,
  ttftMs: null,
  turnMs: null,
  costUsd: 0,
  turnCostUsd: null,
  costAtStart: 0,
  lastTurn: null,
  session: { ...ZERO },
  cacheSavingsUsd: 0,
  tools: { turn: 0, session: 0, turnErrors: 0, sessionErrors: 0 },
  linesAdded: 0,
  linesRemoved: 0,
  rateLimits: [],
  context: { tokens: null, window: null, percent: null },
  startedAt: null,
})

export const splitOf = (u: Usage | null | undefined): TokenSplit | null =>
  u
    ? {
        input: u.input_tokens || 0,
        output: u.output_tokens || 0,
        cacheRead: u.cache_read_input_tokens || 0,
        cacheWrite: u.cache_creation_input_tokens || 0,
      }
    : null

export const addSplit = (a: TokenSplit, b: TokenSplit | null): TokenSplit =>
  b
    ? { input: a.input + b.input, output: a.output + b.output, cacheRead: a.cacheRead + b.cacheRead, cacheWrite: a.cacheWrite + b.cacheWrite }
    : a

// Share of the prompt read from the cache; null before anything was sent.
export const hitRate = (s: TokenSplit | null): number | null => {
  if (!s) return null
  const prompt = s.input + s.cacheRead + s.cacheWrite
  return prompt ? s.cacheRead / prompt : null
}

// Tokens left before the window is full: an upper bound, since Claude Code compacts earlier.
export const roomLeft = (c: Metrics['context']): number | null =>
  c.tokens === null || c.window === null ? null : Math.max(0, c.window - c.tokens)

// The engine leaves tokens and percent out right after a compaction: keep the last known values.
export const mergeContext = (prev: Metrics['context'], next: Partial<Metrics['context']>): Metrics['context'] => ({
  tokens: next.tokens ?? prev.tokens,
  window: next.window ?? prev.window,
  percent: next.percent ?? prev.percent,
})
