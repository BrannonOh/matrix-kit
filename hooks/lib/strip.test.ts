import { expect, test } from 'claude-code/testing'

import { stripItems } from './strip.ts'

test('stripItems: everything fits from 110 columns', () => {
  expect(stripItems(120, true)).toEqual(['speed', 'turnCost', 'sessionCost', 'cache', 'context', 'limits', 'model', 'room'])
})

test('stripItems: items drop in order as the window narrows', () => {
  expect(stripItems(100, true)).toEqual(['speed', 'turnCost', 'sessionCost', 'cache', 'context', 'limits', 'model'])
  expect(stripItems(90, true)).toEqual(['speed', 'turnCost', 'sessionCost', 'cache', 'context', 'limitsCombined', 'model'])
  expect(stripItems(80, true)).toEqual(['speed', 'turnCost', 'sessionCost', 'cache', 'context', 'limitsCombined'])
  expect(stripItems(65, true)).toEqual(['speed', 'turnCost', 'cache', 'context', 'limitsCombined'])
})

// Review Focus 4: a very narrow window keeps only the prompt cost, the cache and the context.
test('stripItems: the narrowest strip keeps the three essentials', () => {
  expect(stripItems(50, true)).toEqual(['turnCost', 'cache', 'context', 'limitsCombined'])
  expect(stripItems(30, true)).toEqual(['turnCost', 'cache', 'context', 'limitsCombined'])
  expect(stripItems(30, false)).toEqual(['turnCost', 'cache', 'context'])
})

// Review Focus 3: off a subscription there are no limits to show at any width.
test('stripItems: no limits item without plan limits', () => {
  for (const columns of [120, 100, 90, 80, 65, 50]) {
    const items = stripItems(columns, false)
    expect(items.includes('limits') || items.includes('limitsCombined')).toBe(false)
  }
})
