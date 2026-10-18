import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

const BAND = { component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 100 } as never } as const

async function session($: Engine, on: On) {
  mock.clock(on, { now: Date.parse('2026-10-10T02:00:00Z') })
  on('session.start', async () => ({ cwd: '/repo' }) as never)
  await $.session.start({ source: 'startup', cwd: '/repo', surface: 'terminal', isInteractive: true } as never)
  await $.tool.call({ tool: 'mcp__matrix-kit__progress', title: 'Ship it', total: 4, done: 1, phase: 'delegate' } as never)
}

async function band($: Engine, surface: 'terminal' | 'desktop') {
  const ui = await $.ui.mount({ plugin: 'matrix-kit', surface, ...BAND })
  const svg = await ui.findAll({ type: 'Svg' })
  const title = await ui.findAll({ type: 'Text', text: /^Ship it$/ })
  const label = await ui.findAll({ type: 'Text', text: /^Tasks 1\/4$/ })
  await ui.unmount()
  return { svg: svg.length, title: title.length, label: label.length }
}

test('terminal: the row draws the title, bar and label as text, not an Svg', async ($, on) => {
  await session($, on)
  expect(await band($, 'terminal')).toEqual({ svg: 0, title: 1, label: 1 })
})

test('desktop: the row is still one Svg', async ($, on) => {
  await session($, on)
  expect(await band($, 'desktop')).toEqual({ svg: 1, title: 0, label: 0 })
})

async function bandSource($: Engine): Promise<string> {
  const ui = await $.ui.mount({ plugin: 'matrix-kit', surface: 'desktop', ...BAND })
  const [svg] = await ui.findAll({ type: 'Svg' })
  await ui.unmount()
  return String(svg?.props.source ?? '')
}

test('desktop: the bar fills with green code-rain glyphs, not dots', async ($, on) => {
  await session($, on)
  const source = await bandSource($)
  expect(/<text[^>]*class="acc"[^>]*>[ｱ-ｿ0-9]<\/text>/.test(source)).toBe(true)
  expect(source.includes('25%')).toBe(true)
  expect(source.includes('<rect class="t')).toBe(false)
})

test('desktop: a finished flow glows in the done green', async ($, on) => {
  await session($, on)
  await $.tool.call({ tool: 'mcp__matrix-kit__progress', finished: true } as never)
  expect((await bandSource($)).includes('#3BFF6E')).toBe(true)
})

test('terminal: the bar is drawn in phosphor green', async ($, on) => {
  await session($, on)
  const ui = await $.ui.mount({ plugin: 'matrix-kit', surface: 'terminal', ...BAND })
  const [bar] = await ui.findAll({ type: 'Text', text: /█/ })
  await ui.unmount()
  expect(bar?.props.color).toBe('#00FF41')
})
