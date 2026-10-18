# matrix-kit

A Claude Code plugin in the style of The Matrix. It's a re-themed and extended copy of [claude-kit](https://github.com/JohnnyVizz/claude-kit), built from the commit `c871c15` that was audited on 2026-10-18. It never pulls upstream changes.

It adds:

- **`/red-pill <task>`**, an orchestrated workflow. The main session plans the work, hands each piece to a worker, and reviews what comes back. It asks before running `git init` and before every commit.
- **A progress bar** above the prompt that fills with falling green code. Mouse runs at the end of the bar while any worker is busy.
- **The Construct** (`/construct`, `/construct open`), a panel with session metrics at the top and the crew below. Each crew member is animated while working, glitches if it fails, and is dimmed while only planned.
- **The operator strip** (`/operator`), a row of metrics above the prompt:
  - tok/s;
  - cost of the last prompt and of the session;
  - prompt-cache countdown;
  - context fill;
  - plan usage limits;
  - model and effort;
  - room left in the context window.

  Items drop off as the window narrows. `/operator demo <minutes>` previews the cache warning, and `/operator json` prints every collected figure.

## The crew

| Character | Agent | Model / effort | Takes |
| --- | --- | --- | --- |
| Neo | `neo` | Fable / high | the hardest logic and bugs |
| Morpheus | `morpheus` | Opus / xhigh | unfamiliar code, unclear root causes |
| Trinity | `trinity` | Opus / high | delicate but well-understood changes |
| Tank | `tank` | Opus / medium | standard feature work |
| Mouse | `mouse` | Opus / low | mechanical edits, builds, tests |
| The Oracle | (any Explore agent) | — | searching the code |
| Agent Smith | (any other agent) | — | everything else |

**No Fable access?** Change `model: fable` to `model: opus` in `agents/neo.md`. Otherwise every task given to Neo fails, and shows the glitch.

## Install

To load the plugin for one session:

```bash
claude --plugin-dir C:\Users\brann\matrix-kit
```

To load it in every session, desktop app included, add the folder to the `env` block of `~/.claude/settings.json`. If other folders are already listed, separate them with `;` on Windows:

```json
{ "env": { "CLAUDE_CODE_PLUGIN_DIRS": "C:\\Users\\brann\\matrix-kit", "CLAUDE_CODE_PLUGIN_DIR_WATCH": "1" } }
```

`CLAUDE_CODE_PLUGIN_DIR_WATCH` reloads the plugin when its files change.

**Setting:** `autoOpen` is `crew` (the default) or `any`. With `crew`, The Construct opens when a crew worker starts or a plan is reported. With `any`, it also opens for any other subagent.

## Develop

```bash
claude plugin validate --strict .
```

```bash
claude plugin test .
```

The design is in `docs/specs/`, and the build plan in `docs/plans/`.

**Two rules the validator enforces:**

- The plugin registers each event once. Events that both halves need are exported as `async function` hooks and chained in `hooks/register.tsx`.
- Any helper that receives `$` is a `function` declaration, and every state atom is declared in the file that reads it.

**Caveats:**

- Mods use an early-access Claude Code API (built against engine 2.1.299). A Claude Code update may break the plugin, and the tests are what will catch it.
- Costs are estimates from a built-in price table (`hooks/lib/prices.ts`), not a bill.

## License

MIT. See [LICENSE](LICENSE). The original claude-kit copyright notice is kept.
