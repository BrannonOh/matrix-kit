import { expect, test } from 'claude-code/testing'

import { applyPlan, progressOf } from './plan.ts'
import type { Plan } from './plan.ts'

const three = applyPlan(null, {
  kind: 'plan',
  items: [
    { content: 'Read the code', status: 'in_progress' },
    { content: 'Write the fix', status: 'pending' },
    { content: 'Run the tests', status: 'pending' },
  ],
})

const statuses = (p: Plan | null) => p?.steps.map(s => s.status)

test('a new list is mirrored as given', () => {
  expect(progressOf(three)).toEqual({ done: 0, total: 3, current: 'Read the code', isFinished: false })
})

test('advance completes the step in progress and starts the next pending one', () => {
  const next = applyPlan(three, { kind: 'plan', advance: true })
  expect(statuses(next)).toEqual(['completed', 'in_progress', 'pending'])
  expect(progressOf(next)?.current).toBe('Write the fix')
})

test('done and start move steps out of order, keeping one step in progress', () => {
  const next = applyPlan(three, { kind: 'plan', done: [1, 2], start: 3 })
  expect(statuses(next)).toEqual(['completed', 'completed', 'in_progress'])
  // Starting a step elsewhere hands the old one back to pending.
  expect(statuses(applyPlan(three, { kind: 'plan', start: 3 }))).toEqual(['pending', 'pending', 'in_progress'])
})

test('wrapping up checks every step off', () => {
  expect(progressOf(applyPlan(three, { kind: 'finish' }))).toEqual({ done: 3, total: 3, current: '', isFinished: true })
  // With no list there is nothing to finish.
  expect(applyPlan(null, { kind: 'finish' })).toBe(null)
})

test("the CLI's TodoWrite replaces the list, like update_plan's items", () => {
  const todos = applyPlan(three, {
    kind: 'todos',
    todos: [
      { content: 'Profile it', status: 'completed', activeForm: 'Profiling it' },
      { content: 'Cache it', status: 'in_progress', activeForm: 'Caching it' },
    ],
  })
  expect(progressOf(todos)).toEqual({ done: 1, total: 2, current: 'Cache it', isFinished: false })
})

test("the CLI's TaskCreate adds a step and TaskUpdate moves or deletes it by id", () => {
  let p = applyPlan(null, { kind: 'create', id: '7', subject: 'Find the leak' })
  p = applyPlan(p, { kind: 'create', id: '8', subject: 'Patch it' })
  p = applyPlan(p, { kind: 'update', taskId: '7', status: 'in_progress' })
  expect(progressOf(p)).toEqual({ done: 0, total: 2, current: 'Find the leak', isFinished: false })

  p = applyPlan(p, { kind: 'update', taskId: '7', status: 'completed' })
  p = applyPlan(p, { kind: 'update', taskId: '8', status: 'deleted' })
  expect(progressOf(p)).toEqual({ done: 1, total: 1, current: '', isFinished: true })
})

test('a task created after the list is finished starts a new list', () => {
  const next = applyPlan(applyPlan(three, { kind: 'finish' }), { kind: 'create', id: '1', subject: 'Next job' })
  expect(progressOf(next)).toEqual({ done: 0, total: 1, current: '', isFinished: false })
})

test('step numbers outside the list change nothing', () => {
  expect(statuses(applyPlan(three, { kind: 'plan', done: [0, 9, 1.5], start: 7 }))).toEqual(statuses(three))
})
