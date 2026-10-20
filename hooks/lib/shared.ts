import type { EventName, Hook, HookStream, RenderInput } from 'claude-code'

// A hook shared between construct.tsx and operator.tsx is a function declaration
// typed by these, which register.tsx chains: the engine follows `$` across an
// import only into a function declaration.
export type HookArgs<E extends EventName> = Parameters<Hook<E>>

// The `next` a shared hook calls: the engine's own, or register.tsx's link to the
// other half. Only its call is used, so a plain function of the input fits.
type Out<E extends EventName> = ReturnType<HookArgs<E>[2]>
export type Then<E extends EventName, I = HookArgs<E>[1]> = (e: I) => Out<E> extends HookStream<infer C, infer R> ? AsyncGenerator<C, R> : Out<E>

// The band above the prompt, which register.tsx narrows to.
export type AbovePromptInput = RenderInput<'AbovePrompt'>
