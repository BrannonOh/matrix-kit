import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

const PLUGIN = 'matrix-kit'
const PLAN = 'mcp__ccd_turn__update_plan' as const

const band = { hasSurvey: false, isWorking: false, maxRows: 4, bodyColumns: 100, scroll: { offset: 0, bodyRows: 4 }, view: {} }

const steps = [
  { content: 'Write the parser', status: 'in_progress' },
  { content: 'Wire the CLI', status: 'pending' },
]

// The engine beneath: every task-list tool answers; TaskCreate hands back ids in order.
// With no list, the band draws only what is beneath it.
function answerTools(on: On) {
  on('ui.render', { component: 'AbovePrompt' }, () => ({ type: 'engine', ref: 0 }) as never)
  let id = 0
  on('tool.call', { tool: PLAN }, () => ({ result: 'ok' }) as never)
  on('tool.call', { tool: 'mcp__ccd_turn__wrap_up' }, () => ({ result: 'ok' }) as never)
  on('tool.call', { tool: 'TodoWrite' }, () => ({ result: 'ok' }) as never)
  on('tool.call', { tool: 'TaskUpdate' }, () => ({ result: 'ok' }) as never)
  on('tool.call', { tool: 'TaskCreate' }, () => ({ result: { task: { id: String(++id), subject: '' } } }) as never)
}

// The band's words in the terminal: title, count, or nothing when it is not drawn.
async function bandText($: Engine): Promise<string> {
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AbovePrompt', props: band })
  const shown = (await ui.findAll({ type: 'Text' })).map(t => String(t.props.children ?? t.text ?? '')).join(' ')
  const hasRow = (await ui.find({ key: 'matrix-construct' })) !== undefined
  await ui.unmount()
  return hasRow ? shown : ''
}

async function label($: Engine): Promise<string | undefined> {
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AbovePrompt', props: band })
  const found = await ui.find({ type: 'Text', text: /^(Tasks \d+\/\d+|Done)$/ })
  await ui.unmount()
  return found?.text
}

const startPrompt = ($: Engine) => ($.turn.start as (e: unknown) => Promise<unknown>)({ turnId: 'turn', text: 'next' })

test("the band follows the desktop app's task list, step by step", async ($, on) => {
  answerTools(on)
  expect(await label($)).toBe(undefined)

  await $.tool.call({ tool: PLAN, items: steps, scope: 'first_task' } as never)
  expect(await label($)).toBe('Tasks 0/2')
  expect(await bandText($)).toContain('Write the parser')

  await $.tool.call({ tool: PLAN, advance: true } as never)
  expect(await label($)).toBe('Tasks 1/2')
  expect(await bandText($)).toContain('Wire the CLI')

  // wrap_up checks the list off.
  await $.tool.call({ tool: 'mcp__ccd_turn__wrap_up', recap: 'Done.' } as never)
  expect(await label($)).toBe('Done')
})

test('a finished list stays until the next prompt, then the band hides', async ($, on) => {
  answerTools(on)
  on('turn.start', () => ({ turnId: 'turn' }) as never)
  await $.tool.call({ tool: PLAN, items: steps, scope: 'first_task' } as never)

  // An unfinished list carries over into the next prompt.
  await startPrompt($)
  expect(await label($)).toBe('Tasks 0/2')

  await $.tool.call({ tool: 'mcp__ccd_turn__wrap_up', recap: 'Done.' } as never)
  expect(await label($)).toBe('Done')
  await startPrompt($)
  expect(await label($)).toBe(undefined)
})

test("a subagent's task list is its own, not the session's", async ($, on) => {
  answerTools(on)
  await $.tool.call({ tool: PLAN, items: steps, scope: 'first_task' } as never)
  await $.tool.call({ tool: PLAN, agentId: 'a1', items: [{ content: 'Hijacked', status: 'completed' }] } as never)
  await $.tool.call({ tool: 'TodoWrite', agentId: 'a1', todos: [{ content: 'Hijacked', status: 'completed', activeForm: 'x' }] } as never)
  expect(await label($)).toBe('Tasks 0/2')
  expect(await bandText($)).not.toContain('Hijacked')
})

test("the CLI's TodoWrite and TaskCreate / TaskUpdate drive the band too", async ($, on) => {
  answerTools(on)
  await $.tool.call({ tool: 'TodoWrite', todos: [{ content: 'Profile it', status: 'completed', activeForm: 'Profiling' }, { content: 'Cache it', status: 'in_progress', activeForm: 'Caching' }] } as never)
  expect(await label($)).toBe('Tasks 1/2')

  await $.tool.call({ tool: 'TodoWrite', todos: [{ content: 'Profile it', status: 'completed', activeForm: 'Profiling' }, { content: 'Cache it', status: 'completed', activeForm: 'Caching' }] } as never)
  expect(await label($)).toBe('Done')

  // A task created after a finished list starts a new one.
  await $.tool.call({ tool: 'TaskCreate', subject: 'Find the leak', description: '' } as never)
  await $.tool.call({ tool: 'TaskCreate', subject: 'Patch it', description: '' } as never)
  await $.tool.call({ tool: 'TaskUpdate', taskId: '1', status: 'completed' } as never)
  expect(await label($)).toBe('Tasks 1/2')
})

test('an errored task-list call changes nothing', async ($, on) => {
  on('ui.render', { component: 'AbovePrompt' }, () => ({ type: 'engine', ref: 0 }) as never)
  on('tool.call', { tool: PLAN }, () => ({ result: 'bad input', isError: true }) as never)
  await $.tool.call({ tool: PLAN, items: steps, scope: 'first_task' } as never)
  expect(await label($)).toBe(undefined)
})

// Every subagent but Explore is told to report its steps; any subagent brings the panel up, once per prompt.
for (const [subagentType, isBriefed] of [['general-purpose', true], ['savvy-careful', true], ['Explore', false]] as const) {
  test(`spawn: ${subagentType} ${isBriefed ? 'is' : 'is not'} briefed to report steps, and opens The Construct`, async ($, on) => {
    mock.clock(on)
    const opened: string[] = []
    on('ui.open', (_$, e) => {
      opened.push(e.id)
      return { value: { isPlaced: true } }
    })
    let prompt = ''
    on('agent.spawn', (_$, e) => {
      prompt = e.prompt
      return { model: 'claude-opus-5-5', agentId: 'a1' } as never
    })
    await $.agent.spawn({ tool_use_id: 't1', prompt: 'Fix the parser', description: 'Fix it', subagentType, provider: 'engine', parentModel: 'claude-opus-5-5', background: false, fork: false } as never)

    expect(prompt.includes('mcp__matrix-kit__step')).toBe(isBriefed)
    expect(opened).toEqual(['matrix-construct'])
  })
}

test('The Construct opens by itself once per prompt', async ($, on) => {
  mock.clock(on)
  on('turn.start', () => ({ turnId: 'turn' }) as never)
  let opened = 0
  on('ui.open', () => {
    opened++
    return { value: { isPlaced: true } }
  })
  let n = 0
  on('agent.spawn', () => ({ model: 'claude-opus-5-5', agentId: `a${++n}` }) as never)
  const spawn = () =>
    $.agent.spawn({ tool_use_id: `t${n}`, prompt: 'p', description: `Job ${n}`, subagentType: 'general-purpose', provider: 'engine', parentModel: 'claude-opus-5-5', background: false, fork: false } as never)

  await spawn()
  await spawn()
  expect(opened).toBe(1)
  // A subagent's own turn is not a new prompt.
  await ($.turn.start as (e: unknown) => Promise<unknown>)({ turnId: 'sub', agentId: 'a1', text: '' })
  await spawn()
  expect(opened).toBe(1)

  await startPrompt($)
  await spawn()
  expect(opened).toBe(2)
})
