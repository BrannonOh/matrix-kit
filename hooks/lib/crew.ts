// The crew: the five /red-pill workers, plus who plays every other subagent.

export type Tier = 'neo' | 'morpheus' | 'trinity' | 'tank' | 'mouse'
export type Character = Tier | 'oracle' | 'smith'

// Hardest first; the progress tool's `tier` enum and the playbook use this order.
export const TIERS: readonly Tier[] = ['neo', 'morpheus', 'trinity', 'tank', 'mouse']

// `neo`, or `matrix-kit:neo` when the agents ship in the plugin.
const bare = (subagentType: string): string => subagentType.replace(/^matrix-kit:/, '').trim().toLowerCase()

export const isCrew = (subagentType: string): boolean => (TIERS as readonly string[]).includes(bare(subagentType))

export const characterOf = (subagentType: string): Character => {
  if (isCrew(subagentType)) return bare(subagentType) as Tier
  return subagentType === 'Explore' ? 'oracle' : 'smith'
}

export const CHARACTER_NAME: Record<Character, string> = {
  neo: 'Neo',
  morpheus: 'Morpheus',
  trinity: 'Trinity',
  tank: 'Tank',
  mouse: 'Mouse',
  oracle: 'The Oracle',
  smith: 'Agent Smith',
}

// What each tier runs on, for planned tasks that have no run yet (agents/<tier>.md frontmatter).
export const TIER_MODEL: Record<Tier, [model: string, effort: string]> = {
  neo: ['Fable', 'high'],
  morpheus: ['Opus', 'xhigh'],
  trinity: ['Opus', 'high'],
  tank: ['Opus', 'medium'],
  mouse: ['Opus', 'low'],
}
