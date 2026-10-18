// Which items the operator strip draws at a width, so the row narrows instead of wrapping.

export type StripItem = 'speed' | 'turnCost' | 'sessionCost' | 'cache' | 'context' | 'limits' | 'limitsCombined' | 'model' | 'room'

// Minimum bodyColumns for each optional detail; below them it drops, first dropped first.
const ROOM_MIN = 110
const LIMITS_SPLIT_MIN = 95
const MODEL_MIN = 85
const SESSION_COST_MIN = 72
const SPEED_MIN = 60

export const stripItems = (columns: number, hasLimits: boolean): StripItem[] => {
  const items: StripItem[] = []
  if (columns >= SPEED_MIN) items.push('speed')
  items.push('turnCost')
  if (columns >= SESSION_COST_MIN) items.push('sessionCost')
  items.push('cache', 'context')
  if (hasLimits) items.push(columns >= LIMITS_SPLIT_MIN ? 'limits' : 'limitsCombined')
  if (columns >= MODEL_MIN) items.push('model')
  if (columns >= ROOM_MIN) items.push('room')
  return items
}
