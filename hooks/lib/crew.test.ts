import { expect, test } from 'claude-code/testing'

import { CHARACTER_NAME, characterOf, isCrew } from './crew.ts'

test('characterOf: a crew agent plays itself, with or without the plugin prefix', () => {
  expect(characterOf('matrix-kit:neo')).toBe('neo')
  expect(characterOf('mouse')).toBe('mouse')
})

test('characterOf: Explore is The Oracle and anything else is Agent Smith', () => {
  expect(characterOf('Explore')).toBe('oracle')
  expect(characterOf('general-purpose')).toBe('smith')
  expect(characterOf('matrix-kit:unknown')).toBe('smith')
})

test('isCrew: only the five matrix-kit workers', () => {
  expect(isCrew('matrix-kit:trinity')).toBe(true)
  expect(isCrew('savvy-careful')).toBe(false)
  expect(isCrew('Explore')).toBe(false)
})

test('CHARACTER_NAME: display names', () => {
  expect(CHARACTER_NAME.smith).toBe('Agent Smith')
  expect(CHARACTER_NAME.oracle).toBe('The Oracle')
})
