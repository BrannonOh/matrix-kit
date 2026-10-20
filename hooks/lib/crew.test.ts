import { expect, test } from 'claude-code/testing'

import { CHARACTER_NAME, characterOf } from './crew.ts'

test('characterOf: each model family plays one character, at any effort', () => {
  expect(characterOf('claude-fable-5-1')).toBe('neo')
  expect(characterOf('claude-opus-5-5')).toBe('morpheus')
  expect(characterOf('claude-sonnet-5-5')).toBe('trinity')
  expect(characterOf('claude-haiku-5-5')).toBe('oracle')
  // Aliases and provider-prefixed ids name the family too.
  expect(characterOf('opus')).toBe('morpheus')
  expect(characterOf('us.anthropic.claude-sonnet-5-5-v1:0')).toBe('trinity')
})

test('characterOf: no model yet, or one outside the four families, is Agent Smith', () => {
  expect(characterOf('')).toBe('smith')
  expect(characterOf(undefined)).toBe('smith')
  expect(characterOf('gpt-9')).toBe('smith')
})

test('CHARACTER_NAME: display names', () => {
  expect(CHARACTER_NAME.smith).toBe('Agent Smith')
  expect(CHARACTER_NAME.oracle).toBe('The Oracle')
})
