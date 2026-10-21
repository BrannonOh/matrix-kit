# matrix-kit

A Claude Code plugin in the style of The Matrix. It's a re-themed and extended copy of [claude-kit](https://github.com/JohnnyVizz/claude-kit), built from the commit `c871c15` that was audited on 2026-10-18. It never pulls upstream changes.

It adds:

- **A progress bar** above the prompt that follows the session's task list and fills with falling green code as steps are done. Mouse runs at the end of the bar while any subagent is busy.
- **The Construct** (`/construct`, `/construct open`), a panel with session metrics at the top and every subagent below. It opens by itself when a subagent starts, once per prompt. Each subagent is animated while working and glitches if it fails.
- **The operator strip** (`/operator`), a row of metrics above the prompt:
  - tok/s;
  - cost of the last prompt and of the session;
  - prompt-cache countdown;
  - context fill;
  - plan usage limits;
  - model and effort;
  - room left in the context window.

  Items drop off as the window narrows. `/operator demo <minutes>` previews the cache warning, and `/operator json` prints every collected figure.

## The progress bar

The bar mirrors the task list the main session keeps: the desktop app's task list, or TodoWrite and TaskCreate / TaskUpdate in the terminal. It shows the step in progress and `Tasks 2/5`, then `Done`. A finished list stays until your next prompt, and `✕` hides it at once. A subagent's own list doesn't move it.

## The characters

Each subagent is played by a character chosen by its model, at any effort:

| Model | Character |
| --- | --- |
| Fable | Neo |
| Opus | Morpheus |
| Sonnet | Trinity |
| Haiku | The Oracle |
| not known yet, or any other | Agent Smith |

Every subagent except Explore is asked to report its steps, so its row shows a step bar. Explore rows show context fill in grey.

## Install

To install it from GitHub (Claude Code 2.1.275 or later; the repo is private, so the machine needs git access to it):

```text
/plugin install matrix-kit --marketplace BrannonOh/matrix-kit
```

To load the plugin from a local folder for one session:

```bash
claude --plugin-dir C:\Users\brann\matrix-kit
```

To load it in every session, desktop app included, add the folder to the `env` block of `~/.claude/settings.json`. If other folders are already listed, separate them with `;` on Windows:

```json
{ "env": { "CLAUDE_CODE_PLUGIN_DIRS": "C:\\Users\\brann\\matrix-kit", "CLAUDE_CODE_PLUGIN_DIR_WATCH": "1" } }
```

`CLAUDE_CODE_PLUGIN_DIR_WATCH` reloads the plugin when its files change.

## Metrics

The Construct shows these tiles above the subagents. They update on turn events, and the clocks tick each second while The Construct is open. Costs and savings are estimates from `hooks/lib/prices.ts`.

| Tile | What it shows |
| --- | --- |
| Crew cost | The estimated cost of all subagents run this session. |
| Crew tokens | The tokens used by all subagents this session. |
| Crew time | The time from the first subagent's start to the last one's end, or to now while one runs. |
| First token | How long the main thread waited for the first reply in the last turn. |
| Turn | How long the last main-thread turn took. |
| Tokens | The last main-thread turn's input, output, cache-read and cache-write tokens. |
| Cache hit | The share of the last turn's prompt that was read from the cache. |
| Saved | How much the cache saved this session, main thread and subagents together. |
| Tools | The tool calls made this session. Errors are counted next to the total, and the tile turns red when there are any. |
| Worker lines | The lines added and removed by subagents this session; your own edits are not counted. |
| Running | How many subagents are running now. |
| Session | How long this session has been open, counted from when it started rather than from the first prompt. |
| Prompts | How many prompts you have sent this session. |

## Develop

Install once; this also points git at `.githooks/`, whose pre-commit hook runs the check:

```bash
npm install
```

The check is a typecheck, the strict validator and the full test suite:

```bash
npm run check
```

The typecheck needs `.claude-plugin/types/`, which Claude Code writes when it loads the mod. The design is in `docs/specs/` (`2026-10-20-no-red-pill.md` replaces the red-pill parts of the first spec), the build plan in `docs/plans/`, and the review rules in `CODING_STANDARDS.md`.

**Two rules the validator enforces:**

- The plugin registers each event once. Events that both halves need are exported as `async function` hooks and chained in `hooks/register.tsx`.
- Any helper that receives `$` is a `function` declaration, and every state atom is declared in the file that reads it.

**Caveats:**

- Mods use an early-access Claude Code API (built against engine 2.1.299). A Claude Code update may break the plugin, and the tests are what will catch it.
- Costs are estimates from a built-in price table (`hooks/lib/prices.ts`), not a bill.

## License

MIT. See [LICENSE](LICENSE). The original claude-kit copyright notice is kept.
