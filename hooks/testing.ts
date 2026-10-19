// The engine beneath matrix-kit's session.start, for tests.
//
// Both halves' session.start hooks run as one chain (construct's first; its `next`
// runs operator's). An engine call nothing answers skips the hook that made it, and
// the kit reports the skip only when a test fails, so a passing test can hide it.
// Start every test session here: it answers each call the chain makes, and a main
// turn's start and end, and throws when the chain still did not finish. The kit wants each reply as `{ value: … }`.

import type { On } from 'claude-code'
import { mock } from 'claude-code/testing'
import type { Engine, MockClock } from 'claude-code/testing'

export type Usage = {
  startedAt: number
  context: { window: number; tokens?: number; percent?: number }
  rateLimits: unknown[]
  cost?: { usd: number }
}

export const BASE_USAGE: Usage = { startedAt: 0, context: { window: 1_000_000 }, rateLimits: [] }

type Start = {
  // What `session.usage` reports; a function is read on every call.
  usage?: Usage | (() => Usage)
  // The mocked clock's start time.
  now?: number
  source?: 'startup' | 'resume'
}

// Register the test's own hooks before calling this: hooks must be on before the first `$` call.
export async function startSession($: Engine, on: On, start: Start = {}): Promise<MockClock> {
  const clock = mock.clock(on, start.now === undefined ? undefined : { now: start.now })
  const usage = start.usage ?? BASE_USAGE
  const commands: string[] = []
  on('command.register', (_$, e) => {
    commands.push(e.name)
    return { value: { command: e.name } } as never
  })
  on('tool.register', (_$, e) => ({ value: { tool: e.name } }) as never)
  on('session.usage', () => ({ value: typeof usage === 'function' ? usage() : usage }) as never)
  on('session.start', async () => ({ cwd: '/repo' }) as never)
  on('turn.start', () => ({ turnId: 'turn' }) as never)
  on('turn.complete', () => ({ text: '' }) as never)
  await $.session.start({ source: start.source ?? 'startup', cwd: '/repo', surface: 'terminal', isInteractive: true } as never)
  // Each half's session.start registers its command: a missing one means that hook was skipped.
  if (!commands.includes('construct') || !commands.includes('operator')) {
    throw new Error(`session.start did not finish (commands registered: ${commands.join(', ') || 'none'}); a new engine call needs an answer in hooks/testing.ts`)
  }
  return clock
}

// One main prompt, start to answer. The strip stays hidden until the first one.
export async function prompt($: Engine): Promise<void> {
  await ($.turn.start as (e: unknown) => Promise<unknown>)({ turnId: 'turn', text: 'hi' })
  await ($.turn.complete as (e: unknown) => Promise<unknown>)({ reason: 'answer', answer: 'ok', durationMs: 1000, usage: null })
}
