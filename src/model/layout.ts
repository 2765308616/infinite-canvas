import { visibleCardIds } from './operations'
import type { BoardDoc } from './types'

export function layoutTree(board: BoardDoc, rootId: string): BoardDoc {
  const root = board.cards.find((card) => card.id === rootId)
  if (!root || !board.hierarchies.some((entry) => entry.nodeId === rootId)) throw new Error('思维导图根节点不存在')
  const visible = visibleCardIds(board)
  const byId = new Map(board.cards.map((card) => [card.id, card]))
  const children = (id: string) => board.hierarchies
    .filter((entry) => entry.parentId === id && visible.has(entry.nodeId))
    .sort((a, b) => a.order - b.order)
    .map((entry) => entry.nodeId)
  const gapY = 30
  const span = (id: string): number => {
    const card = byId.get(id)!
    const childIds = children(id)
    if (!childIds.length) return card.height
    return Math.max(card.height, childIds.reduce((sum, child) => sum + span(child), 0) + gapY * (childIds.length - 1))
  }
  const positions = new Map<string, { x: number; y: number }>()
  const place = (id: string, x: number, top: number) => {
    const card = byId.get(id)!
    const ownSpan = span(id)
    positions.set(id, { x, y: top + (ownSpan - card.height) / 2 })
    const childIds = children(id)
    const childrenSpan = childIds.reduce((sum, child) => sum + span(child), 0) + gapY * Math.max(0, childIds.length - 1)
    let childTop = top + (ownSpan - childrenSpan) / 2
    for (const child of childIds) {
      place(child, x + card.width + 64, childTop)
      childTop += span(child) + gapY
    }
  }
  place(rootId, root.x, root.y - (span(rootId) - root.height) / 2)
  return {
    ...board,
    cards: board.cards.map((card) => positions.has(card.id) ? { ...card, ...positions.get(card.id)! } : card),
    updatedAt: Date.now()
  }
}
