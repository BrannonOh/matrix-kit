import { atom, read, update } from 'claude-code'
import type { EngineInterface, On } from 'claude-code'
import type { AbovePromptInput, HookArgs, Options, Then } from './lib/shared.ts'

import type { AgentRun, Flow, Panel, Phase, PlannedTask } from '../types/index.d.ts'
import { clip, fitText, fmtCost, fmtDuration, fmtTime, fmtTokens, modelName, textWidth, xml } from './lib/format.ts'
import { emptyMetrics, hitRate } from './lib/metrics.ts'
import type { Metrics } from './lib/metrics.ts'
import { costOf, windowOf } from './lib/prices.ts'
import { LIGHT_GREENS, MONO_FONT, PALETTE, glyphAt, lightGreensCss, noise, themeCss } from './lib/theme.ts'
import { CHARACTER_COLOR, CHARACTER_LIGHT_COLOR, SPRITE_CSS, badgeOf, spriteSvg } from './lib/sprites.ts'
import { CHARACTER_NAME, TIER_MODEL, TIERS, characterOf, isCrew } from './lib/crew.ts'
import type { Character, Tier } from './lib/crew.ts'

const flow = atom({ plugin: 'matrix-kit', key: 'flow' } as const, null)
const agents = atom({ plugin: 'matrix-kit', key: 'agents' } as const, [])
const panel = atom({ plugin: 'matrix-kit', key: 'panel' } as const, {
  isCompact: false,
  isDoneCollapsed: false,
  autoOpenedFor: '',
})
const now = atom({ plugin: 'matrix-kit', key: 'now' } as const, 0)
// The operator's figures (operator.tsx writes them; the scan wants each file's atoms its own).
const metrics = atom({ plugin: 'matrix-kit', key: 'metrics' } as const, emptyMetrics() as Metrics)

const TOOL = 'mcp__matrix-kit__progress'
const STEP_TOOL = 'mcp__matrix-kit__step'
// Added to the end of each crew worker's brief. Their system prompt words step
// reporting as a condition ("if the step tool appears among your tools") and they
// skip it even with the tool listed; the same request in the brief is followed.
const STEP_BRIEF = `

Progress reporting: before any other work, call \`${STEP_TOOL}\` with \`total\` (your plan in 3-8 steps) and \`done: 0\`; call it again with \`done\` and a few-word \`note\` as each step finishes. It only draws a progress bar.`
const PANE = 'matrix-construct'
const PHASES: readonly Phase[] = ['plan', 'design', 'delegate', 'review', 'close']
// The tools' schemas are advice to the model, not a check: what a call may ask
// the band and the panel to draw is bounded here.
const MAX_TASKS = 200
const MAX_AFTER = 20
const MAX_TITLE = 120

type ProgressInput = {
  title?: string
  total?: number
  done?: number
  phase?: Phase
  finished?: boolean
  tasks?: { title?: string; tier?: string; after?: number[] }[]
}

// ---------------------------------------------------------------------------
// The words the bar and the panel draw.
const S = {
  pane: 'The Construct',
  cost: 'Crew cost',
  tokens: 'Crew tokens',
  time: 'Crew time',
  collapse: 'Collapse',
  expand: 'Expand',
  running: 'Running',
  finished: 'Finished',
  planned: 'Planned',
  empty: 'No crew yet.',
  round: 'round',
  failed: 'error',
  after: 'after',
  tokensWord: 'tokens',
  agentsCount: 'agents',
  isRunning: 'running',
  isFinished: 'finished',
  isPlanned: 'planned',
  opened: 'The Construct opened.',
  closed: 'The Construct closed.',
  done: 'Done',
  plan: 'Plan',
  design: 'Design',
  tasks: 'Tasks',
  review: 'Review',
  busy: 'running',
  ctx: 'ctx',
} as const

// Character names as shown; anything unknown shows as it came.
const tierWord = (tier: string): string => CHARACTER_NAME[tier as Character] ?? tier

const blank = (): Flow => ({
  title: 'red-pill',
  total: 0,
  done: 0,
  running: 0,
  phase: 'plan',
  isFinished: false,
  tasks: [],
})

const isNewFlow = (prev: Flow | null, input: ProgressInput): boolean =>
  !prev || prev.isFinished || (input.title !== undefined && clip(input.title.trim(), MAX_TITLE) !== prev.title)

// Only a known tier is kept: the name is later a key into the tier tables.
const tierName = (v: string): string => {
  const t = v.replace(/^matrix-kit:/, '').trim().toLowerCase()
  return (TIERS as readonly string[]).includes(t) ? t : ''
}

const cleanTasks = (tasks: ProgressInput['tasks']): PlannedTask[] | undefined =>
  tasks
    ?.filter(t => t.title?.trim())
    .slice(0, MAX_TASKS)
    .map(t => ({
      title: (t.title ?? '').trim(),
      tier: tierName(t.tier ?? ''),
      after: (t.after ?? []).filter(n => Number.isInteger(n) && n > 0).slice(0, MAX_AFTER),
    }))

const merge = (prev: Flow | null, input: ProgressInput): Flow => {
  // A new title means a new flow: never carry counters over from an earlier one.
  const base = isNewFlow(prev, input) || !prev ? blank() : { ...blank(), ...prev }
  const tasks = cleanTasks(input.tasks) ?? base.tasks
  const total = Math.min(MAX_TASKS, Math.max(0, Math.round(input.total ?? (input.tasks ? tasks.length : base.total))))
  const done = Math.min(total || Infinity, Math.max(0, Math.round(input.done ?? base.done)))
  const phase = input.phase && PHASES.includes(input.phase) ? input.phase : base.phase
  return {
    ...base,
    title: clip(input.title?.trim() || base.title, MAX_TITLE),
    total,
    done,
    phase: input.finished ? 'close' : phase,
    isFinished: input.finished === true,
    tasks,
  }
}

const label = (f: Flow): string => {
  if (f.isFinished) return S.done
  if (f.phase === 'plan') return S.plan
  if (f.phase === 'design') return S.design
  const count = f.total ? `${f.done}/${f.total}` : `${f.running} ${S.busy}`
  return `${f.phase === 'review' ? S.review : S.tasks} ${count}`
}

const ratio = (f: Flow): number => (f.isFinished ? 1 : f.total ? f.done / f.total : 0)

// The whole row is one SVG: the desktop wraps sibling elements onto new lines,
// so title, bar, percent and the runner live in one drawing; only the count and
// the dismiss are Buttons beside it.
const H = 22
const BAR_H = 16
// Room at the row's end for Mouse, who runs while any worker does.
const RUNNER_W = 26
// One rain column is GLYPH_W wide and holds two glyphs, one above the other.
const GLYPH_W = 5
const GLYPH_ROWS = 2
const FONT = MONO_FONT

const rowSvg = (f: Flow, W: number, isWorking: boolean): string => {
  // The title takes what it needs, up to 40% of the row; the bar takes the rest.
  const title = fitText(f.title, 13, Math.max(60, W * 0.4))
  const BAR_X = Math.round(16 + textWidth(title, 13) + 12)
  const BAR_W = Math.max(60, W - BAR_X - 46 - RUNNER_W)
  const tone = f.isFinished ? 'dn' : 'acc'
  const y0 = (H - BAR_H) / 2
  const fillW = Math.round(BAR_W * ratio(f))
  const runW = f.total ? Math.round((BAR_W * Math.min(f.total, f.done + f.running)) / f.total) : 0
  const glyph = (c: number, r: number, cls: string, opacity: number): string =>
    `<text class="${cls}" x="${c * GLYPH_W + 0.5}" y="${(r + 1) * (BAR_H / GLYPH_ROWS) - 1.5}" opacity="${opacity.toFixed(2)}">${glyphAt(c, r)}</text>`

  // Accepted work: rain that brightens toward the leading edge, in four twinkling groups.
  const cols = Math.floor(fillW / GLYPH_W)
  const rain: string[][] = [[], [], [], []]
  for (let c = 0; c < cols; c++) {
    const opacity = 0.35 + 0.65 * Math.pow((c + 1) / cols, 1.4)
    for (let r = 0; r < GLYPH_ROWS; r++) rain[Math.floor(noise(r, c) * 4)]?.push(glyph(c, r, tone, opacity))
  }
  // Handed to workers, not yet accepted: a faint second layer.
  const faint: string[] = []
  for (let c = cols; c < Math.floor(runW / GLYPH_W); c++) {
    for (let r = 0; r < GLYPH_ROWS; r++) if (noise(c + 7, r + 3) < 0.5) faint.push(glyph(c, r, tone, 0.3))
  }

  const ticks: string[] = []
  for (let i = 1; i < f.total; i++) {
    const x = Math.round((BAR_W * i) / f.total)
    if (x > fillW + 4) ticks.push(`<rect x="${x}" y="${BAR_H / 2 - 4}" width="1.5" height="8"/>`)
  }

  const text = label(f)
  const pillW = Math.round(18 + text.length * 6.6)
  const pillX = Math.max(0, Math.min(BAR_W - pillW, fillW - pillW))
  const percent = `${Math.round(ratio(f) * 100)}%`

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
${themeCss()}<style>
.r0,.r1,.r2,.r3{animation:tw ${f.isFinished ? 3.2 : 2.2}s ease-in-out infinite}
.r1{animation-duration:${f.isFinished ? 3.8 : 2.8}s;animation-delay:-.7s}.r2{animation-duration:${f.isFinished ? 4.4 : 1.9}s;animation-delay:-1.3s}.r3{animation-duration:${f.isFinished ? 3.5 : 3.3}s;animation-delay:-.4s}
@keyframes tw{0%,100%{opacity:1}50%{opacity:${f.isFinished ? 0.8 : 0.35}}}
@media (prefers-reduced-motion: reduce){.r0,.r1,.r2,.r3{animation:none}}
</style>
<defs><clipPath id="c"><rect x="0" y="0" width="${BAR_W}" height="${BAR_H}" rx="3"/></clipPath></defs>
<rect class="${tone}" x="1" y="${H / 2 - 4}" width="8" height="8"/>
<text class="t" x="16" y="${H / 2 + 4.5}" font-family="${FONT}" font-size="13" font-weight="500">${xml(title)}</text>
<g transform="translate(${BAR_X},${y0})">
<rect class="k" width="${BAR_W}" height="${BAR_H}" rx="3"/>
<g clip-path="url(#c)" font-family="${FONT}" font-size="7.5">
${rain.map((g, i) => `<g class="r${i}">${g.join('')}</g>`).join('')}
<g>${faint.join('')}</g>
<g class="tk">${ticks.join('')}</g>
</g>
<rect class="${tone}" x="${pillX}" width="${pillW}" height="${BAR_H}" rx="3"/>
<text x="${pillX + pillW / 2}" y="${BAR_H / 2 + 4}" text-anchor="middle" font-family="${FONT}" font-size="11" font-weight="600" class="pt">${xml(text)}</text>
</g>
<text class="m" x="${W - RUNNER_W - 6}" y="${H / 2 + 4.5}" text-anchor="end" font-family="${FONT}" font-size="12.5" font-variant-numeric="tabular-nums">${percent}</text>
${SPRITE_CSS}${spriteSvg('mouse', isWorking ? 'running' : 'done', { x: W - RUNNER_W + 3, y: 0, scale: 0.72 })}
</svg>`
}

const barText = (f: Flow, width: number): string => {
  const filled = Math.round(width * ratio(f))
  return '█'.repeat(filled) + '░'.repeat(Math.max(0, width - filled))
}

// ---------------------------------------------------------------------------
// Agents panel: every subagent of the session, plus the tasks the flow planned.

// A character's accent color.
const colorOf = (c: string): string => CHARACTER_COLOR[c as Character] ?? CHARACTER_COLOR.smith

// "Opus · xhigh"; '' for an unknown tier.
const tierModel = (tier: string): string => {
  const m = TIER_MODEL[tier as Tier]
  return m ? `${m[0]} · ${m[1]}` : ''
}

// "Opus 5.5 · low" for a run, or just the model when no effort was seen.
const runModel = (a: AgentRun): string => (a.effort ? `${modelName(a.model)} · ${a.effort}` : modelName(a.model))


const norm = (s: string): string => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

const elapsed = (a: AgentRun, at: number): number => (a.endedAt ?? Math.max(at, a.startedAt)) - a.startedAt

type Planned = PlannedTask & { n: number }

const plannedOf = (f: Flow | null, list: AgentRun[]): Planned[] => {
  if (!f || f.isFinished) return []
  const started = new Set(list.map(a => norm(a.description)))
  return (f.tasks ?? []).map((t, i) => ({ ...t, n: i + 1 })).filter(t => !started.has(norm(t.title)))
}

const totals = (list: AgentRun[], at: number) => {
  const cost = list.reduce((s, a) => s + a.costUsd, 0)
  const tokens = list.reduce((s, a) => s + a.tokens, 0)
  const start = Math.min(...list.map(a => a.startedAt))
  const end = Math.max(...list.map(a => a.endedAt ?? Math.max(at, a.startedAt)))
  return { cost, tokens, time: list.length ? end - start : 0 }
}

// --- desktop drawings: each row is one SVG, as the band above the prompt is.

// The pane's backdrop: a dotted grid as tall as the content laid over it; the
// row SVGs are transparent, so it shows through between their marks.
const GRID_STEP = 16
// A Text or Button row on the desktop is about 20px; the grid errs taller.
const LINE_H = 24
// The engine refuses an Svg taller than 4096px, so a long grid is stacked from
// tiles of at most this height; a multiple of GRID_STEP keeps the dots aligned.
const GRID_TILE = 4096
const gridTiles = (H: number) => Array.from({ length: Math.ceil(H / GRID_TILE) }, (_, i) => Math.min(GRID_TILE, H - i * GRID_TILE))
const gridSvg = (W: number, H: number) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<style>.d{fill:${PALETTE.faint}}@media (prefers-color-scheme: light){.d{fill:#D5E0D7}}</style>
<defs><pattern id="g" width="${GRID_STEP}" height="${GRID_STEP}" patternUnits="userSpaceOnUse"><circle class="d" cx="${GRID_STEP / 2}" cy="${GRID_STEP / 2}" r="1"/></pattern></defs>
<rect width="${W}" height="${H}" fill="url(#g)"/>
</svg>`

const PANE_CSS = `<style>
.t{fill:#C8FFD4}.s{fill:#7FC796}.m{fill:#3F9A58}.k{fill:#06120A}.ln{stroke:#0D3B1A}.tile{fill:#0A1F10}
@media (prefers-color-scheme: light){.t{fill:#1F2A22}.s{fill:#4F6B57}.m{fill:#7A947F}.k{fill:#E6ECE7}.ln{stroke:#D5E0D7}.tile{fill:#EEF3EF}}
.live{animation:p 1.6s ease-in-out infinite}@keyframes p{50%{opacity:.3}}
@media (prefers-reduced-motion: reduce){.live{animation:none}}
</style>${lightGreensCss({
  ...LIGHT_GREENS,
  ...Object.fromEntries(Object.entries(CHARACTER_COLOR).map(([c, dark]) => [dark, CHARACTER_LIGHT_COLOR[c as Character]])),
})}`

const statusMark = (x: number, y: number, status: string, color: string): string => {
  if (status === 'running') return `<circle class="live" cx="${x}" cy="${y}" r="3.5" fill="${color}"/>`
  if (status === 'done') return `<path d="M${x - 5} ${y}l3.5 3.5 6.5-7" fill="none" stroke="${PALETTE.done}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`
  if (status === 'failed') return `<path d="M${x - 4} ${y - 4}l8 8M${x + 4} ${y - 4}l-8 8" stroke="${PALETTE.alert}" stroke-width="1.8" stroke-linecap="round"/>`
  return `<circle cx="${x}" cy="${y}" r="5" fill="none" stroke="#9a9a96" stroke-width="1.4"/><path d="M${x} ${y - 2.5}v2.8l1.8 1.2" fill="none" stroke="#9a9a96" stroke-width="1.4" stroke-linecap="round"/>`
}

const svg = (W: number, H: number, body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${PANE_CSS}${SPRITE_CSS}${body}</svg>`

// The pane's own title already says "The Construct": the header names the flow, if any.
const headerSvg = (W: number, title: string): string =>
  svg(W, headerHeight(title), `<text class="t" x="${0}" y="${15}" font-family="${FONT}" font-size="14" font-weight="600">${xml(fitText(title, 14, W))}</text>`)

const headerHeight = (title: string): number => (title ? 24 : 0)

// The task's own progress when the worker reports steps; a finished run is full.
const progressOf = (a: AgentRun): number | null => {
  if (a.status === 'done') return 1
  if (a.stepTotal) return Math.min(1, (a.stepDone ?? 0) / a.stepTotal)
  return null
}

const ctxOf = (a: AgentRun): number => (a.contextMax ? Math.min(100, Math.round((a.contextTokens / a.contextMax) * 100)) : 0)

const agentSvg = (W: number, a: AgentRun, at: number): string => {
  const tier = characterOf(a.type)
  const color = colorOf(tier)
  const ctx = ctxOf(a)
  const textW = W - 42 - 22
  const meta = [runModel(a)]
  if (a.round > 1) meta.push(`${S.round} ${a.round}`)
  if (a.status === 'failed') meta.push(S.failed)
  const barW = textW
  const progress = progressOf(a)
  const stats = `${S.ctx} ${ctx}% · ${fmtTokens(a.contextTokens)}  ≈${fmtCost(a.costUsd)}  ${fmtTime(elapsed(a, at))}`
  const steps = a.stepTotal ? `${a.stepDone ?? 0}/${a.stepTotal}${a.stepNote ? ' · ' + a.stepNote : ''}` : ''
  const stepsW = Math.max(0, barW - textWidth(stats, 11) - 12)
  // Without reported steps the bar falls back to the context, drawn grey.
  const fillW = Math.round(barW * (progress ?? ctx / 100))
  return svg(
    W,
    66,
    `${spriteSvg(tier, a.status, { x: 4, y: 16, scale: 1.1 })}
<text class="t" x="${42}" y="${18}" font-family="${FONT}" font-size="13" font-weight="600">${xml(fitText(a.description || a.type, 13, textW))}</text>
<text x="${42}" y="${34}" font-family="${FONT}" font-size="11"><tspan fill="${color}">${xml(tierWord(tier))}</tspan><tspan class="s">  ${xml(meta.join('  ·  '))}</tspan></text>
${steps && stepsW > 30 ? `<text class="t" x="${42}" y="${49}" font-family="${FONT}" font-size="11" font-variant-numeric="tabular-nums">${xml(fitText(steps, 11, stepsW))}</text>` : ''}
<text class="s" x="${42 + barW}" y="${49}" text-anchor="end" font-family="${FONT}" font-size="11" font-variant-numeric="tabular-nums">${stats}</text>
<rect class="k" x="${42}" y="55" width="${barW}" height="4" rx="2"/><rect${progress === null ? ' class="m"' : ''} x="${42}" y="55" width="${fillW}" height="4" rx="2"${progress === null ? '' : ` fill="${color}"`}/>
${statusMark(W - 8, 16, a.status, color)}
<line class="ln" x1="0" y1="65.5" x2="${W}" y2="65.5"/>`,
  )
}

const plannedSvg = (W: number, p: Planned): string => {
  const tier = p.tier in CHARACTER_COLOR ? p.tier : 'smith'
  const color = colorOf(tier)
  const textW = W - 42 - 22
  const meta = [tierModel(tier)]
  if (p.after.length) meta.push(`${S.after} ${p.after.join(', ')}`)
  return svg(
    W,
    46,
    `${spriteSvg(tier as Character, 'planned', { x: 4, y: 6, scale: 1.1 })}
<text class="s" x="${42}" y="${18}" font-family="${FONT}" font-size="13" font-weight="600">${xml(fitText(`${p.n}. ${p.title}`, 13, textW))}</text>
<text x="${42}" y="${34}" font-family="${FONT}" font-size="11"><tspan fill="${color}">${xml(tierWord(tier))}</tspan><tspan class="m">  ${xml(meta.filter(Boolean).join('  ·  '))}</tspan></text>
${statusMark(W - 8, 16, 'planned', color)}
<line class="ln" x1="0" y1="45.5" x2="${W}" y2="45.5"/>`,
  )
}

const compactSvg = (W: number, list: AgentRun[], planned: Planned[], t: ReturnType<typeof totals>): string => {
  const icons = [
    ...list.filter(a => a.status === 'running').map(a => ({ k: characterOf(a.type), c: colorOf(characterOf(a.type)), s: a.status })),
    ...list.filter(a => a.status !== 'running').map(a => ({ k: characterOf(a.type), c: colorOf(characterOf(a.type)), s: a.status })),
    ...planned.map(p => ({ k: (p.tier in CHARACTER_COLOR ? p.tier : 'smith') as Character, c: colorOf(p.tier), s: 'planned' as const })),
  ]
  const fit = Math.max(1, Math.floor((W - 150) / 36))
  const shown = icons.slice(0, fit)
  const more = icons.length - shown.length
  const body = shown
    .map((ic, i) => spriteSvg(ic.k, ic.s, { x: i * 36 + 4, y: 1 }) + (ic.s === 'running' ? `<circle class="live" cx="${i * 36 + 32}" cy="4" r="3" fill="${ic.c}"/>` : ''))
    .join('')
  const x = shown.length * 36 + (more ? 4 : 0)
  return svg(
    W,
    32,
    `${body}${more ? `<text class="s" x="${x}" y="${21}" font-family="${FONT}" font-size="12">+${more}</text>` : ''}
<text class="s" x="${W}" y="${21}" text-anchor="end" font-family="${FONT}" font-size="12" font-variant-numeric="tabular-nums">≈${fmtCost(t.cost)} · ${fmtTokens(t.tokens)} · ${fmtTime(t.time)}</text>`,
  )
}

// The metrics block: the operator's figures for the session, one tile each.
type Tile = { label: string; value: string; isAlert?: boolean }

const pct = (r: number | null): string => (r === null ? '—' : `${Math.round(r * 100)}%`)

const metricTiles = (m: Metrics, crew: ReturnType<typeof totals>, running: number, clock: number): Tile[] => {
  const t = m.lastTurn
  return [
    { label: S.cost, value: `≈${fmtCost(crew.cost)}` },
    { label: S.tokens, value: fmtTokens(crew.tokens) },
    { label: S.time, value: fmtTime(crew.time) },
    { label: 'First token', value: m.ttftMs === null ? '—' : fmtDuration(m.ttftMs) },
    { label: 'Turn', value: m.turnMs === null ? '—' : fmtDuration(m.turnMs) },
    { label: 'Tokens', value: t ? `in ${fmtTokens(t.input)} · out ${fmtTokens(t.output)} · read ${fmtTokens(t.cacheRead)} · write ${fmtTokens(t.cacheWrite)}` : '—' },
    { label: 'Cache hit', value: pct(hitRate(t)) },
    { label: 'Saved', value: `≈${fmtCost(m.cacheSavingsUsd)}` },
    { label: 'Tools', value: `${m.tools.session}${m.tools.sessionErrors ? ` (${m.tools.sessionErrors} err)` : ''}`, isAlert: m.tools.sessionErrors > 0 },
    { label: 'Worker lines', value: `+${m.linesAdded} −${m.linesRemoved}` },
    { label: 'Running', value: String(running) },
    { label: 'Session', value: m.startedAt === null ? '—' : fmtTime(clock - m.startedAt) },
    { label: 'Prompts', value: String(m.turn) },
  ]
}

const TILE_H = 40
const TILE_GAP = 6
const tileCols = (W: number): number => (W >= 420 ? 3 : 2)
const metricsHeight = (W: number, n: number): number => Math.ceil(n / tileCols(W)) * (TILE_H + TILE_GAP)

const metricsSvg = (W: number, tiles: Tile[]): string => {
  const cols = tileCols(W)
  const tw = (W - TILE_GAP * (cols - 1)) / cols
  const body = tiles
    .map((tile, i) => {
      const x = (i % cols) * (tw + TILE_GAP)
      const y = Math.floor(i / cols) * (TILE_H + TILE_GAP)
      return `<rect class="tile" x="${x}" y="${y}" width="${tw}" height="${TILE_H}" rx="4"/>
<text class="s" x="${x + 9}" y="${y + 15}" font-family="${FONT}" font-size="11">${xml(tile.label)}</text>
<text ${tile.isAlert ? `fill="${PALETTE.alert}"` : 'class="t"'} x="${x + 9}" y="${y + 32}" font-family="${FONT}" font-size="13" font-weight="600" font-variant-numeric="tabular-nums">${xml(fitText(tile.value, 13, tw - 18))}</text>`
    })
    .join('\n')
  return svg(W, metricsHeight(W, tiles.length), body)
}

// --- terminal drawing: the same rows in text.

const ctxBar = (pct: number, width: number): string => {
  const filled = Math.round((width * pct) / 100)
  return '█'.repeat(filled) + '░'.repeat(Math.max(0, width - filled))
}

const STATUS_GLYPH: Record<string, string> = { running: '●', done: '✓', failed: '✗', planned: '◷' }

// Opens the agents pane, or closes it when it is up; true when it ends up open.
async function togglePane($: EngineInterface): Promise<boolean> {
  const isOpen = (await $.ui.panes()).some(p => p.id === PANE)
  if (isOpen) {
    await $.ui.close({ id: PANE })
    return false
  }
  const at = await $.clock.now()
  await update($, now, () => at)
  await $.ui.open({ id: PANE, title: S.pane })
  return true
}

async function autoOpen($: EngineInterface, key: string): Promise<void> {
  const p = await read($, panel)
  if (p.autoOpenedFor === key) return
  await update($, panel, prev => ({ ...prev, autoOpenedFor: key }))
  void $.ui.open({ id: PANE, title: S.pane })
}

// The option values, set on every (re)load before session.start runs.
let options: Options = {} as Options

export const registerConstruct = (on: On, opts: Options): void => {
  options = opts

  on('command.run', { command: 'construct' }, async ($, e) => {
    // `/construct open` opens the panel, or brings it forward from behind another tab, without toggling it.
    if ((e.args ?? '').trim() === 'open') {
      const at = await $.clock.now()
      await update($, now, () => at)
      await $.ui.open({ id: PANE, title: S.pane })
      return { text: S.opened }
    }
    const isOpen = await togglePane($)
    return { text: isOpen ? S.opened : S.closed }
  })

  on('tool.call', { tool: TOOL }, async ($, e) => {
    // The flow is the main session's: a call from a worker's loop carries its agentId
    // and changes nothing, or any subagent could rename, finish or reset the flow.
    if (e.agentId) return { result: 'ignored: only the main session reports the flow' }
    const input = e as unknown as ProgressInput
    const prev = await read($, flow)
    if (isNewFlow(prev, input) && input.title !== undefined) {
      // A new flow starts with a clean list; agents still running stay.
      await update($, agents, list => list.filter(a => a.status === 'running'))
    }
    const next = await update($, flow, p => merge(p, input))
    if (next && input.tasks?.length) await autoOpen($, next.title)
    return { result: `ok: ${label(next ?? blank())}` }
  })

  // A worker's own progress: the call runs in the worker's loop, so agentId names it.
  on('tool.call', { tool: STEP_TOOL }, async ($, e) => {
    const input = e as unknown as { done?: number; total?: number; note?: string }
    const agentId = e.agentId
    if (!agentId) return { result: 'ignored: only subagents report steps' }
    let matched = false
    await update($, agents, list =>
      list.map(a => {
        if (a.agentId !== agentId) return a
        matched = true
        const total = Math.max(0, Math.round(input.total ?? a.stepTotal ?? 0))
        const done = Math.max(0, Math.round(input.done ?? a.stepDone ?? 0))
        return { ...a, stepTotal: total, stepDone: total ? Math.min(total, done) : done, stepNote: input.note?.trim() || undefined }
      }),
    )
    return { result: matched ? 'ok' : `ignored: no panel row for agent ${agentId}` }
  })

  // Safety net: worker launches move the faint layer even if the orchestrator forgets to report.
  on('tool.call', { tool: 'Agent' }, async ($, e, next) => {
    const type = String(e.subagent_type ?? '')
    if (!isCrew(type)) return next(e)

    await update($, flow, prev => {
      const base = prev && !prev.isFinished ? { ...blank(), ...prev } : blank()
      return { ...base, running: base.running + 1, phase: base.phase === 'plan' ? 'delegate' : base.phase }
    })
    try {
      return await next(e)
    } finally {
      await update($, flow, prev => (prev ? { ...prev, running: Math.max(0, prev.running - 1) } : prev))
    }
  })

  on('agent.spawn', async ($, e, next) => {
    const isUnbriefed = isCrew(e.subagentType) && !e.prompt.includes(STEP_TOOL)
    const started = await next(isUnbriefed ? { ...e, prompt: e.prompt + STEP_BRIEF } : e)
    if (started.deny !== undefined) return started

    const at = await $.clock.now()
    await update($, agents, list => {
      const round = 1 + list.filter(a => norm(a.description) === norm(e.description) && e.description).length
      const run: AgentRun = {
        id: started.agentId ?? e.tool_use_id,
        agentId: started.agentId,
        type: e.subagentType,
        description: e.description,
        model: started.model,
        status: 'running',
        startedAt: at,
        contextTokens: 0,
        contextMax: windowOf(started.model),
        tokens: 0,
        costUsd: 0,
        steps: 0,
        round,
      }
      return [...list.filter(a => a.id !== run.id), run].slice(-200)
    })
    await update($, now, () => at)
    if (isCrew(e.subagentType)) {
      const f = await read($, flow)
      await autoOpen($, f && !f.isFinished ? f.title : 'red-pill')
    } else if (options.autoOpen === 'any') {
      await autoOpen($, 'any-agent')
    }
    return started
  })

  // Each model request of a subagent: live context, tokens and cost.

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const ui = $.ui.resolve(e)
    const { Box, Text, Button } = ui
    const list = await read($, agents)
    const f = await read($, flow)
    const p: Panel = await read($, panel)
    const at = Math.max(await read($, now), ...list.map(a => a.startedAt), 0)
    const t = totals(list, at)
    const tiles = metricTiles(await read($, metrics), t, list.filter(a => a.status === 'running').length, await $.clock.now())

    const running = list.filter(a => a.status === 'running').reverse()
    const finished = list.filter(a => a.status !== 'running').reverse()
    const planned = plannedOf(f, list)
    // The pane's title says "The Construct"; inside, only the flow's own name.
    const title = f && !f.isFinished ? f.title : ''

    const toggleCompact = (
      <Button
        key="compact"
        label={p.isCompact ? S.expand : S.collapse}
        plain
        onPress={() => update($, panel, prev => ({ ...prev, isCompact: !prev.isCompact }))}
      />
    )
    const toggleDone = (
      <Button
        key="done"
        label={`${p.isDoneCollapsed ? '▸' : '▾'} ${S.finished} · ${finished.length}`}
        plain
        onPress={() => update($, panel, prev => ({ ...prev, isDoneCollapsed: !prev.isDoneCollapsed }))}
      />
    )
    const isEmpty = list.length === 0 && planned.length === 0
    const summary = `≈${fmtCost(t.cost)}, ${fmtTokens(t.tokens)} ${S.tokensWord}, ${fmtTime(t.time)}`

    if (e.surface === 'desktop' && 'Svg' in ui) {
      const { Svg } = ui
      const W = Math.max(240, Math.min(900, (e.props.bodyColumns || 40) * 8 - 8))
      const section = (key: string, text: string) => (
        <Text key={key} dimColor>
          {text}
        </Text>
      )

      if (p.isCompact) {
        return (
          <Box flexDirection="column" gap={1}>
            <Svg source={compactSvg(W, list, planned, t)} alt={`${list.length} ${S.agentsCount}, ${summary}`} width={W} height={32} />
            {toggleCompact}
          </Box>
        )
      }
      const shownDone = p.isDoneCollapsed ? 0 : finished.length
      const lines = 1 + (isEmpty ? 1 : 0) + (running.length > 0 ? 1 : 0) + (finished.length > 0 ? 1 : 0) + (planned.length > 0 ? 1 : 0)
      const gridH = headerHeight(title) + metricsHeight(W, tiles.length) + lines * LINE_H + (running.length + shownDone) * 66 + planned.length * 46
      return (
        <Box flexDirection="column">
          {/* The grid sizes the pane; the content is placed over it, as an
              absolute Box paints over the siblings before it. */}
          {gridTiles(gridH).map((tileH, i) => (
            <Svg key={`grid-${i}`} source={gridSvg(W, tileH)} alt="dotted grid" width={W} height={tileH} />
          ))}
          <Box flexDirection="column" position="absolute" top={0} left={0} right={0}>
            {title && <Svg source={headerSvg(W, title)} alt={title} width={W} height={headerHeight(title)} />}
            <Svg source={metricsSvg(W, tiles)} alt={tiles.map(m => `${m.label} ${m.value}`).join(', ')} width={W} height={metricsHeight(W, tiles.length)} />
            {toggleCompact}
            {isEmpty && <Text dimColor>{S.empty}</Text>}
            {running.length > 0 && section('h-run', `${S.running} · ${running.length}`)}
            {running.map(a => (
              <Svg key={a.id} source={agentSvg(W, a, at)} alt={`${a.description}: ${modelName(a.model)}, ${S.isRunning}`} width={W} height={66} />
            ))}
            {finished.length > 0 && toggleDone}
            {!p.isDoneCollapsed &&
              finished.map(a => (
                <Svg key={a.id} source={agentSvg(W, a, at)} alt={`${a.description}: ${modelName(a.model)}, ${S.isFinished}`} width={W} height={66} />
              ))}
            {planned.length > 0 && section('h-plan', `${S.planned} · ${planned.length}`)}
            {planned.map(pl => (
              <Svg key={`plan-${pl.n}`} source={plannedSvg(W, pl)} alt={`${pl.n}. ${pl.title}: ${S.isPlanned}`} width={W} height={46} />
            ))}
          </Box>
        </Box>
      )
    }

    // Terminal: the same content in text rows.
    const cols = Math.max(24, e.props.bodyColumns || 40)
    const barW = Math.max(6, Math.min(20, cols - 34))
    const row = (a: AgentRun) => {
      const tier = characterOf(a.type)
      const color = colorOf(tier)
      const ctx = ctxOf(a)
      const progress = progressOf(a)
      const model = runModel(a)
      const steps = a.stepTotal ? `${a.stepDone ?? 0}/${a.stepTotal}${a.stepNote ? ' ' + a.stepNote : ''} · ` : ''
      return (
        <Box key={a.id} flexDirection="column" marginBottom={1}>
          <Box flexDirection="row" gap={1}>
            <Text color={badgeOf(tier).color}>{badgeOf(tier).letter}</Text>
            <Text bold wrap="truncate-end">
              {a.description || a.type}
            </Text>
            <Text color={a.status === 'failed' ? 'red' : a.status === 'done' ? 'green' : color}>{STATUS_GLYPH[a.status]}</Text>
          </Box>
          <Text dimColor wrap="truncate-end">
            {'  '}
            {tierWord(tier)} · {model}
            {a.round > 1 ? ` · ${S.round} ${a.round}` : ''}
          </Text>
          <Text wrap="truncate-end">
            {'  '}
            {progress === null ? <Text dimColor>{ctxBar(ctx, barW)}</Text> : <Text color={color}>{ctxBar(progress * 100, barW)}</Text>}
            <Text dimColor>
              {' '}
              {steps}{S.ctx} {ctx}% · {fmtTokens(a.contextTokens)} ≈{fmtCost(a.costUsd)} {fmtTime(elapsed(a, at))}
            </Text>
          </Text>
        </Box>
      )
    }

    return (
      <Box flexDirection="column">
        <Box flexDirection="row" justifyContent="space-between">
          <Text bold wrap="truncate-end">
            {title}
          </Text>
          {toggleCompact}
        </Box>
        {tiles.map(m => (
          <Text key={`m-${m.label}`} dimColor={!m.isAlert} color={m.isAlert ? PALETTE.alert : undefined} wrap="truncate-end">
            {`${m.label} ${m.value}`}
          </Text>
        ))}
        {p.isCompact ? (
          <Text wrap="truncate-end">
            {[...running, ...finished].map(a => (
              <Text key={a.id} color={colorOf(characterOf(a.type))}>
                {STATUS_GLYPH[a.status]}{' '}
              </Text>
            ))}
            {planned.map(pl => (
              <Text key={`plan-${pl.n}`} dimColor>
                ◷{' '}
              </Text>
            ))}
          </Text>
        ) : (
          <Box flexDirection="column" marginTop={1}>
            {isEmpty && <Text dimColor>{S.empty}</Text>}
            {running.length > 0 && <Text dimColor>{S.running} · {running.length}</Text>}
            {running.map(row)}
            {finished.length > 0 && toggleDone}
            {!p.isDoneCollapsed && finished.map(row)}
            {planned.length > 0 && <Text dimColor>{S.planned} · {planned.length}</Text>}
            {planned.map(pl => {
              const tier = pl.tier in CHARACTER_COLOR ? pl.tier : 'smith'
              return (
                <Box key={`plan-${pl.n}`} flexDirection="column" marginBottom={1}>
                  <Text dimColor wrap="truncate-end">
                    <Text color={badgeOf(tier as Character).color}>{badgeOf(tier as Character).letter}</Text> {pl.n}. {pl.title} ◷
                  </Text>
                  <Text dimColor wrap="truncate-end">
                    {'  '}
                    {tierWord(tier)} · {tierModel(tier)}
                    {pl.after.length ? ` · ${S.after} ${pl.after.join(', ')}` : ''}
                  </Text>
                </Box>
              )
            })}
          </Box>
        )}
      </Box>
    )
  })

}

export async function constructSessionStart($: HookArgs<'session.start'>[0], e: HookArgs<'session.start'>[1], next: Then<'session.start'>) {
  const started = await next(e)
  await $.tool.register({
    name: 'progress',
    description:
      'Report /red-pill progress to the progress bar above the prompt and the agents panel. ' +
      'Call it after presenting the plan (title, total, tasks, phase "delegate"), each time a task is accepted (done), ' +
      'when switching phase or re-planning (tasks), and once at the end with finished: true. Fields left out keep their previous value. ' +
      'For the main session only: a call from a subagent is ignored (workers report with `step`).',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short name of the overall task, a few words.' },
        total: { type: 'integer', minimum: 0, description: 'Number of planned worker tasks.' },
        done: { type: 'integer', minimum: 0, description: 'Number of tasks accepted after review.' },
        phase: { type: 'string', enum: [...PHASES] },
        finished: { type: 'boolean', description: 'True once the flow is closed.' },
        tasks: {
          type: 'array',
          description:
            'The planned worker tasks in order, numbered from 1. Each title must equal the Agent tool `description` the task will be delegated with, so the panel can match runs to tasks.',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'A few words; reused verbatim as the Agent description.' },
              tier: { type: 'string', enum: [...TIERS] },
              after: { type: 'array', items: { type: 'integer' }, description: 'Numbers of the tasks this one waits for.' },
            },
            required: ['title', 'tier'],
          },
        },
      },
    },
  })
  await $.tool.register({
    name: 'step',
    description:
      'For red-pill crew workers: report progress on your own task to the agents panel. ' +
      'Right after reading the brief, call it with `total` (your plan in 3-8 steps) and `done: 0`; ' +
      'call it again as each step finishes. Cheap and silent: it only draws a bar.',
    inputSchema: {
      type: 'object',
      properties: {
        done: { type: 'integer', minimum: 0, description: 'Steps finished so far.' },
        total: { type: 'integer', minimum: 1, description: 'Steps planned; may change if the plan changes.' },
        note: { type: 'string', description: 'The step in progress, a few words.' },
      },
      required: ['done'],
    },
    // In every agent's tool list, not behind ToolSearch: workers do not go looking for it.
    isDeferred: false,
  })
  await $.command.register({
    name: 'construct',
    description: 'Show or hide the panel of subagents: running, finished and planned, with model, context, cost and time',
  })

  // Ticks the running agents' clocks and the session clock; quiet when nothing runs and the panel is closed.
  $.clock.every(1000, () => {
    void (async () => {
      const list = await read($, agents)
      if (!list.some(a => a.status === 'running') && !(await $.ui.panes()).some(p => p.id === PANE)) return
      const at = await $.clock.now()
      await update($, now, () => at)
    })()
  })
  return started
}

export async function* constructTurnStep($: HookArgs<'turn.step'>[0], e: HookArgs<'turn.step'>[1], next: Then<'turn.step'>) {
  const result = yield* next(e)
  const agentId = e.agentId
  const usage = result.usage
  if (!agentId || !usage) return result

  const model = usage.model || e.model
  await update($, agents, list =>
    list.map((a): AgentRun =>
      a.agentId !== agentId
        ? a
        : {
            ...a,
            model,
            effort: typeof e.effort === 'string' ? e.effort : a.effort,
            status: 'running',
            endedAt: undefined,
            contextTokens:
              (usage.input_tokens || 0) +
              (usage.cache_read_input_tokens || 0) +
              (usage.cache_creation_input_tokens || 0) +
              (usage.output_tokens || 0),
            contextMax: windowOf(model),
            tokens:
              a.tokens +
              (usage.input_tokens || 0) +
              (usage.output_tokens || 0) +
              (usage.cache_read_input_tokens || 0) +
              (usage.cache_creation_input_tokens || 0),
            costUsd: a.costUsd + costOf(model, usage, true),
            steps: a.steps + 1,
          },
    ),
  )
  return result
}

export async function constructTurnComplete($: HookArgs<'turn.complete'>[0], e: HookArgs<'turn.complete'>[1], next: Then<'turn.complete'>) {
  const agentId = e.agentId
  if (agentId) {
    const at = await $.clock.now()
    await update($, agents, list =>
      list.map((a): AgentRun => {
        if (a.agentId !== agentId) return a
        // A run whose steps went unseen still gets the turn's own sum.
        const fallback = a.steps === 0 && e.usage
        return {
          ...a,
          status: e.reason === 'answer' ? 'done' : 'failed',
          endedAt: at,
          ...(fallback && e.usage
            ? {
                model: e.usage.model || a.model,
                tokens:
                  e.usage.input_tokens +
                  e.usage.output_tokens +
                  e.usage.cache_read_input_tokens +
                  e.usage.cache_creation_input_tokens,
                costUsd: costOf(e.usage.model || a.model, e.usage, false),
              }
            : {}),
        }
      }),
    )
    await update($, now, () => at)
  }
  return next(e)
}

export async function constructAbovePrompt($: HookArgs<'ui.render'>[0], e: AbovePromptInput, next: Then<'ui.render', AbovePromptInput>) {
  const f = await read($, flow)
  if (f === null || e.props.hasSurvey) return next(e)
  // Draw this row with the other mods' bands beneath it. Claude Code's own placeholder ({ type: 'engine' }) is
  // never nested: the desktop drops a band that nests it.
  const drawn = await Promise.resolve(next(e)).catch(() => null)
  const below = drawn && typeof drawn === 'object' && (drawn as { type?: string }).type !== 'engine' ? drawn : null

  const ui = $.ui.resolve(e)
  const { Box, Text, Button } = ui
  const list = await read($, agents)
  const crew = list.length + plannedOf(f, list).length
  const isWorking = list.some(a => a.status === 'running')
  const crewButton = (
    <Button key="matrix-construct" label={`×${crew}`} plain onPress={() => void togglePane($)} />
  )
  const percent = `${Math.round(ratio(f) * 100)}%`
  const dismiss = (
    <Button
      key="matrix-dismiss"
      label="✕"
      plain
      role="dismiss"
      onPress={() => update($, flow, () => null)}
    />
  )

  // The terminal's element table is completed with an `Svg` that draws nothing: test the surface too.
  if (e.surface !== 'terminal' && 'Svg' in ui) {
    const { Svg } = ui
    // About 8 CSS px per reported column; the rest is the count, the dismiss
    // and their gaps. No floor above the slot: a row wider than it would wrap.
    const width = Math.max(180, Math.min(1600, (e.props.bodyColumns || 100) * 8 - 96))
    return (
      <Box flexDirection="column">
        <Box flexDirection="row" alignItems="center" gap={1}>
          <Svg source={rowSvg(f, width, isWorking)} alt={`${f.title}: ${label(f)}, ${percent}`} width={width} height={H} />
          {crewButton}
          {dismiss}
        </Box>
        {below}
      </Box>
    )
  }

  const cols = e.props.bodyColumns
  const titleW = Math.max(8, Math.min(30, f.title.length + 2, Math.floor(cols / 3)))
  const width = Math.max(6, Math.min(40, cols - titleW - 32))
  return (
    <Box flexDirection="column">
      <Box flexDirection="row" gap={2}>
        <Box width={titleW} flexShrink={0}>
          <Text color={f.isFinished ? PALETTE.done : PALETTE.green}>● </Text>
          <Text wrap="truncate-end">{f.title}</Text>
        </Box>
        <Text color={f.isFinished ? PALETTE.done : PALETTE.green}>{barText(f, width)}</Text>
        <Text bold color={f.isFinished ? PALETTE.done : undefined}>{label(f)}</Text>
        <Text dimColor>{percent}</Text>
        <Text color={badgeOf('mouse').color}>{badgeOf('mouse').letter}</Text>
        {crewButton}
        {dismiss}
      </Box>
      {below}
    </Box>
  )
}
