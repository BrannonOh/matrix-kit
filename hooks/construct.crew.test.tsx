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
