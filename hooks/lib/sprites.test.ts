import { expect, test } from 'claude-code/testing'

import type { Character } from './crew.ts'
import { CHARACTER_COLOR, CHARACTER_LIGHT_COLOR, SPRITE_CSS, badgeOf, spriteSvg } from './sprites.ts'

const CHARACTERS: readonly Character[] = ['neo', 'morpheus', 'trinity', 'tank', 'mouse', 'oracle', 'smith']
const STATES = ['running', 'done', 'failed', 'planned'] as const

for (const c of CHARACTERS) {
  for (const state of STATES) {
    test(`sprite: ${c} ${state} is tagged and small`, () => {
      const g = spriteSvg(c, state, { x: 0, y: 0 })
      expect(g.includes(`ch-${c}`)).toBe(true)
      expect(g.includes(`st-${state}`)).toBe(true)
      expect(g.length).toBeLessThan(8000)
    })
  }
}

test('sprite: a row of all seven running fits one Svg source', () => {
  const body = CHARACTERS.map((c, i) => spriteSvg(c, 'running', { x: i * 30, y: 0 })).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="40">${SPRITE_CSS}${body}</svg>`
  expect(svg.length).toBeLessThan(131_072)
})

test('sprite: every animation stops under reduced motion', () => {
  expect(SPRITE_CSS.includes('prefers-reduced-motion')).toBe(true)
})

test('sprite: a failed worker glitches and a planned one is dimmed', () => {
  expect(spriteSvg('neo', 'failed', { x: 0, y: 0 }).includes('glitch')).toBe(true)
  expect(spriteSvg('neo', 'planned', { x: 0, y: 0 }).includes('opacity="0.45"')).toBe(true)
})

test('badgeOf: seven different letters for the terminal', () => {
  const letters = CHARACTERS.map(c => badgeOf(c).letter)
  expect(new Set(letters).size).toBe(7)
  expect(letters).toEqual(['N', 'M', 'T', 'K', 'm', 'O', 'S'])
})

test('CHARACTER_COLOR: every badge is a shade of green', () => {
  for (const [c, hex] of Object.entries(CHARACTER_COLOR)) {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))
    expect(`${c} ${g > r && g > b}`).toBe(`${c} true`)
  }
})

// WCAG contrast of a colour against white.
const contrastOnWhite = (hex: string): number => {
  const lin = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
  const [r, g, b] = [1, 3, 5].map(i => lin(parseInt(hex.slice(i, i + 2), 16) / 255))
  return 1.05 / (0.2126 * r + 0.7152 * g + 0.0722 * b + 0.05)
}

test('CHARACTER_LIGHT_COLOR: each crew member keeps a green of their own on white', () => {
  const shades = Object.values(CHARACTER_LIGHT_COLOR)
  expect(new Set(shades).size).toBe(7)
  for (const [c, hex] of Object.entries(CHARACTER_LIGHT_COLOR)) {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))
    expect(`${c} ${g > r && g > b}`).toBe(`${c} true`)
    expect(`${c} ${contrastOnWhite(hex) >= 4.5}`).toBe(`${c} true`)
  }
})
