import type { BoardDoc, Card } from './types'

export type History<T> = { past: T[]; present: T; future: T[] }
export function commit<T>(history: History<T>, next: T): History<T> {
  return next === history.present ? history : { past: [...history.past, history.present].slice(-100), present: next, future: [] }
}
export function undo<T>(history: History<T>): History<T> {
  if (!history.past.length) return history
  return { past: history.past.slice(0, -1), present: history.past.at(-1)!, future: [history.present, ...history.future] }
}
export function redo<T>(history: History<T>): History<T> {
  if (!history.future.length) return history
  return { past: [...history.past, history.present], present: history.future[0], future: history.future.slice(1) }
}
export function searchCards(board: BoardDoc, query: string): string[] {
  const value = query.trim().toLocaleLowerCase()
  if (!value) return []
  return board.cards.filter((card) => (card.type === 'text' ? card.text : card.type === 'link' ? card.title : card.alt).toLocaleLowerCase().includes(value)).map((card) => card.id)
}
export function duplicateCards(target: BoardDoc, source: BoardDoc, selected: string[], offset: { x: number; y: number }) {
  const included = new Set(selected)
  let changed = true
  while (changed) {
    changed = false
    for (const h of source.hierarchies) if (h.parentId && included.has(h.parentId) && !included.has(h.nodeId)) { included.add(h.nodeId); changed = true }
  }
  const cards = source.cards.filter((c) => included.has(c.id))
  const ids = new Map(cards.map((c) => [c.id, crypto.randomUUID()]))
  const groups = new Map(source.groups.filter((g) => cards.some((c) => c.groupId === g.id)).map((g) => [g.id, crypto.randomUUID()]))
  const copies: Card[] = cards.map((c) => ({ ...c, id: ids.get(c.id)!, x: c.x + offset.x, y: c.y + offset.y, groupId: c.groupId ? groups.get(c.groupId) : undefined }))
  const hierarchies = source.hierarchies.filter((h) => ids.has(h.nodeId)).map((h) => {
    let root = h.nodeId
    let current = h
    while (current.parentId && ids.has(current.parentId)) {
      root = current.parentId
      current = source.hierarchies.find((item) => item.nodeId === root)!
    }
    return { ...h, nodeId: ids.get(h.nodeId)!, rootId: ids.get(root)!, parentId: h.parentId && ids.has(h.parentId) ? ids.get(h.parentId)! : null }
  })
  return { ids: copies.map((c) => c.id), board: { ...target, updatedAt: Date.now(), cards: [...target.cards, ...copies], hierarchies: [...target.hierarchies, ...hierarchies], groups: [...target.groups, ...source.groups.filter((g) => groups.has(g.id)).map((g) => ({ ...g, id: groups.get(g.id)! }))], relations: [...target.relations, ...source.relations.filter((r) => ids.has(r.fromId) && ids.has(r.toId)).map((r) => ({ ...r, id: crypto.randomUUID(), fromId: ids.get(r.fromId)!, toId: ids.get(r.toId)! }))] } }
}
