import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { BASE_USAGE, prompt, startSession } from './testing.ts'

const BAND = { component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 120 } as never } as const

// A session with one main turn done, so the strip has something to show.
async function oneTurn($: Engine, on: On, rateLimits: unknown[] = []) {
  on('session.measure', (_$, e) => ({ changed: e.changed }) as never)
  await startSession($, on, { usage: { startedAt: 0, context: { window: 1_000_000, tokens: 380_000, percent: 38 }, rateLimits, cost: { usd: 0.42 } } })
  await $.session.measure({ context: { window: 1_000_000, tokens: 380_000, percent: 38 }, rateLimits, cost: { usd: 0.42 }, changed: ['context'] } as never)
  await prompt($)
}

const strip = async ($: Engine) => $.ui.mount({ plugin: 'matrix-kit', surface: 'terminal', ...BAND })

test('terminal: after a turn the strip shows speed and context', async ($, on) => {
  await oneTurn($, on)
  const ui = await strip($)
  expect(await ui.find({ type: 'Text', text: /tok\/s/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^38%$/ })).toBeDefined()
  await ui.unmount()
})

test('/operator hides the strip and shows it again', async ($, on) => {
  await oneTurn($, on)
  expect(await $.command.run({ command: 'operator', args: '' } as never)).toMatchObject({ text: 'Operator strip hidden.' })
  expect(await $.command.run({ command: 'operator', args: '' } as never)).toMatchObject({ text: 'Operator strip shown.' })
})

test('/operator demo 4 frames the strip in the alert red', async ($, on) => {
  await oneTurn($, on)
  await $.command.run({ command: 'operator', args: 'demo 4' } as never)
  const ui = await strip($)
  expect((await ui.find({ key: 'operator' }))?.props.borderColor).toBe('#FF5F56')
  await ui.unmount()
})

test('plan limits show when the engine reports them, and not otherwise', async ($, on) => {
  await oneTurn($, on, [{ kind: 'five_hour', percentUsed: 42, resetsAt: 0 }, { kind: 'seven_day', percentUsed: 18, resetsAt: 0 }])
  const ui = await strip($)
  expect(await ui.find({ type: 'Text', text: /^5h 42% · 7d 18%$/ })).toBeDefined()
  await ui.unmount()
})

test('no plan limits: nothing about them in the strip', async ($, on) => {
  await oneTurn($, on)
  const ui = await strip($)
  expect(await ui.findAll({ type: 'Text', text: /5h|limit/ })).toEqual([])
  await ui.unmount()
})

// Review fix: the strip's icons follow light mode too.
test('desktop: the strip icons darken in light mode', async ($, on) => {
  await oneTurn($, on)
  const ui = await $.ui.mount({ plugin: 'matrix-kit', surface: 'desktop', ...BAND })
  const icons = (await ui.findAll({ type: 'Svg' })).map(s => String(s.props.source ?? ''))
  await ui.unmount()
  expect(icons.length > 0).toBe(true)
  for (const icon of icons) expect(icon.includes('prefers-color-scheme: light')).toBe(true)
})

// A turn where the engine reports no cost and no context figures yet.
async function bareTurn($: Engine, on: On, cost?: { usd: number }) {
  await startSession($, on, { usage: { ...BASE_USAGE, ...(cost ? { cost } : {}) } })
  await prompt($)
}

test('no cost from the engine: both costs read "—", not $0.00', async ($, on) => {
  await bareTurn($, on)
  const ui = await strip($)
  expect(await ui.find({ type: 'Text', text: /^\| —$/ })).toBeDefined()
  expect(await ui.findAll({ type: 'Text', text: /\$0\.00/ })).toEqual([])
  await ui.unmount()
})

test('no context figure yet: the context reads "—", not 0%', async ($, on) => {
  await bareTurn($, on, { usd: 0.42 })
  const ui = await strip($)
  expect(await ui.findAll({ type: 'Text', text: /^0%$/ })).toEqual([])
  await ui.unmount()
})

test('the strip formats money like the panel', async ($, on) => {
  await bareTurn($, on, { usd: 12.34 })
  const ui = await strip($)
  expect(await ui.find({ type: 'Text', text: /^\| \$12\.3$/ })).toBeDefined()
  await ui.unmount()
})


test('no cost at the prompt\'s start: its cost is "—" even once a session cost arrives', async ($, on) => {
  let cost: { usd: number } | undefined
  await startSession($, on, { usage: () => ({ startedAt: 0, context: { window: 1_000_000, tokens: 1_000, percent: 1 }, rateLimits: [], ...(cost ? { cost } : {}) }) })
  await ($.turn.start as (e: unknown) => Promise<unknown>)({ turnId: 'turn', text: 'hi' })
  cost = { usd: 0.42 }
  await ($.turn.complete as (e: unknown) => Promise<unknown>)({ reason: 'answer', answer: 'ok', durationMs: 1000, usage: null })
  const ui = await strip($)
  expect(await ui.find({ type: 'Text', text: /^\| \$0\.42$/ })).toBeDefined()
  expect(await ui.findAll({ type: 'Text', text: /^\$\d/ })).toEqual([])
  await ui.unmount()
})
