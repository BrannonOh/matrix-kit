# matrix-kit — without red-pill

Date: 2026-10-20 · Status: built · Owner: Brannon Oh

This replaces the parts of the [2026-10-18 design spec](2026-10-18-matrix-kit-design.md) that depended on `/red-pill`: section 5.1, and the flow, crew and planned-task parts of 5.2, 5.3 and 7. The metrics (section 6), the theme and the operator strip are unchanged.

## 1. Goal

Watch the progress of any multi-step work without starting a workflow. The `/red-pill` skill was never used, and it cost context in every session that listed its five agents.

## 2. Removed

- The `red-pill` skill and its `progress` tool (`mcp__matrix-kit__progress`).
- The five crew agents (`agents/*.md`). Characters are now picked by model (section 4), so nothing chooses these agents any more.
- The `autoOpen` setting.
- The Construct's dimmed "planned" rows, which came from red-pill's plan.
- Tank's sprite. Mouse stays only as the runner at the end of the bar.

## 3. The progress bar follows the task list

The bar mirrors the task list the main session already keeps:

| Source | Calls | Effect |
| --- | --- | --- |
| Desktop app | `mcp__ccd_turn__update_plan` | `items` replaces the list; `done` checks steps off; `start` makes one step the one in progress (any other goes back to pending); `advance` completes the step in progress and starts the next pending one |
| Desktop app | `mcp__ccd_turn__wrap_up` | checks every step off |
| CLI | `TodoWrite` | replaces the list |
| CLI | `TaskCreate`, `TaskUpdate` | adds a step (the id comes from the result), or changes or deletes one by id |

The rules live in `hooks/lib/plan.ts`. A live test on 2026-10-20 confirmed that a plugin's `tool.call` hook sees `update_plan` calls and their input in the desktop app.

- Only the main session's calls count. A call from a subagent carries its `agentId` and is ignored.
- A call that ends in an error changes nothing, and the mirror can never fail the call it follows.
- **Label:** `Tasks 2/5` while working, `Done` once every step is checked off. **Title:** the step in progress, else the next pending one, else the last one.
- **Fill:** completed steps as code rain, plus a faint layer for the step in progress.
- **Lifecycle:** a finished list glows in the done green until the next main prompt, then hides. A new list replaces the old one, and ✕ dismisses it at once. An unfinished list carries over into the next prompt.
- After a list is finished, the next `TaskCreate` starts a new list.

## 4. Characters come from the model

| Model family | Character |
| --- | --- |
| Fable | Neo |
| Opus | Morpheus |
| Sonnet | Trinity |
| Haiku | The Oracle |
| not known yet, or any other | Agent Smith |

- The family is matched anywhere in the model id, so aliases (`opus`) and provider ids (`us.anthropic.claude-sonnet-…`) count. Effort plays no part.
- The agent type plays no part either: a Sonnet Explore agent is Trinity.
- A row whose spawn reported no model shows Agent Smith until its first step names one.

## 5. The Construct

- Opens by itself when any subagent starts, once per main prompt. If you close it mid-prompt, it stays closed until the next one.
- Every subagent except Explore gets the step note added to its brief, so its row shows a step bar. Explore runs are short searches and keep the grey context bar.
- The header shows the step in progress. The "Crew" tiles count every subagent.
