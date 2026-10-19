import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

const PLUGIN = 'matrix-kit'
const PANE = 'matrix-construct'
const pane = { title: '', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} } as const

// One running worker of `subagentType`, known to the panel.
const worker = async ($: Engine, on: On, subagentType: string) => {
  mock.clock(on)
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('agent.spawn', () => ({ model: 'claude-opus-5-5', agentId: 'a1' }) as never)
  on('turn.complete', () => ({ text: '' }) as never)
  await $.agent.spawn({ tool_use_id: 't1', prompt: 'p', description: 'Fix the parser', subagentType, provider: 'engine', parentModel: 'claude-opus-5-5', background: false, fork: false } as never)
}

const desktopSources = async ($: Engine): Promise<string> => {
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', requestId: PANE, props: pane })
  const svgs = await ui.findAll({ type: 'Svg' })
  await ui.unmount()
  return svgs.map(s => String(s.props.source ?? '')).join('\n')
}

const terminalShows = async ($: Engine, text: RegExp): Promise<boolean> => {
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: PANE, props: pane })
  const found = await ui.find({ type: 'Text', text })
  await ui.unmount()
  return found !== undefined && found !== null
}

test('desktop: a running Neo is drawn as the Neo sprite at work', async ($, on) => {
  await worker($, on, 'matrix-kit:neo')
  const source = await desktopSources($)
  expect(source.includes('ch-neo')).toBe(true)
  expect(source.includes('st-running')).toBe(true)
})

test('terminal: a running Neo shows his badge letter, his name and the task', async ($, on) => {
  await worker($, on, 'matrix-kit:neo')
  expect(await terminalShows($, /^N$/)).toBe(true)
  expect(await terminalShows($, /Neo/)).toBe(true)
  expect(await terminalShows($, /Fix the parser/)).toBe(true)
})

test('terminal: an Explore agent is played by The Oracle', async ($, on) => {
  await worker($, on, 'Explore')
  expect(await terminalShows($, /The Oracle/)).toBe(true)
})

// Review Focus 5: Neo without Fable access ends in an error; the row must not stay running.
test('a worker whose turn ends in an error shows as failed', async ($, on) => {
  await worker($, on, 'matrix-kit:neo')
  await ($.turn.complete as (e: unknown) => Promise<unknown>)({ agentId: 'a1', reason: 'error', answer: '', usage: null })
  expect((await desktopSources($)).includes('st-failed')).toBe(true)
  expect(await terminalShows($, /✗/)).toBe(true)
})

test('/construct opens The Construct, and again closes it', async ($, on) => {
  // The command is registered at session start.
  mock.clock(on)
  on('session.start', async () => ({ cwd: '/repo' }) as never)
  on('command.register', (_$, e) => ({ value: { command: e.name } }) as never)
  const panes: { id: string }[] = []
  on('ui.open', (_$, e) => {
    panes.push({ id: e.id })
    return { value: { isPlaced: true } }
  })
  on('ui.panes', () => ({ value: [...panes] }) as never)
  on('ui.close', (_$, e) => {
    panes.splice(panes.findIndex(p => p.id === e.id), 1)
    return { value: undefined } as never
  })
  await $.session.start({ source: 'startup', cwd: '/repo', surface: 'terminal', isInteractive: true } as never)
  expect(await $.command.run({ command: 'construct', args: '' } as never)).toMatchObject({ text: 'The Construct opened.' })
  expect(await $.command.run({ command: 'construct', args: '' } as never)).toMatchObject({ text: 'The Construct closed.' })
})

// The metrics block: a main turn's figures, as the operator collected them.
const mainTurn = async ($: Engine, on: On, usage: unknown, reason = 'answer') => {
  mock.clock(on)
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 1_000_000 }, rateLimits: [], cost: { usd: 0.1 } } }) as never)
  on('tool.call', (_$, e) => ({ result: {}, ...(e.tool === 'Bash' ? { isError: true } : {}) }) as never)
  on('turn.start', () => ({ turnId: 'turn' }) as never)
  on('turn.complete', () => ({ text: '' }) as never)
  await ($.turn.complete as (e: unknown) => Promise<unknown>)({ reason, answer: '', usage })
}

const USAGE = { model: 'claude-opus-5-5', input_tokens: 100, output_tokens: 5, cache_read_input_tokens: 300, cache_creation_input_tokens: 100 }

test('terminal: the metrics block shows the cache hit rate of the last turn', async ($, on) => {
  await mainTurn($, on, USAGE)
  expect(await terminalShows($, /^Cache hit 60%$/)).toBe(true)
})

test('terminal: tool calls are counted with their errors', async ($, on) => {
  await mainTurn($, on, USAGE)
  await $.tool.call({ tool: 'Bash', command: 'false' } as never)
  expect(await terminalShows($, /^Tools 1 \(1 err\)$/)).toBe(true)
})

// Review Focus 1: an interrupted turn reports no usage; nothing may throw and unknowns read "—".
test('terminal: an aborted turn with no usage shows dashes, not errors', async ($, on) => {
  await mainTurn($, on, null, 'aborted')
  expect(await terminalShows($, /^First token —$/)).toBe(true)
  expect(await terminalShows($, /^Cache hit —$/)).toBe(true)
  expect(await terminalShows($, /^Turn —$/)).toBe(true)
})

test('desktop: the metrics block is drawn in the header', async ($, on) => {
  await mainTurn($, on, USAGE)
  expect((await desktopSources($)).includes('Cache hit')).toBe(true)
})

// Review fix: an aborted turn must not show the previous turn's figures as its own.
test('terminal: a turn aborted after a good one shows dashes again', async ($, on) => {
  await mainTurn($, on, USAGE)
  await ($.turn.start as (e: unknown) => Promise<unknown>)({ turnId: 'turn2', text: 'again' })
  await ($.turn.complete as (e: unknown) => Promise<unknown>)({ reason: 'aborted', answer: '', usage: null })
  expect(await terminalShows($, /^Cache hit —$/)).toBe(true)
  expect(await terminalShows($, /^First token —$/)).toBe(true)
})

test('desktop: the crew totals live in the metrics block, not in separate header tiles', async ($, on) => {
  await mainTurn($, on, USAGE)
  const source = await desktopSources($)
  expect(source.includes('rx="8"')).toBe(false)
  expect(source.includes('Crew cost')).toBe(true)
})

test('terminal: lines changed are labelled as the workers\' own', async ($, on) => {
  await mainTurn($, on, USAGE)
  expect(await terminalShows($, /^Worker lines \+0 −0$/)).toBe(true)
})

test('desktop: the panel darkens its greens in light mode', async ($, on) => {
  await worker($, on, 'matrix-kit:neo')
  const source = await desktopSources($)
  expect(/prefers-color-scheme: light\)\{[^}]*\[fill="#00FF41"\]/.test(source)).toBe(true)
})

test('the session clock keeps ticking in an open Construct while nothing runs', async ($, on) => {
  const clock = mock.clock(on)
  on('session.start', async () => ({ cwd: '/repo' }) as never)
  on('command.register', (_$, e) => ({ value: { command: e.name } }) as never)
  on('tool.register', (_$, e) => ({ value: { tool: e.name } }) as never)
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 1_000_000 }, rateLimits: [] } }) as never)
  on('ui.panes', () => ({ value: [{ id: PANE }] }) as never)
  await $.session.start({ source: 'startup', cwd: '/repo', surface: 'terminal', isInteractive: true } as never)
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: PANE, props: pane })
  expect(await ui.find({ type: 'Text', text: /^Session 0:00$/ })).toBeDefined()
  await clock.advance(5_000)
  expect(await ui.find({ type: 'Text', text: /^Session 0:05$/ })).toBeDefined()
  await ui.unmount()
})

test('the session clock stays still while The Construct is closed and nothing runs', async ($, on) => {
  const clock = mock.clock(on)
  on('session.start', async () => ({ cwd: '/repo' }) as never)
  on('command.register', (_$, e) => ({ value: { command: e.name } }) as never)
  on('tool.register', (_$, e) => ({ value: { tool: e.name } }) as never)
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 1_000_000 }, rateLimits: [] } }) as never)
  on('ui.panes', () => ({ value: [] }) as never)
  await $.session.start({ source: 'startup', cwd: '/repo', surface: 'terminal', isInteractive: true } as never)
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: PANE, props: pane })
  await clock.advance(5_000)
  expect(await ui.find({ type: 'Text', text: /^Session 0:00$/ })).toBeDefined()
  await ui.unmount()
})

test('desktop: in light mode Morpheus darkens to a green of his own, not the shared one', async ($, on) => {
  await worker($, on, 'matrix-kit:morpheus')
  const source = await desktopSources($)
  const light = /\[fill="#2E8B57"\]\{fill:(#[0-9A-Fa-f]{6})\}/.exec(source)?.[1]
  expect(light === undefined || light.toUpperCase() === '#00802A').toBe(false)
})
