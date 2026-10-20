import { expect, test } from 'claude-code/testing'

import { CHARACTER_COLOR, CHARACTER_LIGHT_COLOR, SPRITE_CSS, badgeOf, spriteSvg } from './sprites.ts'
import type { Sprite } from './sprites.ts'

const CHARACTERS: readonly Sprite[] = ['neo', 'morpheus', 'trinity', 'mouse', 'oracle', 'smith']
const STATES = ['running', 'done', 'failed'] as const

const rgb = (hex: string): [number, number, number] => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]

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

test('sprite: a row of all six running fits one Svg source', () => {
  const body = CHARACTERS.map((c, i) => spriteSvg(c, 'running', { x: i * 30, y: 0 })).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="40">${SPRITE_CSS}${body}</svg>`
  expect(svg.length).toBeLessThan(131_072)
})

test('sprite: every animation stops under reduced motion', () => {
  expect(SPRITE_CSS.includes('prefers-reduced-motion')).toBe(true)
})

test('sprite: a failed worker glitches', () => {
  expect(spriteSvg('neo', 'failed', { x: 0, y: 0 }).includes('glitch')).toBe(true)
})

test('badgeOf: six different letters for the terminal', () => {
  const letters = CHARACTERS.map(c => badgeOf(c).letter)
  expect(new Set(letters).size).toBe(6)
  expect(letters).toEqual(['N', 'M', 'T', 'm', 'O', 'S'])
})

test('CHARACTER_COLOR: every badge is a shade of green', () => {
  for (const [c, hex] of Object.entries(CHARACTER_COLOR)) {
    const [r, g, b] = rgb(hex)
    expect(`${c} ${g > r && g > b}`).toBe(`${c} true`)
  }
})

// WCAG contrast of a colour against white.
const contrastOnWhite = (hex: string): number => {
  const lin = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
  const [r, g, b] = rgb(hex)
  return 1.05 / (0.2126 * lin(r / 255) + 0.7152 * lin(g / 255) + 0.0722 * lin(b / 255) + 0.05)
}

test('CHARACTER_LIGHT_COLOR: each character keeps a green of their own on white', () => {
  const shades = Object.values(CHARACTER_LIGHT_COLOR)
  expect(new Set(shades).size).toBe(6)
  for (const [c, hex] of Object.entries(CHARACTER_LIGHT_COLOR)) {
    const [r, g, b] = rgb(hex)
    expect(`${c} ${g > r && g > b}`).toBe(`${c} true`)
    expect(`${c} ${contrastOnWhite(hex) >= 4.5}`).toBe(`${c} true`)
  }
})
