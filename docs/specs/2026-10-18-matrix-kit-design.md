# matrix-kit — design spec

Date: 2026-10-18 · Status: awaiting review · Owner: Brannon Oh

## 1. Goal

A personal Claude Code plugin, `matrix-kit`, that does everything [claude-kit](https://github.com/JohnnyVizz/claude-kit) does, re-themed as The Matrix and extended with more session metrics and chibi Matrix characters as the subagent workers.

Success looks like:

- `/red-pill <task>` runs the plan → delegate → review flow with five character workers.
- A Matrix-styled progress bar and metrics strip sit above the prompt in the desktop app and the terminal.
- The Construct panel shows live metrics and the crew, each character animated while it works.
- It runs on Windows (desktop app first, terminal second) and its tests pass.

Not goals: publishing (it stays local), languages other than English, macOS-only features.

## 2. Provenance and trust

- Base: claude-kit commit `c871c153ead54ad9547cc717d0f3e5a676c73986` (2026-10-13), MIT. Audited file by file on 2026-10-18. The audit found no network access, no obfuscation, no hidden Unicode, no git hooks, no dependencies and no install scripts.
- We copy that snapshot once and never pull upstream again. Future upstream changes are only taken by hand after a fresh audit.
- `LICENSE` keeps the original MIT notice, with our copyright line added. The README credits the source.

## 3. Decisions (from the interview)

| # | Decision |
|---|---|
| Q1–Q2 | All three claude-kit parts, merged into **one plugin**. |
| Q3 | Lives in `C:\Users\brann\matrix-kit`, its own git repo, outside the portfolio. |
| Q4 | Start from the audited snapshot and re-theme it; no rewrite from scratch. |
| Q5 | Workers drawn as **chibi humans** (pixel art), not crab cosplay. |
| Q6 | Phosphor green `#00FF41` on black, monospace, code-rain progress fill. In light mode, green accents on the app's own background. |
| Q7 | Drop the macOS notifier; use Claude Code's notification with a toast fallback. |
| Q8 | English only; remove the ru/he tables and the right-to-left layout code. |
| Q9 | The workflow asks before `git init` and before every commit. |
| Q10 | Metrics split between the strip and the panel (section 6). |
| Q11 | Neo / Morpheus / Trinity / Tank / Mouse are the tiers; Oracle = Explore; Agent Smith = any other agent. |
| Q12 | One signature prop and one working animation per character; failure = green glitch; reduced motion stops everything. |
| Q13 | Plugin `matrix-kit`; commands `/red-pill`, `/construct`, `/operator`; agents `neo`, `morpheus`, `trinity`, `tank`, `mouse`. |
| Q14 | Neo defaults to Fable; switching him to Opus is one line (`model:` in `agents/neo.md`). |
| Q15 | One panel, The Construct: metrics on top, crew below. |
| Q16 | Cache warnings at 10 and 5 minutes left. |
| Q17 | Keep the terminal text rendering, restyled green. |
| Q18 | Keep and extend the original tests. |
| Q19 | Local only for now. |

## 4. Layout

```
matrix-kit/
  .claude-plugin/plugin.json     manifest, userConfig, types pointer
  LICENSE  README.md
  skills/red-pill/SKILL.md       the orchestrator playbook (from savvy-flow)
  agents/neo.md morpheus.md trinity.md tank.md mouse.md
  hooks/hooks.json               { "modules": ["./register.tsx"] }  (the engine allows one module)
  hooks/register.tsx             entry: calls registerConstruct and registerOperator
  hooks/construct.tsx            progress bar + The Construct panel + progress/step tools
  hooks/operator.tsx             metrics strip + metric collection + cache warnings
  hooks/lib/theme.ts             palette, fonts, shared SVG CSS
  hooks/lib/sprites.ts           the seven chibi characters and their animations
  hooks/lib/prices.ts            price table and cost maths (moved out of the original)
  hooks/lib/format.ts            token / money / time formatting
  hooks/*.test.ts(x)             tests (section 10)
  types/index.d.ts               the $.state contract for both modules
  docs/specs/                    this file
```

The engine loads exactly one hooks module. `register.tsx` imports `construct.tsx` and `operator.tsx`, which export `registerConstruct(on, options)` and `registerOperator(on, options)`. Relative runtime imports are allowed; every imported file must end in `.ts` or `.tsx`, and `import()` is not allowed. All state lives in atoms under plugin `matrix-kit`, so the panel reads the metrics that `operator.tsx` collects. Both parts draw `AbovePrompt` and chain with `next(e)`, so the progress bar sits above the metrics strip.

**Verified in task 1 (validator, 2.1.302):** specifiers with the extension (`'./lib/shared.ts'`) load. Two more rules apply:
- **One registration per event.** The plugin may register each event only once without a matcher. The events both halves need (`session.start`, `turn.step`, `turn.complete`, `ui.render` AbovePrompt) are exported from each half as `async function` declarations (`constructSessionStart`, `operatorSessionStart`, …) and registered once in `register.tsx`, which passes construct's hook a `next` that runs operator's.
- **`$` across files.** The validator follows `$` across an import only into a function declaration, so any helper that takes `$` is written `function name($) {…}`, never `const name = ($) => …`.

## 5. Parts

### 5.1 Workflow — `/red-pill <task>`

- `SKILL.md` is the savvy-flow playbook with these changes:
  - renamed throughout;
  - tier table recast as characters;
  - tool names `mcp__matrix-kit__progress` / `mcp__matrix-kit__step`;
  - section 1a changed so the orchestrator **asks** before `git init` and before each commit, and never pushes.
- `disable-model-invocation: true` stays, so the flow runs only when you type the command.
- Agents (frontmatter `model` / `effort`):

| Agent | Character | Model / effort | For |
|---|---|---|---|
| `neo` | Neo | fable / high | hardest logic and bugs; design features on request |
| `morpheus` | Morpheus | opus / xhigh | unfamiliar code, unclear root cause |
| `trinity` | Trinity | opus / high | delicate but well-understood changes |
| `tank` | Tank | opus / medium | standard feature work |
| `mouse` | Mouse | opus / low | mechanical edits, builds, tests |

- The worker prompts are the originals with names changed. The step-reporting line is still appended at spawn time to briefs that lack it, now matched on the `matrix-kit:` agent prefix or the bare character names.

### 5.2 Progress bar (above the prompt)

- The same behaviour as savvy-progress: it appears once a plan is reported or a worker starts, and shows title, phase label, accepted/total, percent, a crew-count button that opens The Construct, and a dismiss button.
- Restyled:
  - the dithered fill becomes falling green katakana/digit glyphs, brighter at the leading edge;
  - the crab at the end becomes a running Mouse sprite;
  - in-flight tasks show as a faint glyph layer, as before.

### 5.3 The Construct panel (`/construct`, `/construct open`)

From top to bottom:

1. **Flow title** (if a flow is running).
2. **Metrics block:** the panel metrics from section 6, as small tiles. It replaces the original's three tiles (cost / tokens / time), which move inside it as "Crew cost", "Crew tokens" and "Crew time"; the header above it holds only the flow title. In the terminal each tile is one line of the same list.
3. **Crew:** running, then finished (collapsible), then planned (dimmed). Each row shows:
   - the sprite, task description, character name and model · effort;
   - the task's own step progress, or context fill in grey when the worker doesn't report steps;
   - context %, tokens, estimated cost and elapsed time;
   - a status mark.
4. **Compact toggle:** a single row of sprites plus totals, as in the original.

Auto-open setting (`userConfig.autoOpen`): `crew` (default) opens the panel when a matrix-kit worker starts or a plan is reported; `any` also opens it for any other subagent.

### 5.4 Metrics strip (`/operator`)

One row above the prompt, in the session-band style. Section 6 lists what's in it and in what order items drop off. The `×` hides it for the session, and `/operator` toggles it. `/operator demo <minutes>` previews the cache colours and warning, as `/session_data demo` did.

Debug options, for tests and tuning: `/operator json` prints every collected figure, and `/operator width` reports the strip's measured width and which items fit.

## 6. Metrics

Sources come from the plugin-authoring reference for Claude Code 2.1.299. The cost and price fields are estimates computed from token counts.

| # | Metric | Where | Source | Notes |
|---|---|---|---|---|
| 2 | Output speed (tok/s) | strip | `turn.step` stream: `stop` chunk `usage.output_tokens` ÷ time from first chunk | main thread; same noise filters as the original (≥20 tokens, ≥0.5 s, ≤1000 tok/s) |
| 3 | Last prompt cost | strip | `session.usage().cost.usd` delta between `turn.start` and `turn.complete` | `—` when cost is absent |
| 4 | Session cost | strip | `session.usage().cost.usd` | `—` until a cost is reported; money is formatted as in the panel |
| 5 | Cache countdown | strip | 1 h from the last main-thread `turn.complete` | amber at 20 min, red at 10 min; `…` while working |
| 6 | Context fill % | strip | `session.usage().context.percent` | missing right after compaction: keep the last value; `—` before the first figure |
| 12 | Plan usage limits | strip | `session.usage().rateLimits` (`five_hour`, `seven_day`, `spend_limit`: `percentUsed`, `resetsAt`) | hidden when the list is empty (not on a subscription) |
| 13 | Model · effort | strip | `turn.step` input `model`, `effort` (main thread) | effort may be a number: shown as-is |
| 18 | Room left in context | strip | `context.window − context.tokens` | labelled "left"; Claude Code compacts before the window is full, so this is an upper bound |
| 7 | Time to first token | panel | `turn.step`: hook start → first `text` / `thinking` / `tool` chunk, first request of the turn | computed; the engine gives no field |
| 8 | Turn duration | panel | `turn.complete.durationMs` (main thread) | |
| 9 | Token breakdown | panel | `turn.complete.usage`: input / output / cache read / cache write | last turn, plus session totals |
| 10 | Cache hit rate | panel | cache_read ÷ (input + cache_read + cache_write), from turn usage | last turn and session |
| 11 | Cache savings | panel | Σ cache_read × (input price − cache-read price) from `lib/prices.ts` | main thread and subagents; estimate |
| 14 | Tool calls | panel | a `tool.call` hook counting every tool; `isError` on the result | this turn and session; errors in red |
| 15 | Lines changed by workers | panel | `Agent` tool result `toolStats.linesAdded` / `linesRemoved` | workers only, labelled "Worker lines" |
| 16 | Agents running | panel | count of running rows in the crew state | |
| 17 | Session clock | panel | `session.usage().startedAt` | read once at `session.start`, so it counts before the first prompt |
| 1 | Turn number | panel | the operator's own count of main-conversation prompts, incremented at each main `turn.start` | moved off the strip to make room |

**Refresh:** metrics update on the `session.measure` event and on turn events rather than polling. A 1-second `$.clock.every` ticks only the clocks (cache countdown, elapsed times, session clock), and only while something is counting or The Construct is open.

**Strip drop order** as the window narrows, first dropped first: room left (18) → usage limits shown as one combined % instead of two → model · effort (13) → session cost (4) → tok/s (2). Cost of the last prompt, the cache countdown and context % stay last.

## 7. Characters

All characters are chibi humans on a 24 × 30 pixel grid, drawn as inline SVG rects (desktop `Svg` only; PNG `Image` is terminal-only). Mockup v1 is the starting point. Each needs one prop that stays readable at panel size:

| Character | Role | Signature look | Working animation |
|---|---|---|---|
| Neo | `neo` | long split black coat, slick hair, small shades | bullet-time lean back, glyph streaks behind |
| Morpheus | `morpheus` | bald, round pince-nez shades, burgundy coat | red and blue pills swap hands |
| Trinity | `trinity` | black bob, slim shades, glossy black suit | tilted fast-typing pose |
| Tank | `tank` | headset, knit jumper | typing at an operator console |
| Mouse | `mouse` | beanie, oversized jumper | quick bounce (double speed) |
| The Oracle | Explore agents | head wrap, apron | stirring a bowl of cookies |
| Agent Smith | any other agent | suit, white shirt, tie, earpiece, rectangular shades | a translucent clone flickers beside him |

- **States:**
  - running: animated;
  - done: still, with a green check;
  - failed: green "déjà vu" glitch (offset slices for 2 s, then a still red ✗);
  - planned: still, at 45% opacity.
- **Motion:** the docs promise animation only as SMIL inside an `Svg` with `isInteractive: true`; CSS `@keyframes` (which the original crabs use) isn't mentioned. Plan task 1 checks on screen whether CSS keyframes play without `isInteractive`.
  - If they do, use CSS keyframes, with `@media (prefers-reduced-motion: reduce) { animation: none }`.
  - If they don't, use SMIL with `isInteractive: true`. Each sprite then carries a still frame and an animated group, and `@media (prefers-reduced-motion: reduce)` hides the animated group and shows the still one.
  - The choice lives in one place: `lib/sprites.ts` exports `MOTION: 'css' | 'smil'`.
  - **Checked on screen 2026-10-18 (Brannon, desktop app):** the original crabs walk, so CSS keyframes play without `isInteractive`. `MOTION` is `'css'`.
- **Size budget:** one `Svg` source must stay under 131,072 characters; a sprite is about 4 KB, so a row is far under. Long lists are still split one `Svg` per row, as in the original.
- **Terminal:** each character is a coloured letter badge (`N`, `M`, `T`, `K`, `m`, `O`, `S`) in green tones; the status glyphs are kept.

## 8. Theme

- **Palette:**
  - `--matrix-green #00FF41` (accent);
  - `#00B32C` (secondary);
  - `#0D3B1A` (faint layer);
  - `#06120A` (dark surface);
  - warn `#E2A94E`, alert `#FF5F56`;
  - done green `#3BFF6E`.
- **Light mode:** the SVGs use `prefers-color-scheme` inside their own `<style>`, as the originals do. In light mode there's no black fill and the accents darken to `#00802A` so they stay readable on white.
- **Font:** `ui-monospace, 'Cascadia Mono', Consolas, monospace` (Cascadia ships with Windows 11).
- **Copy:** themed but clear, e.g. "Crew", "Planned", "Done", tooltip "Wake up — cache expires in 5 min". Every number keeps a plain label.

## 9. Error handling

- `usage`, `chunk.usage`, `cost`, `context.tokens` and `rateLimits` may each be null or missing. Every metric shows `—` instead of throwing.
- Calls from subagents to `progress` are ignored, and calls from the main session to `step` are ignored, as in the original. Tool inputs stay clamped (max 200 tasks, 120-character titles).
- If Neo's Fable model is unavailable, the Agent call fails. The row shows the glitch state, and the orchestrator follows the playbook's "return to a higher or different tier" rule. The README tells you how to switch him to Opus.
- Notification: Claude Code `PushNotification`, then `$.ui.toast` if it isn't delivered. Nothing fires while a turn is running.
- No `$.process.run`, no `$.fs` reads outside the plugin, no network.

## 10. Testing

- **Kept and renamed** from the original, using the `claude-code/testing` harness: cost maths (`cost.test.ts`), progress tool rules (`register.test.ts`), worker progress reporting (`caller.test.ts`), progress bar rendering (`band.test.tsx`).
- **New:**
  - `metrics.test.ts`: TTFT, cache hit rate, cache savings, tool-call and error counting, and room left, with usage fields missing;
  - `strip.test.tsx`: drop order at each width breakpoint, and usage limits hidden when the list is empty;
  - `sprites.test.ts`: every character renders, each sprite stays under the size budget, and reduced-motion CSS is present.
- **Manual check:** load the plugin in the desktop app (light and dark) and the terminal, run `/red-pill` on a small task, and use `/operator demo 4` to see the warning.

## 11. Install

- **Development:** `claude --plugin-dir C:\Users\brann\matrix-kit` for a single session.
- **Every session, including the desktop app:** add the folder to `CLAUDE_CODE_PLUGIN_DIRS` in the `env` block of `~/.claude/settings.json`. Separate multiple folders with `;` on Windows (to confirm). Optionally add `CLAUDE_CODE_PLUGIN_DIR_WATCH=1` for hot reload. I ask before editing that file.
- Validate with `claude plugin validate .`

## 12. Risks

- **Early-access API:** mods are early access and may change between Claude Code releases (built against 2.1.299 types; installed CLI 2.1.302). The tests are the tripwire.
- **Desktop SVG rendering:** CSS animation in the desktop's default image rendering is unverified on this version. Fallback: `isInteractive`.
- **Price table:** hardcoded list prices (as of 2026-10-10 in the original), so costs drift from real bills.
- **Small sprites:** chibi characters may still read as similar at 24 × 30. Props are allowed a few pixels outside the head box if needed.
