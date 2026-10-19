# matrix-kit coding standards

Judgement calls for review. `npm run check` (typecheck, strict validate, tests) runs before every commit and covers the mechanical rules; this file covers what it cannot. The design spec (`docs/specs/2026-10-18-matrix-kit-design.md`) is the source for what each figure means.

## Figures

- **Unknown stays unknown.** A figure Claude Code has not reported is `null` from collection to drawing, and draws as `—`. Every value computed from it is `null` too (a cost delta needs both ends known). `0` is a real reading, never a stand-in.
- **One formatter per kind.** Money, tokens, durations and clock times go through `hooks/lib/format.ts`, so the strip and The Construct show one amount the same way.
- **A partial figure says which part.** A label names its scope when it counts less than the whole session: "Worker lines", "Crew cost".

## Drawing

- **Every bright green has a light-mode shade.** A green set as a `fill`/`stroke` attribute reaches light mode through `lightGreensCss` (`hooks/lib/theme.ts`); a class colour goes in the class's light-mode rule. A new crew accent gets its own entry in `CHARACTER_LIGHT_COLOR`, readable on white.
- **Dark mode is the Matrix.** Light-mode fixes live inside `prefers-color-scheme: light` and leave dark mode as it was.
- **Words live in `S`.** The panel's and band's words come from `S` in `construct.tsx`, referenced directly.

## Structure

- **Shared hooks are function declarations.** A hook both halves need is an exported `function` typed with `HookArgs` and `Then` (`hooks/lib/shared.ts`) and chained in `register.tsx`: the engine follows `$` across an import only into a function declaration.

## Tests

- **Test what Brannon sees.** Mount the pane or strip and look for a terminal `Text` line or the desktop SVG source. `/operator json` is only for a figure not drawn yet.
- **Start sessions with `startSession`** (`hooks/testing.ts`), which answers every engine call `session.start` makes and fails loudly when one goes unanswered. A new engine call at session start gets its answer there.
- **Each fix has a test that failed first.**
