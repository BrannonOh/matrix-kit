import type { Register } from 'claude-code'

import { constructAbovePrompt, constructSessionStart, constructTurnComplete, constructTurnStart, constructTurnStep, registerConstruct } from './construct.tsx'
import { operatorAbovePrompt, operatorSessionStart, operatorTurnComplete, operatorTurnStart, operatorTurnStep, registerOperator } from './operator.tsx'

// The engine loads one hooks module and refuses a second unmatched hook on one
// event, so the events both halves need are registered here once, construct's
// hook first: its `next` runs operator's, so the progress bar draws above the strip.
export const register: Register = on => {
  registerConstruct(on)
  registerOperator(on)

  on('session.start', async ($, e, next) => constructSessionStart($, e, ev => operatorSessionStart($, ev, next)))
  on('turn.start', async ($, e, next) => constructTurnStart($, e, ev => operatorTurnStart($, ev, next)))
  on('turn.step', async function* ($, e, next) {
    return yield* constructTurnStep($, e, ev => operatorTurnStep($, ev, next))
  })
  on('turn.complete', async ($, e, next) => constructTurnComplete($, e, ev => operatorTurnComplete($, ev, next)))
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => constructAbovePrompt($, e, ev => operatorAbovePrompt($, ev, next)))
}
