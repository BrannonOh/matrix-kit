import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

const MODEL = 'claude-opus-5-5'
const USAGE = { input_tokens: 100, output_tokens: 5, cache_read_input_tokens: 300, cache_creation_input_tokens: 100 }

// A started session whose engine answers tool calls, turns and usage reads; `mocks`
// adds the test's own answers first, since every hook must be on before the first $ call.
async function session($: Engine, on: On, mocks: (on: On) => void = () => {}) {
  mock.clock(on)
  mocks(on)
  on('session.start', async () => ({ cwd: '/repo' }) as never)
  on('session.usage', () => ({ value: { startedAt: 1_000, context: { window: 1_000_000 }, rateLimits: [], cost: { usd: 0.5 } } }) as never)
  on('turn.start', () => ({}) as never)
  on('turn.complete', () => ({ text: '' }) as never)
  await $.session.start({ source: 'startup', cwd: '/repo', surface: 'terminal', isInteractive: true } as never)
}

const metrics = async ($: Engine) => {
  const reply = (await $.command.run({ command: 'operator', args: 'json' } as never)) as { text: string }
  return JSON.parse(reply.text)
}

test('tool calls are counted this turn, errors apart', async ($, on) => {
  await session($, on, o => o('tool.call', (_$, e) => ({ result: {}, ...(e.tool === 'Bash' ? { isError: true } : {}) }) as never))
  await $.tool.call({ tool: 'Read', file_path: '/repo/a.ts' } as never)
  await $.tool.call({ tool: 'Bash', command: 'false' } as never)
  expect((await metrics($)).tools).toMatchObject({ turn: 2, turnErrors: 1, session: 2, sessionErrors: 1 })
})

test("a worker's lines changed come from the Agent tool's toolStats", async ($, on) => {
  const toolStats = { readCount: 0, searchCount: 0, bashCount: 0, editFileCount: 1, linesAdded: 12, linesRemoved: 4, otherToolCount: 0 }
  await session($, on, o => o('tool.call', () => ({ result: { status: 'completed', toolStats } }) as never))
  await $.tool.call({ tool: 'Agent', subagent_type: 'general-purpose', description: 'Edit', prompt: 'p' } as never)
  expect(await metrics($)).toMatchObject({ linesAdded: 12, linesRemoved: 4 })
})

test("a main turn's duration and token split are kept", async ($, on) => {
  await session($, on)
  await ($.turn.complete as (e: unknown) => Promise<unknown>)({ reason: 'answer', answer: 'ok', durationMs: 4200, usage: { model: MODEL, ...USAGE } })
  expect(await metrics($)).toMatchObject({ turnMs: 4200, lastTurn: { input: 100, output: 5, cacheRead: 300, cacheWrite: 100 } })
})

test('session.measure stores limits and cost, and keeps the context through a compaction', async ($, on) => {
  await session($, on, o => o('session.measure', (_$, e) => ({ changed: e.changed }) as never))
  const limits = [{ kind: 'five_hour', percentUsed: 42, resetsAt: 9_000 }]
  await $.session.measure({ context: { window: 1_000_000, tokens: 250_000, percent: 25 }, rateLimits: limits, cost: { usd: 1.5 }, changed: ['context', 'rateLimits', 'cost'] } as never)
  await $.session.measure({ context: { window: 1_000_000 }, rateLimits: limits, cost: { usd: 1.5 }, changed: ['context'] } as never)
  expect(await metrics($)).toMatchObject({ rateLimits: limits, costUsd: 1.5, context: { tokens: 250_000, window: 1_000_000, percent: 25 } })
})

test('a main request records model, effort, time to first token and cache savings', async ($, on) => {
  await session($, on, o =>
    o('turn.step', async function* () {
      yield { kind: 'text', index: 0, text: 'Hi' } as never
      return { turnId: 'turn', index: 0, answer: 'Hi', toolUses: [], stopReason: 'end_turn', usage: { model: MODEL, ...USAGE, cache_read_input_tokens: 2e6 } } as never
    }),
  )
  const stream = ($.turn.step as (e: unknown) => AsyncIterable<unknown>)({ turnId: 'turn', index: 0, model: MODEL, effort: 'high', messageCount: 1 })
  for await (const _ of stream) void _
  const m = await metrics($)
  expect(m).toMatchObject({ model: MODEL, effort: 'high', ttftMs: 0 })
  // 2M cache reads on Opus 5.5 save 2 × (4 − 0.20) = $7.60.
  expect(Math.abs(m.cacheSavingsUsd - 7.6)).toBeLessThan(1e-9)
})
