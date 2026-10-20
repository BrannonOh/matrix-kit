// Who plays each subagent: the character comes from the model family, at any effort.

export type Character = 'neo' | 'morpheus' | 'trinity' | 'oracle' | 'smith'

// Matched anywhere in the id, so aliases ("opus") and provider ids ("us.anthropic.claude-opus-…") count.
const FAMILY: readonly [family: string, character: Character][] = [
  ['fable', 'neo'],
  ['opus', 'morpheus'],
  ['sonnet', 'trinity'],
  ['haiku', 'oracle'],
]

// Agent Smith until the model is known, and for any model outside the four families.
export const characterOf = (model: string | undefined): Character => {
  const id = (model ?? '').toLowerCase()
  return FAMILY.find(([family]) => id.includes(family))?.[1] ?? 'smith'
}

export const CHARACTER_NAME: Record<Character, string> = {
  neo: 'Neo',
  morpheus: 'Morpheus',
  trinity: 'Trinity',
  oracle: 'The Oracle',
  smith: 'Agent Smith',
}
