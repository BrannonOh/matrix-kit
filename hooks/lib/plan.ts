// The session's task list, mirrored from the calls that keep it: the desktop app's
// `update_plan`, or the CLI's TodoWrite / TaskCreate / TaskUpdate. Pure, so the
// band and its tests share one set of rules.

import type { Plan, Step, StepStatus } from '../../types/index.d.ts'

export type { Plan }

// TodoWrite's items also carry an activeForm, which the band does not draw.
type Item = { content?: string; status?: string; activeForm?: string }

export type PlanEvent =
  // The desktop app's update_plan.
  | { kind: 'plan'; items?: Item[]; advance?: boolean; done?: number[]; start?: number }
  // Its wrap_up, which checks the list off.
  | { kind: 'finish' }
  // The CLI's TodoWrite: the whole list each time.
  | { kind: 'todos'; todos?: Item[] }
  // The CLI's TaskCreate (its id comes back in the result) and TaskUpdate.
  | { kind: 'create'; id: string; subject?: string }
  | { kind: 'update'; taskId?: string; subject?: string; status?: string }

const MAX_STEPS = 50
const MAX_CONTENT = 120

const statusOf = (s: unknown): StepStatus => (s === 'in_progress' || s === 'completed' ? s : 'pending')

const stepsOf = (items: Item[]): Step[] =>
  items
    .filter(i => typeof i?.content === 'string' && i.content.trim())
    .slice(0, MAX_STEPS)
    .map((i, n) => ({ id: String(n + 1), content: (i.content ?? '').trim().slice(0, MAX_CONTENT), status: statusOf(i.status) }))

const advance = (steps: Step[]): Step[] => {
  const at = steps.findIndex(s => s.status === 'in_progress')
  const next = steps.findIndex((s, i) => i > at && s.status === 'pending')
  return steps.map((s, i) => (i === at ? { ...s, status: 'completed' } : i === next ? { ...s, status: 'in_progress' } : s))
}

// 1-based, as the tool numbers steps; a number outside the list is dropped.
const indexOf = (steps: Step[], n: unknown): number => (Number.isInteger(n) && (n as number) >= 1 && (n as number) <= steps.length ? (n as number) - 1 : -1)

const markDone = (steps: Step[], done: number[]): Step[] => {
  const at = new Set(done.map(n => indexOf(steps, n)))
  return steps.map((s, i) => (at.has(i) ? { ...s, status: 'completed' } : s))
}

// One step in progress at a time: the one started elsewhere goes back to pending.
const start = (steps: Step[], n: number): Step[] => {
  const at = indexOf(steps, n)
  if (at < 0) return steps
  return steps.map((s, i) => (i === at ? { ...s, status: 'in_progress' } : s.status === 'in_progress' ? { ...s, status: 'pending' } : s))
}

const result = (steps: Step[]): Plan | null => (steps.length ? { steps } : null)

export const applyPlan = (prev: Plan | null, e: PlanEvent): Plan | null => {
  if (e.kind === 'finish') return result((prev?.steps ?? []).map(s => ({ ...s, status: 'completed' })))
  if (e.kind === 'todos') return Array.isArray(e.todos) ? result(stepsOf(e.todos)) : prev
  if (e.kind === 'create') {
    const content = typeof e.subject === 'string' ? e.subject.trim().slice(0, MAX_CONTENT) : ''
    if (!content) return prev
    // A finished list is history: the next task starts a new one.
    const kept = prev && !progressOf(prev)?.isFinished ? prev.steps : []
    return result([...kept.filter(s => s.id !== e.id), { id: e.id, content, status: 'pending' as const }].slice(-MAX_STEPS))
  }
  if (e.kind === 'update') {
    const steps = prev?.steps ?? []
    if (e.status === 'deleted') return result(steps.filter(s => s.id !== e.taskId))
    return result(
      steps.map(s =>
        s.id !== e.taskId
          ? s
          : {
              ...s,
              content: typeof e.subject === 'string' && e.subject.trim() ? e.subject.trim().slice(0, MAX_CONTENT) : s.content,
              status: e.status === undefined ? s.status : statusOf(e.status),
            },
      ),
    )
  }
  let steps = Array.isArray(e.items) ? stepsOf(e.items) : (prev?.steps ?? [])
  if (Array.isArray(e.done)) steps = markDone(steps, e.done)
  if (e.start !== undefined) steps = start(steps, e.start)
  if (e.advance) steps = advance(steps)
  return result(steps)
}

export type Progress = { done: number; total: number; current: string; isFinished: boolean }

export const progressOf = (p: Plan | null): Progress | null => {
  if (!p) return null
  const done = p.steps.filter(s => s.status === 'completed').length
  const current = p.steps.find(s => s.status === 'in_progress')?.content ?? ''
  return { done, total: p.steps.length, current, isFinished: done === p.steps.length }
}
