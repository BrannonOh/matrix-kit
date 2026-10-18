import { atom, read, update } from 'claude-code'
import type { EngineInterface, On } from 'claude-code'
import type { HookArgs, Options } from './lib/shared.ts'

import type { Cache } from '../types/index.d.ts'
import { fmtTokens, modelName } from './lib/format.ts'
import { addSplit, emptyMetrics, mergeContext, roomLeft, splitOf } from './lib/metrics.ts'
import type { Metrics } from './lib/metrics.ts'
import { cacheSavingsOf } from './lib/prices.ts'
import { stripItems } from './lib/strip.ts'
import type { StripItem } from './lib/strip.ts'
import { PALETTE } from './lib/theme.ts'

// Responses shorter than this are mostly tool-call stubs: their timing is noise.
const MIN_TOKENS = 20
// A response that arrived in one burst cannot be timed; such readings are dropped.
const MIN_SECONDS = 0.5
const MAX_SPEED = 1000

const CACHE_TTL_MS = 60 * 60 * 1000
const CACHE_WARN_S = 20 * 60
const CACHE_ALERT_S = 10 * 60
// Minutes left at which the cache expiry is announced, once each per answer.
const CACHE_NOTIFY_MINUTES = [10, 5] as const

const SPEED = PALETTE.green
const MONEY = PALETTE.done
const MUTED = '#5A7A62'
const CONTEXT = PALETTE.green2
const CACHE = PALETTE.green2

// Everything the strip and The Construct show about the session.
export const metrics = atom({ plugin: 'matrix-kit', key: 'metrics' } as const, emptyMetrics() as Metrics)

const cache = atom({ plugin: 'matrix-kit', key: 'cache' } as const, {
  expiresAt: null,
  secondsLeft: null,
} as Cache)

// Closed with ×: stays hidden for the rest of the session.
const isHidden = atom({ plugin: 'matrix-kit', key: 'isHidden' } as const, false)

// A turn is running: the cache stays warm, so no countdown warnings.
const isBusy = atom({ plugin: 'matrix-kit', key: 'isBusy' } as const, false)

// The smallest CACHE_NOTIFY_MINUTES already announced since the last answer; 0 none.
const warned = atom({ plugin: 'matrix-kit', key: 'warned' } as const, 0)

const ring = (color: string, glyph: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
    <circle cx="12" cy="12" r="10" fill="none" stroke="${color}" stroke-width="2"/>
    ${glyph}</svg>`

const SPEED_ICON = ring(
  SPEED,
  `<path d="M6.5 15a6 6 0 0 1 11 0" fill="none" stroke="${SPEED}" stroke-width="1.8" stroke-linecap="round"/>
   <path d="M12 15l3-4" stroke="${SPEED}" stroke-width="1.8" stroke-linecap="round"/>`,
)

const MONEY_ICON = ring(
  MONEY,
  `<text x="12" y="16.5" text-anchor="middle" font-family="-apple-system,sans-serif" font-size="13" font-weight="600" fill="${MONEY}">$</text>`,
)

// The ring itself fills with the context, around a page of lines.
const contextIcon = (percent: number) => {
  const c = 2 * Math.PI * 10
  const filled = (Math.min(100, percent) / 100) * c
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
    <circle cx="12" cy="12" r="10" fill="none" stroke="${MUTED}" stroke-opacity="0.35" stroke-width="2"/>
    <circle cx="12" cy="12" r="10" fill="none" stroke="${CONTEXT}" stroke-width="2" stroke-linecap="round"
      stroke-dasharray="${filled.toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 12 12)"/>
    <g stroke="${CONTEXT}" stroke-width="1.6" stroke-linecap="round">
      <path d="M8.5 9h7M8.5 12h7M8.5 15h4.5"/>
    </g></svg>`
}

// An hourglass: the prompt cache running out.
const cacheIcon = (color: string) =>
  ring(
    color,
    `<g fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">
       <path d="M8.5 6.5h7M8.5 17.5h7"/>
       <path d="M9.5 6.5c0 3 5 3.5 5 5.5s-5 2.5-5 5.5M14.5 6.5c0 3-5 3.5-5 5.5s5 2.5 5 5.5"/>
     </g>`,
  )

const pad = (n: number) => String(n).padStart(2, '0')

const contextBar = (percent: number) => {
  const color = percent >= 85 ? PALETTE.alert : percent >= 65 ? PALETTE.warn : MONEY
  const w = Math.round((Math.min(100, percent) / 100) * 80)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 6" width="80" height="6">
    <rect width="80" height="6" rx="3" fill="${MUTED}" fill-opacity="0.3"/>
    <rect width="${w}" height="6" rx="3" fill="${color}"/></svg>`
}

const usd = (n: number) => `$${n.toFixed(2)}`

// Last measured width, for `/operator width` while tuning lib/strip.ts; debug only.
let lastColumns: number | null = null

async function refresh($: EngineInterface) {
  const { cost, context, startedAt } = await $.session.usage()
  await update($, metrics, m => {
    const costUsd = cost?.usd ?? m.costUsd
    return { ...m, costUsd, turnCostUsd: costUsd - m.costAtStart, context: mergeContext(m.context, context), startedAt }
  })
}

// Claude Code's own notification, which also reaches the phone over Remote Control;
// it is skipped while the person is at this session, and then a toast says it instead.
async function notifyCacheExpiry($: EngineInterface, minutes: number) {
  const project = (await $.session.cwd()).split(/[\\/]/).filter(Boolean).pop() ?? 'session'
  const message = `Wake up — prompt cache expires in ${minutes} min`

  const text = `${project}: ${message}`
  const sent = await $.tool
    .call({ tool: 'PushNotification', message: text, status: 'proactive' })
    .catch(() => null)
  const isDelivered =
    sent !== null &&
    sent.deny === undefined &&
    sent.isError !== true &&
    (sent.result.pushSent === true || sent.result.localSent === true)

  if (!isDelivered) $.ui.toast(`⏳ ${text}`, { timeoutMs: 30000 })
}

export const registerOperator = (on: On): void => {

  on('command.run', { command: 'operator' }, async ($, e) => {
    // `/operator json` prints what has been collected, for tests and debugging.
    if (e.args.trim() === 'json') return { text: JSON.stringify(await read($, metrics)) }

    // `/operator demo <minutes>` fakes the cache deadline to preview the warnings;
    // the next answer resets it.
    const demo = e.args.trim().match(/^demo\s+(\d+(?:\.\d+)?)$/)
    if (demo) {
      const seconds = Math.round(Number(demo[1]) * 60)
      const now = await $.clock.now()
      await update($, cache, () => ({ expiresAt: now + seconds * 1000, secondsLeft: seconds }))
      await update($, warned, () => 0)
      await update($, isHidden, () => false)

      return { text: `Cache demo: ${demo[1]} min left until the next answer resets it.` }
    }

    if (e.args.trim() === 'width') {
      const columns = lastColumns
      return { text: columns === null ? 'Strip not drawn yet.' : `Strip: ${columns} columns: ${stripItems(columns, true).join(', ')}.` }
    }

    const hidden = !(await read($, isHidden))
    await update($, isHidden, () => hidden)

    return { text: hidden ? 'Operator strip hidden.' : 'Operator strip shown.' }
  })

  on('turn.start', async ($, e, next) => {
    const total = (await $.session.usage()).cost?.usd ?? 0
    await update($, metrics, m => ({ ...m, turn: m.turn + 1, costAtStart: total, costUsd: total, tools: { ...m.tools, turn: 0, turnErrors: 0 } }))
    await update($, isBusy, () => true)

    return next(e)
  })

  // Every tool call of the session, workers' included; an Agent call also brings its lines changed.
  on('tool.call', async ($, e, next) => {
    const result = await next(e)
    const isError = result.isError === true
    const lines = e.tool === 'Agent' ? (result.result as { toolStats?: { linesAdded?: number; linesRemoved?: number } } | undefined)?.toolStats : undefined
    await update($, metrics, m => ({
      ...m,
      tools: {
        turn: m.tools.turn + 1,
        session: m.tools.session + 1,
        turnErrors: m.tools.turnErrors + (isError ? 1 : 0),
        sessionErrors: m.tools.sessionErrors + (isError ? 1 : 0),
      },
      linesAdded: m.linesAdded + (lines?.linesAdded ?? 0),
      linesRemoved: m.linesRemoved + (lines?.linesRemoved ?? 0),
    }))
    return result
  })

  // Context, plan limits and cost as the engine measures them, after each main turn and as limits move.
  on('session.measure', async ($, e, next) => {
    await update($, metrics, m => ({
      ...m,
      context: mergeContext(m.context, e.context),
      rateLimits: e.rateLimits.map(r => ({ kind: r.kind, percentUsed: r.percentUsed, resetsAt: r.resetsAt })),
      costUsd: e.cost?.usd ?? m.costUsd,
    }))
    return next(e)
  })

}

export async function operatorSessionStart($: HookArgs<'session.start'>[0], e: HookArgs<'session.start'>[1], next: HookArgs<'session.start'>[2]) {
  const result = await next(e)

  await $.command.register({
    name: 'operator',
    description: 'Show or hide the operator metrics strip; `demo <minutes>` previews the cache warning',
  })

  $.clock.every(1000, async () => {
    const expiresAt = (await read($, cache)).expiresAt
    if (expiresAt === null) return

    const left = Math.max(0, Math.floor((expiresAt - (await $.clock.now())) / 1000))
    if (left !== (await read($, cache)).secondsLeft) {
      await update($, cache, c => ({ expiresAt: c.expiresAt ?? expiresAt, secondsLeft: left }))
    }

    const due = CACHE_NOTIFY_MINUTES.filter(m => left > 0 && left <= m * 60)
    if (due.length === 0 || (await read($, isBusy))) return

    const minutes = Math.min(...due)
    const last = await read($, warned)
    if (last !== 0 && last <= minutes) return

    await update($, warned, () => minutes)
    await notifyCacheExpiry($, Math.ceil(left / 60))
  })

  return result
}

// Each model request: the main thread's model, effort, time to first token and speed;
// every request's cache savings. The stream's own result is passed on unchanged.
export async function* operatorTurnStep($: HookArgs<'turn.step'>[0], e: HookArgs<'turn.step'>[1], next: HookArgs<'turn.step'>[2]) {
  const isMain = e.agentId === undefined
  const hookAt = await $.clock.now()
  if (isMain) await update($, metrics, m => ({ ...m, model: e.model || m.model, effort: e.effort === undefined ? m.effort : String(e.effort) }))

  // Speed is timed from the response's first item (its envelope, message_start), so
  // time to first token is left out but thinking that streams hidden or in one late
  // burst is still timed: output_tokens counts it.
  let startedAt: number | null = null
  let isAnswering = false
  const stream = next(e)
  for (let item = await stream.next(); ; item = await stream.next()) {
    if (item.done) {
      const usage = item.value?.usage
      if (usage) {
        const saved = cacheSavingsOf(usage.model || e.model, usage)
        await update($, metrics, m => ({ ...m, cacheSavingsUsd: m.cacheSavingsUsd + saved }))
      }
      if (isMain) await refresh($)
      return item.value
    }
    const chunk = item.value
    if (isMain) {
      const at = await $.clock.now()
      if (startedAt === null) startedAt = at
      if (!isAnswering && e.index === 0 && (chunk.kind === 'text' || chunk.kind === 'thinking' || chunk.kind === 'tool')) {
        isAnswering = true
        await update($, metrics, m => ({ ...m, ttftMs: at - hookAt }))
      }
      if (chunk.kind === 'stop' && chunk.usage !== null) {
        const tokens = chunk.usage.output_tokens
        const seconds = (at - startedAt) / 1000
        const speed = tokens / seconds
        if (tokens >= MIN_TOKENS && seconds >= MIN_SECONDS && speed <= MAX_SPEED) {
          await update($, metrics, m => ({ ...m, speed: Math.round(speed) }))
        }
      }
    }
    yield chunk
  }
}

export async function operatorTurnComplete($: HookArgs<'turn.complete'>[0], e: HookArgs<'turn.complete'>[1], next: HookArgs<'turn.complete'>[2]) {
  const result = await next(e)

  if (e.agentId === undefined) {
    const turn = splitOf(e.usage)
    await update($, metrics, m => ({ ...m, turnMs: e.durationMs ?? m.turnMs, lastTurn: turn ?? m.lastTurn, session: addSplit(m.session, turn) }))
    const now = await $.clock.now()
    await update($, cache, () => ({ expiresAt: now + CACHE_TTL_MS, secondsLeft: CACHE_TTL_MS / 1000 }))
    await update($, isBusy, () => false)
    await update($, warned, () => 0)
  }
  await refresh($)

  return result
}

// Plan-limit windows by the short names the strip uses.
const LIMIT_NAME: Record<string, string> = { five_hour: '5h', seven_day: '7d', spend_limit: 'spend' }

export async function operatorAbovePrompt($: HookArgs<'ui.render'>[0], e: HookArgs<'ui.render'>[1], next: HookArgs<'ui.render'>[2]) {
  const m = await read($, metrics)
  if (e.props.hasSurvey || m.turn === 0 || (await read($, isHidden))) return next(e)

  const ui = $.ui.resolve(e)
  const { Box, Button, Text } = ui
  const Svg = e.surface !== 'terminal' && 'Svg' in ui ? ui.Svg : null

  const { secondsLeft } = await read($, cache)
  const level =
    e.props.isWorking || secondsLeft === null
      ? null
      : secondsLeft <= CACHE_ALERT_S
        ? PALETTE.alert
        : secondsLeft <= CACHE_WARN_S
          ? PALETTE.warn
          : null
  const cacheText =
    e.props.isWorking ? '…'
    : secondsLeft === null ? '—'
    : secondsLeft === 0 ? 'expired'
    : `${pad(Math.floor(secondsLeft / 60))}:${pad(secondsLeft % 60)}`

  lastColumns = e.props.bodyColumns
  const items = stripItems(e.props.bodyColumns, m.rateLimits.length > 0)
  const percent = m.context.percent ?? 0
  const limits = m.rateLimits.map(r => `${LIMIT_NAME[r.kind] ?? r.kind} ${Math.round(r.percentUsed)}%`).join(' · ')
  const worst = Math.round(Math.max(0, ...m.rateLimits.map(r => r.percentUsed)))
  const room = roomLeft(m.context)
  const ICON = 18

  // One strip item: an icon on the desktop or a glyph in the terminal, then its value.
  const item = (key: string, icon: string | null, glyph: string, color: string, text: string, textColor?: string) => (
    <Box key={key} flexDirection="row" alignItems="center" columnGap={1} flexShrink={0}>
      {Svg && icon ? <Svg source={icon} alt={key} width={ICON} height={ICON} /> : <Text color={color}>{glyph}</Text>}
      <Text bold color={textColor}>{text}</Text>
    </Box>
  )
  const drawn: Record<StripItem, () => unknown> = {
    speed: () => item('speed', SPEED_ICON, '»', SPEED, `${m.speed ?? '—'} tok/s`),
    turnCost: () => item('turnCost', MONEY_ICON, '$', MONEY, m.turnCostUsd === null ? '—' : usd(m.turnCostUsd), MONEY),
    sessionCost: () => <Text key="sessionCost" bold>{`| ${usd(m.costUsd)}`}</Text>,
    cache: () => item('cache', cacheIcon(level ?? CACHE), '⧗', level ?? CACHE, cacheText, level ?? undefined),
    context: () => (
      <Box key="context" flexDirection="row" alignItems="center" columnGap={1} flexShrink={0}>
        {Svg ? <Svg source={contextIcon(percent)} alt="context" width={ICON} height={ICON} /> : <Text color={CONTEXT}>◔</Text>}
        {Svg && items.includes('room') ? <Svg source={contextBar(percent)} alt={`context ${percent}%`} width={80} height={6} /> : null}
        <Text bold>{`${percent}%`}</Text>
      </Box>
    ),
    limits: () => item('limits', null, '▤', MUTED, limits),
    limitsCombined: () => item('limitsCombined', null, '▤', MUTED, `limit ${worst}%`),
    model: () => item('model', null, '◆', SPEED, m.model ? `${modelName(m.model)}${m.effort ? ` · ${m.effort}` : ''}` : '—'),
    room: () => (room === null ? null : item('room', null, '↧', MUTED, `${fmtTokens(room)} left`)),
  }

  return (
    <Box
      key="operator"
      flexDirection="row"
      alignItems="center"
      columnGap={2}
      flexWrap="nowrap"
      overflow="hidden"
      paddingX={1}
      {...(level ? { borderStyle: 'round', borderColor: level } : {})}
    >
      {items.map(k => drawn[k]())}
      <Box flexGrow={1} flexShrink={1} />
      <Button key="hide" label="×" role="dismiss" plain dimColor onPress={() => update($, isHidden, () => true)} />
    </Box>
  )
}
