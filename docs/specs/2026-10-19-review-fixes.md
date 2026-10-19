# matrix-kit — code-review fixes

Date: 2026-10-19 · Status: ready-for-agent · Owner: Brannon Oh
Tracker: none yet. matrix-kit is local-only; this becomes a GitHub issue once the repo is published.
Builds on: `2026-10-18-matrix-kit-design.md` (the design spec). Source: the two-axis `/code-review` of 616eafc..2dd2e13, plus two minors Brannon approved from the earlier whole-branch review.

## Problem Statement

matrix-kit works, but in places what it shows doesn't match the design or is misleading:

- **The Construct shows totals twice.** The crew's cost, tokens and time are drawn as three separate header tiles, and the new metrics block sits beneath them. The design said the block replaces those tiles.
- **Terminal badges aren't Matrix-coloured.** Most crew members' letters are salmon, amber, blue, gold or grey instead of green tones.
- **The session clock stops when nothing is running.** In an open Construct it freezes whenever no worker is active.
- **The session clock reads "—" until the first prompt**, even though the session has already started.
- **Light mode is only half done.** The progress bar and the operator strip darken their greens, but The Construct doesn't. Neo's name, the done ticks, the green sprite pixels and the failure glitch stay bright neon on a white background.
- **"Lines" is ambiguous.** The tile counts only lines changed by workers, but doesn't say so.
- **Missing figures look like real ones.** When Claude Code reports no cost, the strip shows $0.00. Before any context figure arrives, it shows 0%. (Fixed in the working tree, not yet committed.)
- **The strip and the panel format money differently**, so $12.34 reads "$12.34" in one and "$12.3" in the other. (Fixed in the working tree, not yet committed.)
- **Leftovers from the removed translations** make the code harder to read.
- **The design spec is out of date in two places.** It doesn't say where the prompt count comes from, and it doesn't mention two debug options of the strip command.

## Solution

From Brannon's point of view, after this change:

- **The Construct** opens with one metrics block that includes the crew's cost, tokens and time. There are no duplicate tiles.
- **Session clock:** it shows how long the session has been open from the moment it starts, and keeps counting every second while The Construct is open, busy or idle.
- **Light mode:** every bright green in The Construct (names, ticks, sprite pixels, glitch stripes) darkens to the readable light-mode green, as the strip and bar already do.
- **Terminal:** each crew member's badge letter is a different shade of green.
- **Labels and blanks:** the lines tile reads "Worker lines". Missing cost and context show "—", and money looks the same everywhere.
- **The design spec** matches the code.

## User Stories

1. As Brannon, I want The Construct to show the crew's cost, tokens and time inside the metrics block, so that I don't see the same totals twice.
2. As Brannon, I want the crew totals labelled "Crew cost", "Crew tokens" and "Crew time", so that I can tell them apart from the session-wide figures.
3. As Brannon using the terminal, I want the crew totals as lines in the same list as the other metrics, so that the terminal and desktop show the same things.
4. As Brannon using the terminal, I want every crew member's badge letter in a green tone, so that the terminal looks like the Matrix too.
5. As Brannon, I want each crew member's green to be distinguishable from the others, so that I can still tell Neo from Mouse at a glance.
6. As Brannon, I want the session clock to count up every second while The Construct is open, even when no worker is running, so that it never looks stuck.
7. As Brannon, I want the session clock to stop ticking when The Construct is closed and nothing runs, so that the plugin does no work I can't see.
8. As Brannon, I want the session clock to show a time as soon as the session starts, so that it doesn't read "—" until my first prompt.
9. As Brannon in light mode, I want crew members' names in The Construct darkened to readable green, so that they aren't neon on white.
10. As Brannon in light mode, I want the done tick marks darkened too, so that finished rows read clearly.
11. As Brannon in light mode, I want the green pixels in the sprites (Neo's code streaks, the glints in the shades) darkened, so that the characters look right on a white background.
12. As Brannon in light mode, I want the failure glitch stripes darkened, so that a failed worker still reads as a glitch and not a smear.
13. As Brannon in dark mode, I want The Construct to look exactly as it does today, so that the light-mode fix changes nothing I already like.
14. As Brannon, I want the lines tile labelled "Worker lines", so that I know my main conversation's edits aren't counted.
15. As Brannon, I want the strip to show "—" for the last prompt's cost and the session cost when Claude Code reports no cost, so that I'm not told something cost $0.00 when it didn't.
16. As Brannon, I want the strip to show "—" for context before Claude Code has reported any context figure, so that an unknown doesn't look like an empty context.
17. As Brannon, I want money formatted the same way in the strip and in The Construct, so that the same amount never reads two ways.
18. As Brannon reading the code later, I want the leftover translation tables and aliases gone, so that the code says only what it does.
19. As Brannon reading the design spec, I want it to say the prompt count comes from the plugin's own count of main-conversation prompts, so that the spec and the code agree.
20. As Brannon reading the design spec, I want `/operator json` and `/operator width` documented as debug options, so that nothing the plugin does is undocumented.
21. As a future agent working on matrix-kit, I want every fix covered by a test that failed before the fix, so that a later change can't quietly undo it.

## Implementation Decisions

- **Crew totals into the metrics block.**
  - The panel's header keeps only the flow's title.
  - The crew's cost, token and time totals become three entries in the metrics block's tile list, labelled "Crew cost", "Crew tokens" and "Crew time". They're drawn the same way as every other tile on desktop, and as one line each in the terminal.
  - The terminal's separate "≈cost · tokens · time" summary line goes, because those lines replace it.
  - The header's height and the backdrop grid's height are recalculated to match.
- **Green badge colours.** Each crew member's accent becomes a distinct green tone, where green is the strongest channel. Neo keeps phosphor green, so the Matrix look is anchored on him. This one colour table serves both the terminal badges and the panel's name colours, so they stay in step.
- **Light mode for The Construct.**
  - The theme module gains a general form of its existing light-mode rule for colours set by attribute. The rule takes a list of greens and maps each to the light-mode green under `prefers-color-scheme: light`.
  - Every drawing in The Construct includes this rule for the palette greens and every crew accent colour. That covers names, done ticks, sprite pixels and glitch stripes.
  - Dark mode is untouched.
  - The existing strip-icon rule becomes the same function applied to the palette greens.
- **Session clock while idle.** The panel's once-a-second tick runs when a worker is running *or* The Construct is open, and stays quiet otherwise. Whether the panel is open is read from the open panes each tick.
- **Session clock from the start.** At session start, the operator reads Claude Code's usage once, recording the session start time, cost and context. A failed read is ignored, so the session still starts. The reading is the same refresh the operator already does after each turn.
- **Lines label.** The tile is renamed "Worker lines"; its value format ("+12 −4") stays.
- **Missing cost and context** (already in the working tree):
  - The collected session cost may be "unknown" until Claude Code reports one.
  - A prompt's start no longer records an unknown cost as zero.
  - The strip shows "—" for an unknown cost, and for context until a figure arrives. The context icon draws empty in that case, and the bar is hidden.
- **One money format** (already in the working tree). The strip uses the shared money formatter from the format helpers; its private formatter is deleted.
- **Leftover cleanup.**
  - The effort-word table that maps each word to itself is removed; effort words show as given.
  - The `s` alias for the word table is removed wherever it appears.
  - This is a pure refactor with no behaviour change.
- **Design spec updates.**
  - Section 6, row 1: the prompt count comes from the operator's own count of main-conversation prompts, which it increments at each main `turn.start`.
  - Section 5.4: `/operator json` (prints every collected figure, for tests and debugging) and `/operator width` (reports the strip's width and which items fit) are documented as debug options.
  - Section 5.3: the crew totals are inside the metrics block.
- **Unchanged.** No change to commands, tool names, agent names, state keys or the one-hooks-module structure.

## Testing Decisions

- **What makes a good test here:** it drives the plugin through the test kit the way Claude Code would, by raising a session start, a turn, a worker spawn or a clock advance. It then checks only what Brannon would see: a line of terminal text, or the drawing of a desktop row. It never checks internal variables or the order of hooks.
- **Primary seam (one for almost everything):** the test kit stands in for Claude Code. Tests mount The Construct or the operator strip on the terminal or desktop surface and look for text or drawn content. The mocked clock's advance drives the idle-tick test.
- **Secondary seam:** `/operator json`. It's only for a figure that isn't drawn yet: the session start time recorded at session start.
- **No new seams.** The pure helper tests (format, theme, sprites, strip layout, metrics arithmetic) stay where they are. The green-badge check is one more assertion in the sprite tests, because it's a fact about the colour table itself.
- **Tests for this change**, each written before its fix and watched to fail:
  - Desktop: The Construct has no separate rounded header tiles, and "Crew cost" is in the drawing.
  - Terminal: "Worker lines +0 −0" is shown.
  - Desktop: The Construct's drawing contains a light-mode rule that darkens `#00FF41` fills.
  - The session clock advances from "Session 0:00" to "Session 0:05" in an open Construct with nothing running, when the test clock moves five seconds.
  - `/operator json` reports the session start time right after session start, before any prompt.
  - Every crew accent colour is green-dominant.
  - The strip shows "| —" and no "$0.00" when no cost is reported. *(Already passing.)*
  - The strip shows no "0%" before a context figure arrives. *(Already passing.)*
  - The strip shows "| $12.3" for a $12.34 session. *(Already passing.)*
- **Prior art:** the existing crew-panel, metrics and strip test files already mount panes this way and mock the engine beneath the plugin. New tests follow their helpers (`worker`, `mainTurn`, `oneTurn`).
- **Test-setup correction:** the test kit's reply for a usage reading must be wrapped as `{ value: … }`. The unwrapped form tried in the working tree is wrong and gets reverted. With the wrapper, any test whose usage reading still fails has a real bug to find, not a setup error.
- **Gate:** `claude plugin validate --strict .` passes and `claude plugin test .` passes in full before the change is committed.

## Out of Scope

- **The validator's README warning** (no marketplace install line). It's resolved when matrix-kit is published to GitHub.
- **Session totals in the tiles.** Showing "this turn and session" side by side in the Tokens, Cache hit and Tools tiles is deferred.
- **The plugin's own notification** counting as a tool call.
- **Neo refused at spawn** leaving no row.
- **Error fallbacks** (`.catch`) on the gating hooks.
- **Manual stream cleanup** when the consumer stops early.
- **The other code smells:** repeated crew-name checks, the repeated Agent Smith fallback, repeated tile markup, the hand-typed clock format, the misleading `tier` name, and lines added and removed travelling as a pair. These are tidiness only and are deferred.
- **`/operator width` and the dotted backdrop grid** stay. They're documented, not removed.
- **Publishing** to GitHub.

## Further Notes

- **Already done in the working tree.** Three fixes are done but not committed: the "—" for unknown cost, the "—" for unknown context, and the single money format. Their tests pass.
- **To revert first.** The working tree also holds the wrong usage-reading setup change to the tests, described under Testing Decisions. Implementation starts by reverting it.
- **Commits.** One commit for the whole change is fine, with a `fix:` subject, because the user-visible items are corrections to the agreed design. A separate `refactor:` commit for the leftover cleanup is also acceptable.
- **Manual check.** After this change, Brannon's manual check list (light and dark mode, reduced motion, narrow window, `/operator demo 4`) still applies, and should be re-run for light mode in particular.
