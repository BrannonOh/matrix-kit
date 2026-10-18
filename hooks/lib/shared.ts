import type { EventName, Hook, Register } from 'claude-code'

export type Options = Parameters<Register>[1]

// A hook shared between construct.tsx and operator.tsx is a function declaration
// typed by these, which register.tsx chains: the engine follows `$` across an
// import only into a function declaration.
export type HookArgs<E extends EventName> = Parameters<Hook<E>>
