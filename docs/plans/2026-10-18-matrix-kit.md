# matrix-kit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `matrix-kit`, one Claude Code plugin that re-themes the audited claude-kit snapshot as The Matrix, adds a metrics strip and panel, and draws the workers as chibi Matrix characters.

**Architecture:**
- **One hooks module.** `hooks/register.tsx` calls `registerConstruct` (progress bar, The Construct panel, `progress`/`step` tools; descended from savvy-progress) and `registerOperator` (metric collection, metrics strip, cache warnings; descended from session-band).
- **Shared helpers** live in `hooks/lib/` as plain `.ts` modules.
- **The workflow** is a skill plus five agent files.
- **State** is all in `$.state` atoms under plugin `matrix-kit`.

**Tech Stack:**
- Claude Code mod API: function hooks, engine 2.1.299 types, CLI 2.1.302.
- TypeScript/TSX with the `h` JSX factory.
- `claude-code/testing` for tests.
- Inline SVG for desktop drawing.

**Spec:** `docs/specs/2026-10-18-matrix-kit-design.md` (read it before any task).

## Global Constraints

- Plugin name `matrix-kit`; all atoms use `{ plugin: 'matrix-kit', key }`.
- Tool names: `mcp__matrix-kit__progress`, `mcp__matrix-kit__step`.
- Commands:
  - `/red-pill <task>` (skill);
  - `/construct` and `/construct open` (panel);
  - `/operator`, `/operator demo <minutes>`, `/operator json` (strip; `json` is a debug and test aid).
- Agents: `neo` (model fable, effort high), `morpheus` (opus, xhigh), `trinity` (opus, high), `tank` (opus, medium), `mouse` (opus, low). As plugin agents they arrive as `matrix-kit:<name>`.
- Panel id `matrix-construct`, pane title `The Construct`.
- Palette: green `#00FF41`, secondary `#00B32C`, faint `#0D3B1A`, dark surface `#06120A`, warn `#E2A94E`, alert `#FF5F56`, done `#3BFF6E`, light-mode green `#00802A`.
- Mono font stack `ui-monospace, 'Cascadia Mono', Consolas, monospace`.
- English only. No right-to-left code, no `$.settings.read`, no `$.process.run`, no `$.fs` outside the plugin, no network.
- Every imported plugin file ends in `.ts` or `.tsx`; import specifiers carry the extension. No `import()`.
- A single `Svg` source stays under 131,072 characters.
- Every animation stops under `prefers-reduced-motion: reduce`.
- Cache TTL 1 h; strip amber at 20 min left, red at 10 min; warnings at 10 and 5 min, never while a turn runs.
- **Commits:** Brannon's rule is no commit without asking. Every "Commit" step means **show the diff summary, ask, then commit** with a message in the form `type: description` (chore/feat/fix/style/refactor/perf), ending with the `Co-Authored-By` line.
- **Checks:** run from `C:\Users\brann\matrix-kit`:
  - `claude plugin validate --strict .` passes with no errors or warnings;
  - `claude plugin test .` exits 0. It runs every test file; there's no single-test filter.
- **Test harness calls:** the tests use `$.tool.call`, `$.agent.spawn`, `$.turn.step`, `$.turn.complete`, `$.ui.mount` and `mock.clock` as the original tests do. Commands are driven with `$.command.run({ command, args })`. If the `Engine` type in `.claude-plugin/types/` names that call differently, use its name everywhere and note it in Task 1.

## Review Focus

1. **Interrupted or failed turn:** `usage` is `null`. Every metric shows `—` and nothing throws (test in Task 9).
2. **Compaction:** `context.tokens` and `percent` go missing right after a compaction. The last known value is kept (test in Task 7).
3. **No subscription:** `rateLimits` is `[]`. No limits item appears in the strip at any width (test in Task 8).
4. **Very narrow window:** at `bodyColumns` 30, the strip still draws the last-prompt cost, the cache countdown and context %, and nothing else (test in Task 8).
5. **Neo unavailable:** a worker whose turn ends with `reason: 'error'` shows `failed` (glitch), not `running` forever (test in Task 6).

---

### Task 1: Scaffold from the audited snapshot, and settle the open facts

**Files:**
- Create:
  - `.claude-plugin/plugin.json`, `hooks/hooks.json`, `hooks/register.tsx`, `types/index.d.ts`, `.gitignore`, `LICENSE`;
  - `hooks/construct.tsx` (from `plugins/savvy-progress/hooks/register.tsx`);
  - `hooks/operator.tsx` (from `plugins/session-band/hooks/register.tsx`);
  - `hooks/construct.cost.test.ts`, `hooks/construct.band.test.tsx`, `hooks/construct.register.test.ts`, `hooks/construct.caller.test.ts` (from the four savvy-progress tests);
  - `skills/red-pill/SKILL.md` (copied unchanged for now, from `plugins/savvy-flow/skills/savvy-flow/SKILL.md`);
  - `agents/` (the five savvy agent files, copied unchanged for now).
- Not copied: `plugins/session-band/notifier/`, `.claude-plugin/marketplace.json`, the per-plugin READMEs.

**Interfaces:**
- Produces:
  - `export const registerConstruct: Register` in `hooks/construct.tsx`;
  - `export const registerOperator: Register` in `hooks/operator.tsx`;
  - `export const register: Register = (on, options) => { registerConstruct(on, options); registerOperator(on, options) }` in `hooks/register.tsx`.
  - `types/index.d.ts` declares a single `PluginState['matrix-kit']` holding every key of both originals: `flow`, `agents`, `panel`, `now`, `stats`, `cache`, `isHidden`, `isBusy`, `warned`.

- [ ] **Step 1: Fetch the audited snapshot.** Clone `https://github.com/JohnnyVizz/claude-kit` into a new empty temp folder, run `git checkout c871c153ead54ad9547cc717d0f3e5a676c73986`, and confirm `git rev-parse HEAD` prints exactly that hash. Never run anything from inside that folder.
- [ ] **Step 2: Create the repo.** `git init` in `C:\Users\brann\matrix-kit` (approved in Q3), then copy the files listed above. `.gitignore`: `node_modules/`, `.claude-plugin/types/`, `tsconfig.json`.
- [ ] **Step 3: Write `plugin.json`.**
  - `name: "matrix-kit"`, `version: "0.1.0"`, author Brannon Oh, `license: "MIT"`, `types: "./types/index.d.ts"`.
  - `userConfig.autoOpen`: string, options `["crew","any"]`, default `"crew"`. Until Task 3 renames it, construct still reads `options.autoOpen === 'any'`, which keeps working.
  - `hooks/hooks.json` = `{ "modules": ["./register.tsx"] }`.
- [ ] **Step 4: Rewire the copied modules.**
  - Rename each copied `export const register` to its new name.
  - Change every atom's `plugin` to `'matrix-kit'`.
  - Change the tool constants to `mcp__matrix-kit__progress` / `mcp__matrix-kit__step`.
  - In `operator.tsx`, delete the `cacheModExpiresAt` atom and its read (it reads another plugin's state), and delete the macOS notifier branch and `desktopSession` from `notifyCacheExpiry`, keeping the `PushNotification` → toast fallback.
  - In the four tests, set `PLUGIN = 'matrix-kit'` and the new tool names.
- [ ] **Step 5: Run `claude plugin validate --strict .`** Expected: no errors. If it rejects the import specifier `'./construct.tsx'`, try `'./construct'`, keep whichever loads, and write the answer into spec section 4 in place of the "To verify first" line.
- [ ] **Step 6: Run `claude plugin test .`** Expected: exit 0. The original assertions pass unchanged apart from the renames.
- [ ] **Step 7: Check animation on screen.**
  - Ask Brannon for permission to add `C:\Users\brann\matrix-kit` to `CLAUDE_CODE_PLUGIN_DIRS` in the `env` block of `~/.claude/settings.json`. Use `;` between paths if the variable already has a value, and append rather than replace.
  - In a new desktop session, start any subagent and open `/agents-info` (still the old name at this point).
  - Write the result into spec section 7 as `MOTION: 'css'` (crabs walk) or `MOTION: 'smil'` (crabs stand still), and confirm the separator in spec section 11.
- [ ] **Step 8: Commit** (ask first): `chore: scaffold matrix-kit from audited claude-kit c871c15`

---

### Task 2: English only, and shared formatting and price helpers

**Files:**
- Create: `hooks/lib/format.ts`, `hooks/lib/prices.ts`, `hooks/lib/format.test.ts`
- Modify: `hooks/construct.tsx` (drop `STRINGS.ru/he`, `detectLang`, `isRtl`, `mx`/`startText`/`endText` mirroring, the `rtl` branches in `rowSvg`, the `settings.read` call); `hooks/construct.band.test.tsx` (drop the `settings.read` and `LANG` mocks)

**Interfaces:**
- Produces (`lib/format.ts`): `fmtTokens(n: number): string`, `fmtCost(usd: number): string`, `fmtTime(ms: number): string` (all moved verbatim); `fmtDuration(ms: number): string`; `xml(s: string): string`, `clip(s: string, max: number): string`, `textWidth(s: string, size: number): number`, `fitText(s: string, size: number, maxW: number): string` (moved).
- Produces (`lib/prices.ts`): `type Usage` (the four token fields), `type Price`, `priceOf(model: string, prompt: number): Price`, `costOf(model: string, u: Usage, isRequest: boolean): number`, `windowOf(model: string): number` (all moved verbatim, including `PRICES` and the Haiku 5.5 long-prompt rule); `cacheSavingsOf(model: string, u: Usage): number` = `cache_read_input_tokens × (input price − cache-read price) / 1e6`.

- [ ] **Step 1: Write failing tests** in `hooks/lib/format.test.ts`:
  - `fmtDuration(850) === '850 ms'`, `fmtDuration(1440) === '1.4 s'`, `fmtDuration(65_000) === '1:05'`;
  - `fmtCost(0.256) === '$0.26'`, `fmtCost(12.34) === '$12.3'`, `fmtTokens(1500) === '2k'`, `fmtTime(3_725_000) === '1:02:05'`;
  - `cacheSavingsOf('claude-opus-5-5', { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 2e6, cache_creation_input_tokens: 0 })` is `7.6` within `1e-9`;
  - `cacheSavingsOf('unknown-model', …same…)` uses the fallback price row and returns `7.6`.
- [ ] **Step 2: Run `claude plugin test .`** Expected: FAIL (module `lib/format.ts` missing).
- [ ] **Step 3: Implement.** Create the two lib files by moving code out of `construct.tsx`; add `fmtDuration` and `cacheSavingsOf`; import them back into `construct.tsx`; delete the language code. `tr()` becomes a single `const S = { … }` English table.
- [ ] **Step 4: Run `claude plugin test .` and `claude plugin validate --strict .`** Expected: PASS, and the cost tests still show the same `≈$…` values.
- [ ] **Step 5: Commit** (ask first): `refactor: drop non-English panel and extract format and price helpers`

---

### Task 3: The crew roster, the `/red-pill` workflow and the five agents

**Files:**
- Create: `hooks/lib/crew.ts`, `hooks/lib/crew.test.ts`, `agents/neo.md`, `agents/morpheus.md`, `agents/trinity.md`, `agents/tank.md`, `agents/mouse.md`
- Delete: the five `agents/savvy-*.md`
- Modify: `skills/red-pill/SKILL.md`; `hooks/construct.tsx` (tiers, autoOpen, step brief); `hooks/construct.register.test.ts`, `hooks/construct.caller.test.ts` (tier names)

**Interfaces:**
- Produces (`lib/crew.ts`):
  - `type Tier = 'neo' | 'morpheus' | 'trinity' | 'tank' | 'mouse'`;
  - `type Character = Tier | 'oracle' | 'smith'`;
  - `const TIERS: readonly Tier[]` (in that order);
  - `isCrew(subagentType: string): boolean`: true for `matrix-kit:<tier>` and bare `<tier>`;
  - `characterOf(subagentType: string): Character`: a tier → itself, `Explore` → `oracle`, anything else → `smith`;
  - `const CHARACTER_NAME: Record<Character, string>` = Neo, Morpheus, Trinity, Tank, Mouse, The Oracle, Agent Smith;
  - `const TIER_MODEL: Record<Tier, [model: string, effort: string]>` (from spec 5.1).
- Consumes: nothing.

- [ ] **Step 1: Write failing tests** in `crew.test.ts`:
  - `characterOf('matrix-kit:neo') === 'neo'`, `characterOf('mouse') === 'mouse'`, `characterOf('Explore') === 'oracle'`, `characterOf('general-purpose') === 'smith'`, `characterOf('matrix-kit:unknown') === 'smith'`;
  - `isCrew('matrix-kit:trinity') === true`, `isCrew('savvy-careful') === false`;
  - `CHARACTER_NAME.smith === 'Agent Smith'`.
- [ ] **Step 2: Run `claude plugin test .`** Expected: FAIL (module missing).
- [ ] **Step 3: Implement `lib/crew.ts`, then rewire `construct.tsx`:**
  - the `progress` tool's `tier` enum becomes `TIERS`;
  - `tierOf`/`costumeOf` are replaced by `characterOf`;
  - `startsWith('savvy-')` becomes `isCrew`;
  - `STEP_BRIEF` is appended for `isCrew` agents;
  - autoOpen `'savvy'` becomes `'crew'`.
- [ ] **Step 4: Update the two hook tests.** Tiers in plans become `trinity` / `mouse`; worker `subagentType` becomes `matrix-kit:trinity`.
- [ ] **Step 5: Write the agents.**
  - Each `agents/<tier>.md` is the matching savvy agent (fable→neo, heavy→morpheus, careful→trinity, medium→tank, light→mouse).
  - Frontmatter `name: <tier>`, `model`/`effort` from spec 5.1, `description` starting "matrix-kit <Character> worker".
  - Body text renamed (savvy-flow → red-pill, `mcp__savvy-progress__step` → `mcp__matrix-kit__step`).
  - `neo.md` gets one comment line under the frontmatter: `<!-- No Fable access? Change model: fable to model: opus. -->`
- [ ] **Step 6: Rewrite `SKILL.md`.**
  - `name: red-pill`; keep `disable-model-invocation: true`.
  - The tier table uses the five characters.
  - The tool is `mcp__matrix-kit__progress`.
  - Agent names are `matrix-kit:<tier>`.
  - In section 1a, step 1 becomes: "If the directory is not a git repository, ask the user before running `git init`." Every "commit" instruction becomes "ask the user, then commit". "Never push without being asked" stays.
- [ ] **Step 7: Run `claude plugin test .` and `claude plugin validate --strict .`** Expected: PASS; validate lists the skill and the five agents.
- [ ] **Step 8: Commit** (ask first): `feat: add red-pill workflow and Matrix crew roster`

---

### Task 4: Matrix theme and the code-rain progress bar

**Files:**
- Create: `hooks/lib/theme.ts`, `hooks/lib/theme.test.ts`
- Modify: `hooks/construct.tsx` (`rowSvg`, `barText`, the terminal band, `ACCENT`/`DONE`); `hooks/construct.band.test.tsx`

**Interfaces:**
- Produces (`lib/theme.ts`):
  - `const PALETTE`: keys `green`, `green2`, `faint`, `surface`, `warn`, `alert`, `done`, `lightGreen`, with the Global Constraints values;
  - `const MONO_FONT: string`;
  - `const GLYPHS = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿ0123456789'`;
  - `themeCss(): string`: a `<style>` defining classes `.t` (primary text), `.m` (muted), `.k` (track), `.acc` (accent fill). Dark: `.acc` uses `#00FF41` and `.k` uses `#06120A`. Light, under `prefers-color-scheme: light`: `.acc` uses `#00802A` and `.k` is a light grey. No black fills in light mode.
  - `glyphAt(col: number, row: number): string`: deterministic, using the existing `noise` function, which moves here.

- [ ] **Step 1: Write failing tests.**
  - `theme.test.ts`: `themeCss()` contains `#00FF41`, `#00802A` and `prefers-color-scheme`; `glyphAt(3, 1) === glyphAt(3, 1)`; every `glyphAt` result is a character of `GLYPHS`.
  - Add to `construct.band.test.tsx`: on desktop, the band `Svg`'s `source` contains `<text` glyph cells of class `acc` and the text `25%` for done 1 / total 4. After `finished: true`, the source contains `#3BFF6E`. The terminal band keeps title and label as Text.
- [ ] **Step 2: Run `claude plugin test .`** Expected: FAIL.
- [ ] **Step 3: Implement.**
  - `rowSvg` replaces the dithered `<rect>` dots with a column of `glyphAt` characters per filled cell (font-size 7, `MONO_FONT`), with opacity rising from 0.35 at the start to 1 at the leading edge; in-flight tasks use the faint layer.
  - The end-of-row crab is removed here; Task 6 puts a Mouse sprite in its slot.
  - The terminal band colours `█░` with `PALETTE.green` and the label with `PALETTE.done` once finished.
- [ ] **Step 4: Run tests and validate.** Expected: PASS.
- [ ] **Step 5: Commit** (ask first): `style: add Matrix theme and code-rain progress bar`

---

### Task 5: The seven chibi sprites

**Files:**
- Create: `hooks/lib/sprites.ts`, `hooks/lib/sprites.test.ts`

**Interfaces:**
- Consumes: `Character` from `lib/crew.ts`; `PALETTE` from `lib/theme.ts`.
- Produces (`lib/sprites.ts`):
  - `const MOTION: 'css' | 'smil'` (the value Task 1 recorded);
  - `const SPRITE_W = 24`, `const SPRITE_H = 30`;
  - `type SpriteState = 'running' | 'done' | 'failed' | 'planned'`;
  - `spriteSvg(c: Character, state: SpriteState, at: { x: number; y: number; scale?: number }): string`: returns one `<g class="ch-<c> st-<state>">` of `<rect>`s;
  - `const SPRITE_CSS: string`: the shared `<style>` with all character animations, the `glitch` keyframes, and `@media (prefers-reduced-motion: reduce)`;
  - `badgeOf(c: Character): { letter: string; color: string }`: letters `N M T K m O S`.

- [ ] **Step 1: Write failing tests** in `sprites.test.ts`:
  - For each of the 7 characters × 4 states, `spriteSvg` returns a string containing `ch-${c}` and `st-${state}`, under 8,000 characters.
  - A full `<svg>` holding `SPRITE_CSS` plus all 7 running sprites is under 131,072 characters.
  - `SPRITE_CSS` contains `prefers-reduced-motion`.
  - `spriteSvg('neo', 'failed', …)` contains `glitch`; `'planned'` contains `opacity="0.45"`.
  - The seven `badgeOf(...).letter` values are unique.
- [ ] **Step 2: Run `claude plugin test .`** Expected: FAIL.
- [ ] **Step 3: Draw the sprites.**
  - Start from the mockup v1 shapes in the appendix (Neo, Morpheus, Trinity, Smith). Add Tank, Mouse and The Oracle per spec section 7.
  - Each character's prop gets its own `<g class="pr">` so it can animate separately, using the working animations in spec section 7.
  - `failed` = a 2 s `glitch` (three horizontal slices offset ±2 px, tinted `PALETTE.green`), then a still frame.
  - `done` = still.
  - `planned` = still at `opacity="0.45"`.
  - If `MOTION === 'smil'`, emit an animated `<g>` with `<animate>`/`<animateTransform>` plus a still `<g class="still">`, and `SPRITE_CSS` swaps them under reduced motion (spec section 7).
- [ ] **Step 4: Run tests.** Expected: PASS.
- [ ] **Step 5: Show Brannon the seven sprites** (render one preview SVG with all states) and adjust on feedback before committing.
- [ ] **Step 6: Commit** (ask first): `feat: add chibi Matrix character sprites`

---

### Task 6: The Construct panel with the crew

**Files:**
- Modify: `hooks/construct.tsx` (pane id, command, rows, compact view, end-of-band sprite); `hooks/construct.register.test.ts`, `hooks/construct.caller.test.ts`, `hooks/construct.cost.test.ts` (pane id)
- Create: `hooks/construct.crew.test.tsx`

**Interfaces:**
- Consumes: `spriteSvg`, `SPRITE_CSS`, `badgeOf`, `SPRITE_W`/`SPRITE_H` (Task 5); `characterOf`, `CHARACTER_NAME`, `TIER_MODEL` (Task 3); `PALETTE`, `MONO_FONT`, `themeCss` (Task 4).
- Produces:
  - `PANE = 'matrix-construct'`;
  - command `construct`, replying `The Construct opened.` / `The Construct closed.`;
  - `metricsBlock(ui, surface: 'desktop' | 'terminal', W: number): JSX.Element | null` in `construct.tsx`. It returns `null` for now; the pane draws it above the crew, and Task 9 fills it in.

- [ ] **Step 1: Write failing tests** in `construct.crew.test.tsx`, using the `worker()` pattern from `construct.cost.test.ts`:
  - **Desktop:** a running `matrix-kit:neo` worker gives a row `Svg` whose source contains `ch-neo` and `st-running`.
  - **Terminal:** the same worker shows Text `N`, Text containing `Neo`, and Text containing the task description.
  - **Explore:** a worker with `subagentType: 'Explore'` shows `The Oracle`.
  - **Review Focus 5:** after `turn.complete` with `reason: 'error'`, the desktop row source contains `st-failed` and the terminal shows `✗`.
  - **Command:** `$.command.run({ command: 'construct' })` replies `The Construct opened.`, then `The Construct closed.`
- [ ] **Step 2: Run `claude plugin test .`** Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Replace `crab`/`COSTUMES`/`CRAB_CSS`/`rowCrab` with `spriteSvg`/`SPRITE_CSS`.
  - Row height grows to fit a 30-unit sprite at scale 1.1.
  - Character name and model · effort replace tier words.
  - The terminal uses `badgeOf` coloured letters.
  - The pane title becomes `The Construct`, and the grid dots become `PALETTE.faint`.
  - The band's end slot draws `spriteSvg('mouse', isWorking ? 'running' : 'done', …)`.
  - If `MOTION === 'smil'`, pass `isInteractive` on every sprite-bearing `Svg`.
- [ ] **Step 4: Run tests and validate.** Expected: PASS.
- [ ] **Step 5: Commit** (ask first): `feat: draw The Construct crew with Matrix characters`

---

### Task 7: Metric collection

**Files:**
- Create: `hooks/lib/metrics.ts`, `hooks/lib/metrics.test.ts`, `hooks/operator.metrics.test.ts`
- Modify: `hooks/operator.tsx` (replace the `stats` atom and `refresh` polling); `types/index.d.ts` (swap `stats` for `metrics`)

**Interfaces:**
- Consumes: `Usage`, `cacheSavingsOf` (Task 2).
- Produces (`lib/metrics.ts`):
  - `type TokenSplit = { input: number; output: number; cacheRead: number; cacheWrite: number }`;
  - `type RateLimit = { kind: string; percentUsed: number; resetsAt: number }`;
  - `type Metrics` with these fields:
    - `{ turn: number; model: string | null; effort: string | null }`;
    - `{ speed: number | null; ttftMs: number | null; turnMs: number | null }`;
    - `{ costUsd: number; turnCostUsd: number | null; costAtStart: number }`;
    - `{ lastTurn: TokenSplit | null; session: TokenSplit; cacheSavingsUsd: number }`;
    - `{ tools: { turn: number; session: number; turnErrors: number; sessionErrors: number } }`;
    - `{ linesAdded: number; linesRemoved: number; rateLimits: RateLimit[] }`;
    - `{ context: { tokens: number | null; window: number | null; percent: number | null } }`;
    - `{ startedAt: number | null }`.
  - `emptyMetrics(): Metrics`.
  - `splitOf(u: Usage | null | undefined): TokenSplit | null`.
  - `addSplit(a: TokenSplit, b: TokenSplit | null): TokenSplit`.
  - `hitRate(s: TokenSplit | null): number | null`: `cacheRead / (input + cacheRead + cacheWrite)`; null when that denominator is 0.
  - `roomLeft(c: Metrics['context']): number | null`: `window − tokens`, null if either is null.
  - `mergeContext(prev: Metrics['context'], next: Partial<Metrics['context']>): Metrics['context']`: keeps previous values for missing fields.
  - The atom `metrics = atom({ plugin: 'matrix-kit', key: 'metrics' }, emptyMetrics())`, exported from `operator.tsx` so the panel can read it.
- Produces (`operator.tsx`): `/operator json` replies with `JSON.stringify(metrics)`.

- [ ] **Step 1: Write failing pure tests** in `metrics.test.ts`:
  - `hitRate({ input: 100, output: 5, cacheRead: 300, cacheWrite: 100 }) === 0.6`;
  - `hitRate({ input: 0, output: 9, cacheRead: 0, cacheWrite: 0 }) === null`;
  - `splitOf(null) === null`;
  - `roomLeft({ tokens: 250_000, window: 1_000_000, percent: 25 }) === 750_000`;
  - `roomLeft({ tokens: null, window: 1_000_000, percent: null }) === null`;
  - **Review Focus 2:** `mergeContext({ tokens: 250_000, window: 1_000_000, percent: 25 }, { window: 1_000_000 })` keeps `tokens: 250_000, percent: 25`.
- [ ] **Step 2: Write failing hook tests** in `operator.metrics.test.ts`. Mock downstream hooks the way the original tests do, then read `/operator json`:
  - Two `tool.call`s, one downstream reply `{ isError: true }`, give `tools.turn === 2, turnErrors === 1`.
  - An `Agent` tool result with `toolStats: { linesAdded: 12, linesRemoved: 4 }` gives `linesAdded 12, linesRemoved 4`.
  - Main-thread `turn.complete` with `durationMs: 4200` and usage gives `turnMs 4200` and `lastTurn` equal to the split.
  - `session.measure` with `rateLimits: [{ kind: 'five_hour', percentUsed: 42, resetsAt: … }]` stores it.
  - A main `turn.step` with `model: 'claude-opus-5-5', effort: 'high'` stores both.
- [ ] **Step 3: Run `claude plugin test .`** Expected: FAIL.
- [ ] **Step 4: Implement the hooks in `operator.tsx`.**
  - `turn.start` (main): `turn + 1`, reset `tools.turn` / `tools.turnErrors`, set `costAtStart`.
  - `turn.step` (main): store `model`/`effort`. Time from hook start to the first chunk whose `kind` is `text`, `thinking` or `tool`, only when `e.index === 0`, giving `ttftMs`. Keep the original speed measurement and its filters.
  - `turn.step` (any agent): add `cacheSavingsOf(model, result.usage)` when usage is present.
  - `turn.complete` (main): `turnMs`, `lastTurn`, `session = addSplit(...)`, and cost from `$.session.usage()`.
  - `tool.call` (no filter): count, and add an error when the result's `isError` is true. For `Agent`, add `result.toolStats` lines.
  - `session.measure`: `mergeContext`, `rateLimits`, `costUsd`, `startedAt`.
  - Remove the per-`turn.step` `refresh` polling.
  - Point the existing strip render at the same fields in `metrics` (`turn`, `speed`, `turnCostUsd`, `costUsd`, `context.percent`), so the strip keeps working until Task 8 redraws it.
- [ ] **Step 5: Run tests and validate.** Expected: PASS; validate shows no new warnings.
- [ ] **Step 6: Commit** (ask first): `feat: collect session metrics for the operator strip`

---

### Task 8: The metrics strip

**Files:**
- Create: `hooks/lib/strip.ts`, `hooks/lib/strip.test.ts`, `hooks/operator.strip.test.tsx`
- Modify: `hooks/operator.tsx` (render, command name, demo, warning copy)

**Interfaces:**
- Consumes: `Metrics`, `roomLeft` (Task 7); `PALETTE`, `MONO_FONT` (Task 4); `fmtCost`, `fmtTokens` (Task 2).
- Produces (`lib/strip.ts`):
  - `type StripItem = 'speed' | 'turnCost' | 'sessionCost' | 'cache' | 'context' | 'limits' | 'limitsCombined' | 'model' | 'room'`;
  - `stripItems(columns: number, hasLimits: boolean): StripItem[]`, in display order `speed, turnCost, sessionCost, cache, context, limits|limitsCombined, model, room`. Breakpoints:

| `columns` | Shown |
|---|---|
| ≥ 110 | all items |
| 95–109 | drop `room` |
| 85–94 | `limits` → `limitsCombined` |
| 72–84 | also drop `model` |
| 60–71 | also drop `sessionCost` |
| < 60 | also drop `speed` |

  `turnCost`, `cache` and `context` are always present. With `hasLimits` false, neither limits item appears.

- [ ] **Step 1: Write failing pure tests** in `strip.test.ts`:
  - `stripItems(120, true)` has all 8 display items, with `limits`.
  - At 100, there's no `room`.
  - At 90, `limitsCombined` replaces `limits`.
  - At 80, there's no `model`.
  - At 65, there's no `sessionCost`.
  - **Review Focus 4:** `stripItems(50, true)` and `stripItems(30, true)` both equal `['turnCost','cache','context','limitsCombined']`.
  - **Review Focus 3:** `stripItems(120, false)` contains neither `limits` nor `limitsCombined`.
- [ ] **Step 2: Write failing render tests** in `operator.strip.test.tsx`, on the terminal surface:
  - After one main turn, the strip shows Text matching `/tok\/s/` and `/%$/`.
  - `/operator` hides it; `/operator` again shows it.
  - `/operator demo 4` gives a strip `Box` with `borderColor === PALETTE.alert`.
  - With empty `rateLimits`, no Text matches `/5h/`.
- [ ] **Step 3: Run `claude plugin test .`** Expected: FAIL.
- [ ] **Step 4: Implement.**
  - Render with `stripItems(e.props.bodyColumns, metrics.rateLimits.length > 0)` using these formats:
    - speed `312 tok/s`;
    - cost `$0.42 | $3.10`;
    - cache `mm:ss`;
    - context `38%`;
    - limits `5h 42% · 7d 18%`, combined as the higher one, `limit 42%`;
    - model `Opus 5.5 · high`;
    - room `620k left`.
  - Green mono styling: icons recoloured with `PALETTE`; the amber/red borders become `PALETTE.warn` / `PALETTE.alert`.
  - Rename the command to `operator`; keep `demo` and `width`; add `json` (Task 7).
  - Warning text: `Wake up — prompt cache expires in ${minutes} min`.
- [ ] **Step 5: Run tests and validate.** Expected: PASS.
- [ ] **Step 6: Commit** (ask first): `feat: add Matrix operator metrics strip`

---

### Task 9: The metrics block in The Construct

**Files:**
- Modify: `hooks/construct.tsx` (header → metrics block); `hooks/construct.crew.test.tsx`

**Interfaces:**
- Consumes: the `metrics` atom and `hitRate` (Task 7); `fmtDuration`, `fmtTokens`, `fmtCost`, `fmtTime` (Task 2); `metricsBlock` (Task 6).
- Produces: the tile labels and their terminal formats, exactly:

| Label | Terminal format |
|---|---|
| `First token` | `First token 1.4 s` |
| `Turn` | `Turn 12.3 s` |
| `Tokens` | `Tokens in 12k · out 3k · read 140k · write 8k` |
| `Cache hit` | `Cache hit 60%` |
| `Saved` | `Saved ≈$1.20` |
| `Tools` | `Tools 3 (1 err)` |
| `Lines` | `Lines +12 −4` |
| `Running` | `Running 2` |
| `Session` | `Session 1:02:05` |
| `Prompts` | `Prompts 7` (from `$.session.turns()`) |

  The original Cost / Tokens / Time crew totals stay as a fourth row. Any null value shows `—`.

- [ ] **Step 1: Write failing tests** (terminal pane):
  - After a main turn with usage `{ input 100, output 5, read 300, write 100 }`, the pane shows `Cache hit 60%`.
  - After one erroring tool call, it shows `Tools 1 (1 err)`.
  - **Review Focus 1:** after a main `turn.complete` with `usage: null` and `reason: 'aborted'`, the pane shows `First token —`, `Cache hit —` and `Turn —`, and mounting doesn't throw.
  - Desktop: the header `Svg` source contains `Cache hit`.
- [ ] **Step 2: Run `claude plugin test .`** Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Desktop: `headerSvg` becomes a grid of small tiles (3 per row at W ≥ 420, otherwise 2; label in `.m`, value in `.t` `MONO_FONT`; the `Tools` error count in `PALETTE.alert`).
  - Terminal: one dim line per tile.
- [ ] **Step 4: Run tests and validate.** Expected: PASS.
- [ ] **Step 5: Commit** (ask first): `feat: show session metrics in The Construct`

---

### Task 10: Docs, licence, install, and the manual check

**Files:**
- Create: `README.md`
- Modify: `LICENSE`, `.claude-plugin/plugin.json` (description, homepage omitted)

- [ ] **Step 1: Write `LICENSE`.** The original MIT text, keeping its copyright line, with `Copyright (c) 2026 Brannon Oh` added above it.
- [ ] **Step 2: Write `README.md`.**
  - What it is, and credit to claude-kit commit `c871c15`.
  - The three commands, the crew table (spec 5.1 and 7), and how to switch Neo to Opus.
  - Install (spec 11), and the early-access warning.
- [ ] **Step 3: Run `claude plugin validate --strict .` and `claude plugin test .`** Expected: both clean.
- [ ] **Step 4: Manual check with Brannon** in a fresh desktop session (dark, then light mode) and in `claude --plugin-dir C:\Users\brann\matrix-kit` in a terminal:
  - [ ] `/red-pill` on a tiny task: the plan appears, the bar fills with glyphs, The Construct opens, each character animates, and the orchestrator asks before committing.
  - [ ] Turn on Windows "reduce animations": all motion stops.
  - [ ] `/operator demo 4`: red frame; the warning arrives as a notification or a toast.
  - [ ] Narrow the window: strip items drop in the Task 8 order.
  - [ ] Light mode: no black boxes, and the greens are readable.
- [ ] **Step 5: Commit** (ask first): `chore: add README and licence for matrix-kit`

---

## Appendix: mockup v1 sprite shapes (starting point for Task 5)

Rects are `f(x, y, w, h, colour)` on the 24 × 30 grid. Shared body (`skin`, `coat` vary):

```
head f(6,3,12,11,skin)  ears f(5,8,1,2,skin) f(18,8,1,2,skin)  neck f(10,14,4,1,skin)
legs f(8,24,3,4,#111) f(13,24,3,4,#111)  shoes f(7,28,4,1,#000) f(13,28,4,1,#000)
torso f(6,15,12,9,coat)  arms f(4,15,2,7,coat) f(18,15,2,7,coat)  hands f(4,22,2,1,skin) f(18,22,2,1,skin)
mouth f(11,12,2,1,#8a4a3a)
```

- **Neo** (skin `#E8B894`, coat `#121212`):
  - coat tails `f(6,24,4,3)` `f(14,24,4,3)`;
  - lapel `f(11,15,2,6,#2a2a2a)`;
  - hair `f(6,2,12,3)` `f(5,3,2,5)` `f(17,3,2,5)` `f(7,5,4,1)`, all `#0b0b0b`;
  - shades `f(7,8,4,2)` `f(13,8,4,2)` `f(11,8,2,1)` `#000`, glints `f(8,8,1,1)` `f(14,8,1,1)` `#3BFF6E`.
- **Morpheus** (skin `#7A4A2E`, coat `#3a2420`):
  - vest `f(10,15,4,8,#5a3a30)`;
  - head shine `f(8,4,2,1,#9a6a4a)`;
  - round shades `f(7,8,3,2)` `f(14,8,3,2)` `f(10,8,4,1)` `#000`, glints `#3BFF6E`;
  - pills `f(3,21,2,2,#E24B4A)` `f(19,21,2,2,#378ADD)`.
- **Trinity** (skin `#F0CDB0`, coat `#161616`):
  - sheen `f(8,16,1,6,#4a4a4a)`;
  - bob `f(5,2,14,4)` `f(4,4,3,9)` `f(17,4,3,9)` `#0b0b0b`;
  - shades `f(7,8,10,1)` `f(7,8,3,2)` `f(14,8,3,2)` `#000`.
- **Agent Smith** (skin `#E8B894`, coat `#1c1c1c`):
  - shirt `f(10,15,4,4,#f2f2f2)`, tie `f(11,15,2,7,#0b0b0b)`;
  - hair `f(6,2,12,3)` `f(6,3,2,3)` `#4a3523`;
  - shades `f(7,7,4,3)` `f(13,7,4,3)` `f(11,8,2,1)` `#000`;
  - earpiece `f(18,9,1,5,#cfcfcf)`.
