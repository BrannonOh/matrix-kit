import { expect, test } from 'claude-code/testing'

import { GLYPHS, PALETTE, glyphAt, themeCss } from './theme.ts'

test('themeCss: phosphor green in dark mode, a darker green in light mode', () => {
  const css = themeCss()
  expect(css.includes('#00FF41')).toBe(true)
  expect(css.includes('#00802A')).toBe(true)
  expect(css.includes('prefers-color-scheme')).toBe(true)
})

test('glyphAt: the same cell always draws the same glyph, taken from GLYPHS', () => {
  expect(glyphAt(3, 1)).toBe(glyphAt(3, 1))
  for (let c = 0; c < 40; c++) for (let r = 0; r < 5; r++) expect(GLYPHS.includes(glyphAt(c, r))).toBe(true)
})

test('PALETTE: the spec colours', () => {
  expect(PALETTE).toEqual({
    green: '#00FF41',
    green2: '#00B32C',
    faint: '#0D3B1A',
    surface: '#06120A',
    warn: '#E2A94E',
    alert: '#FF5F56',
    done: '#3BFF6E',
    lightGreen: '#00802A',
  })
})
