export type StepStatus = 'pending' | 'in_progress' | 'completed'
export type Step = { id: string; content: string; status: StepStatus }
/** The session's task list, mirrored for the band (hooks/lib/plan.ts). */
export type Plan = { steps: Step[] }

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
  /** Self-reported by the subagent through the `step` tool. */
  stepDone?: number
  stepTotal?: number
  stepNote?: string
}

export type Panel = {
  isCompact: boolean
  isDoneCollapsed: boolean
  /** Opened by itself this prompt: it opens once per prompt. */
  isAutoOpened: boolean
}

export type Cache = {
  expiresAt: number | null
  secondsLeft: number | null
}

export type TokenSplit = { input: number; output: number; cacheRead: number; cacheWrite: number }

// resetsAt is the engine's ISO time, null when it sent none.
export type RateLimit = { kind: string; percentUsed: number; resetsAt: string | null }

export type Metrics = {
  turn: number
  model: string | null
  effort: string | null
  speed: number | null
  ttftMs: number | null
  turnMs: number | null
  // null until the engine reports a cost (some hosts keep no cost ledger).
  costUsd: number | null
  turnCostUsd: number | null
  // The session cost when the prompt began; null before any prompt, or when none was reported then.
  costAtStart: number | null
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
      plan: Plan | null
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
