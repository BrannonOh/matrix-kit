import { expect, test } from 'claude-code/testing'

import { addSplit, emptyMetrics, hitRate, mergeContext, roomLeft, splitOf } from './metrics.ts'

test('hitRate: cache reads over all input, cache writes included', () => {
  expect(hitRate({ input: 100, output: 5, cacheRead: 300, cacheWrite: 100 })).toBe(0.6)
})

test('hitRate: nothing read or written yet is unknown, not 0%', () => {
  expect(hitRate({ input: 0, output: 9, cacheRead: 0, cacheWrite: 0 })).toBe(null)
  expect(hitRate(null)).toBe(null)
})

test('splitOf: missing usage stays missing', () => {
  expect(splitOf(null)).toBe(null)
  expect(splitOf(undefined)).toBe(null)
  expect(splitOf({ input_tokens: 1, output_tokens: 2, cache_read_input_tokens: 3, cache_creation_input_tokens: 4 })).toEqual({ input: 1, output: 2, cacheRead: 3, cacheWrite: 4 })
})

test('addSplit: adds field by field and ignores a missing turn', () => {
  const a = { input: 1, output: 2, cacheRead: 3, cacheWrite: 4 }
  expect(addSplit(a, a)).toEqual({ input: 2, output: 4, cacheRead: 6, cacheWrite: 8 })
  expect(addSplit(a, null)).toEqual(a)
})

test('roomLeft: the window minus what is in it; unknown when either is', () => {
  expect(roomLeft({ tokens: 250_000, window: 1_000_000, percent: 25 })).toBe(750_000)
  expect(roomLeft({ tokens: null, window: 1_000_000, percent: null })).toBe(null)
})

// Review Focus 2: right after a compaction the engine reports no tokens or percent.
test('mergeContext: missing fields keep the last known value', () => {
  expect(mergeContext({ tokens: 250_000, window: 1_000_000, percent: 25 }, { window: 1_000_000 })).toEqual({ tokens: 250_000, window: 1_000_000, percent: 25 })
  expect(mergeContext({ tokens: 250_000, window: 1_000_000, percent: 25 }, { tokens: 300_000, percent: 30 })).toEqual({ tokens: 300_000, window: 1_000_000, percent: 30 })
})

test('emptyMetrics: a fresh session knows nothing yet', () => {
  const m = emptyMetrics()
  expect(m.turn).toBe(0)
  expect(m.ttftMs).toBe(null)
  expect(m.lastTurn).toBe(null)
  expect(m.rateLimits).toEqual([])
  expect(m.tools).toEqual({ turn: 0, session: 0, turnErrors: 0, sessionErrors: 0 })
})
