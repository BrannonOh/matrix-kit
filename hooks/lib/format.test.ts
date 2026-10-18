import { expect, test } from 'claude-code/testing'

import { fmtCost, fmtDuration, fmtTime, fmtTokens } from './format.ts'
import { cacheSavingsOf } from './prices.ts'

test('fmtDuration: milliseconds under a second, seconds to one decimal, then clock time', () => {
  expect(fmtDuration(850)).toBe('850 ms')
  expect(fmtDuration(1440)).toBe('1.4 s')
  expect(fmtDuration(65_000)).toBe('1:05')
})

test('fmtCost, fmtTokens and fmtTime keep the original formats', () => {
  expect(fmtCost(0.256)).toBe('$0.26')
  expect(fmtCost(12.34)).toBe('$12.3')
  expect(fmtTokens(1500)).toBe('2k')
  expect(fmtTime(3_725_000)).toBe('1:02:05')
})

const READS = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 2e6, cache_creation_input_tokens: 0 }

test('cacheSavingsOf: 2M cache reads on Opus 5.5 save 2 × (4 − 0.20) = $7.60', () => {
  expect(Math.abs(cacheSavingsOf('claude-opus-5-5', READS) - 7.6)).toBeLessThan(1e-9)
})

test('cacheSavingsOf: an unknown model is priced at the fallback row', () => {
  expect(Math.abs(cacheSavingsOf('unknown-model', READS) - 7.6)).toBeLessThan(1e-9)
})
