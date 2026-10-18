import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

const BAND = { component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 120 } as never } as const

// A session with one main turn done, so the strip has something to show.
async function oneTurn($: Engine, on: On, rateLimits: unknown[] = []) {
  mock.clock(on)
  on('session.start', async () => ({ cwd: '/repo' }) as never)
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 1_000_000, tokens: 380_000, percent: 38 }, rateLimits, cost: { usd: 0.42 } } }) as never)
  on('session.measure', (_$, e) => ({ changed: e.changed }) as never)
  on('turn.start', () => ({ turnId: 'turn' }) as never)
  on('turn.complete', () => ({ text: '' }) as never)
  await $.session.start({ source: 'startup', cwd: '/repo', surface: 'terminal', isInteractive: true } as never)
  await $.session.measure({ context: { window: 1_000_000, tokens: 380_000, percent: 38 }, rateLimits, cost: { usd: 0.42 }, changed: ['context'] } as never)
  await ($.turn.start as (e: unknown) => Promise<unknown>)({ turnId: 'turn', text: 'hi' })
  await ($.turn.complete as (e: unknown) => Promise<unknown>)({ reason: 'answer', answer: 'ok', durationMs: 1000, usage: null })
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
