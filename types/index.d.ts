export type Phase = 'plan' | 'design' | 'delegate' | 'review' | 'close'

export type PlannedTask = {
  title: string
  tier: string
  after: number[]
}

export type Flow = {
  title: string
  total: number
  done: number
  running: number
  phase: Phase
  isFinished: boolean
  tasks: PlannedTask[]
}

export type AgentStatus = 'running' | 'done' | 'failed'

export type AgentRun = {
  id: string
  agentId?: string
  type: string
  description: string
  model: string
  effort?: string
  status: AgentStatus
  startedAt: number
  endedAt?: number
  contextTokens: number
  contextMax: number
  tokens: number
  costUsd: number
  steps: number
  round: number
  /** Self-reported by the worker through the `step` tool. */
  stepDone?: number
  stepTotal?: number
  stepNote?: string
}

export type Panel = {
  isCompact: boolean
  isDoneCollapsed: boolean
  autoOpenedFor: string
}

export type Cache = {
  expiresAt: number | null
  secondsLeft: number | null
}

export type TokenSplit = { input: number; output: number; cacheRead: number; cacheWrite: number }

export type RateLimit = { kind: string; percentUsed: number; resetsAt: number }

export type Metrics = {
  turn: number
  model: string | null
  effort: string | null
  speed: number | null
  ttftMs: number | null
  turnMs: number | null
  costUsd: number
  turnCostUsd: number | null
  costAtStart: number
  lastTurn: TokenSplit | null
  session: TokenSplit
  cacheSavingsUsd: number
  tools: { turn: number; session: number; turnErrors: number; sessionErrors: number }
  linesAdded: number
  linesRemoved: number
  rateLimits: RateLimit[]
  context: { tokens: number | null; window: number | null; percent: number | null }
  startedAt: number | null
}

declare module 'claude-code' {
  interface PluginState {
    'matrix-kit': {
      flow: Flow | null
      agents: AgentRun[]
      panel: Panel
      now: number
      metrics: Metrics
      cache: Cache
      isHidden: boolean
      isBusy: boolean
      warned: number
    }
  }
}
