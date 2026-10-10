import type { BoardDoc, Card, Relation } from './types'

export function createBoard(_title: string): BoardDoc {
  return {
    schemaVersion: 1,
    id: crypto.randomUUID(),
    title: _title.trim() || '未命名画布',
    updatedAt: Date.now(),
    cards: [],
    hierarchies: [],
    relations: [],
    groups: [],
    viewport: { x: 0, y: 0, zoom: 1 }
  }
}

export function addCard(_board: BoardDoc, _card: Card): BoardDoc {
  if (_board.cards.some((card) => card.id === _card.id)) {
    throw new Error('卡片 ID 已存在')
  }
  return { ..._board, cards: [..._board.cards, _card], updatedAt: Date.now() }
}

export function removeCards(_board: BoardDoc, _ids: string[]): BoardDoc {
  const removed = new Set(_ids)
  let changed = true
  while (changed) {
    changed = false
    for (const entry of _board.hierarchies) {
      if (entry.parentId && removed.has(entry.parentId) && !removed.has(entry.nodeId)) {
        removed.add(entry.nodeId)
        changed = true
      }
    }
  }
  const cards = _board.cards.filter((card) => !removed.has(card.id))
  const usedGroups = new Set(cards.map((card) => card.groupId).filter(Boolean))
  return {
    ..._board,
    cards,
    hierarchies: _board.hierarchies.filter((entry) => !removed.has(entry.nodeId)),
    relations: _board.relations.filter((edge) => !removed.has(edge.fromId) && !removed.has(edge.toId)),
    groups: _board.groups.filter((group) => usedGroups.has(group.id)),
    updatedAt: Date.now()
  }
}

export function addRelation(_board: BoardDoc, _relation: Relation): BoardDoc {
  const ids = new Set(_board.cards.map((card) => card.id))
  if (!ids.has(_relation.fromId) || !ids.has(_relation.toId)) {
    throw new Error('连线必须连接现有卡片')
  }
  if (_relation.fromId === _relation.toId) {
    throw new Error('不能连接卡片自身')
  }
  if (_board.relations.some((relation) => relation.id === _relation.id)) {
    throw new Error('连线 ID 已存在')
  }
  return { ..._board, relations: [..._board.relations, _relation], updatedAt: Date.now() }
}

export function moveCard(_board: BoardDoc, _id: string, _position: { x: number; y: number }): BoardDoc {
  if (!_board.cards.some((card) => card.id === _id)) {
    throw new Error('卡片不存在')
  }
  return {
    ..._board,
    cards: _board.cards.map((card) => card.id === _id ? { ...card, ..._position } : card),
    updatedAt: Date.now()
  }
}

function subtreeIds(board: BoardDoc, nodeId: string): Set<string> {
  const ids = new Set([nodeId])
  let changed = true
  while (changed) {
    changed = false
    for (const entry of board.hierarchies) {
      if (entry.parentId && ids.has(entry.parentId) && !ids.has(entry.nodeId)) {
        ids.add(entry.nodeId)
        changed = true
      }
    }
  }
  return ids
}

export function makeRoot(board: BoardDoc, cardId: string): BoardDoc {
  if (!board.cards.some((card) => card.id === cardId)) throw new Error('卡片不存在')
  if (board.hierarchies.some((entry) => entry.nodeId === cardId)) return board
  return {
    ...board,
    hierarchies: [...board.hierarchies, { nodeId: cardId, rootId: cardId, parentId: null, order: 0, collapsed: false }],
    updatedAt: Date.now()
  }
}

export function addChild(board: BoardDoc, parentId: string, card: Card): BoardDoc {
  const rooted = makeRoot(board, parentId)
  const parent = rooted.hierarchies.find((entry) => entry.nodeId === parentId)!
  const withCard = addCard(rooted, card)
  const order = rooted.hierarchies.filter((entry) => entry.parentId === parentId).length
  return {
    ...withCard,
    hierarchies: [...rooted.hierarchies, { nodeId: card.id, rootId: parent.rootId, parentId, order, collapsed: false }]
  }
}

export function reparent(board: BoardDoc, nodeId: string, parentId: string): BoardDoc {
  if (!board.cards.some((card) => card.id === nodeId)) throw new Error('卡片不存在')
  if (!board.cards.some((card) => card.id === parentId)) throw new Error('父卡片不存在')
  if (subtreeIds(board, nodeId).has(parentId)) throw new Error('不能将节点移动到自身或其后代下')
  const rooted = makeRoot(board, parentId)
  const parent = rooted.hierarchies.find((entry) => entry.nodeId === parentId)!
  const descendants = subtreeIds(rooted, nodeId)
  const current = rooted.hierarchies.find((entry) => entry.nodeId === nodeId)
  const order = rooted.hierarchies.filter((entry) => entry.parentId === parentId).length
  const hierarchies = rooted.hierarchies.map((entry) => {
    if (entry.nodeId === nodeId) return { ...entry, parentId, rootId: parent.rootId, order }
    if (descendants.has(entry.nodeId)) return { ...entry, rootId: parent.rootId }
    return entry
  })
  if (!current) hierarchies.push({ nodeId, rootId: parent.rootId, parentId, order, collapsed: false })
  return { ...rooted, hierarchies, updatedAt: Date.now() }
}

export function detachSubtree(board: BoardDoc, nodeId: string): BoardDoc {
  const current = board.hierarchies.find((entry) => entry.nodeId === nodeId)
  if (!current || current.parentId === null) return board
  const descendants = subtreeIds(board, nodeId)
  return {
    ...board,
    hierarchies: board.hierarchies.map((entry) => {
      if (entry.nodeId === nodeId) return { ...entry, parentId: null, rootId: nodeId, order: 0 }
      return descendants.has(entry.nodeId) ? { ...entry, rootId: nodeId } : entry
    }),
    updatedAt: Date.now()
  }
}

export function setCollapsed(board: BoardDoc, nodeId: string, collapsed: boolean): BoardDoc {
  if (!board.hierarchies.some((entry) => entry.nodeId === nodeId)) throw new Error('思维导图节点不存在')
  return {
    ...board,
    hierarchies: board.hierarchies.map((entry) => entry.nodeId === nodeId ? { ...entry, collapsed } : entry),
    updatedAt: Date.now()
  }
}

export function visibleCardIds(board: BoardDoc): Set<string> {
  const visible = new Set(board.cards.filter((card) => !board.hierarchies.some((entry) => entry.nodeId === card.id)).map((card) => card.id))
  const children = new Map<string, string[]>()
  for (const entry of board.hierarchies) {
    if (entry.parentId) children.set(entry.parentId, [...(children.get(entry.parentId) ?? []), entry.nodeId])
  }
  const visit = (id: string) => {
    visible.add(id)
    if (board.hierarchies.find((entry) => entry.nodeId === id)?.collapsed) return
    for (const child of children.get(id) ?? []) visit(child)
  }
  for (const entry of board.hierarchies) if (entry.parentId === null) visit(entry.nodeId)
  return visible
}

export function visibleRelations(board: BoardDoc): Relation[] {
  const visible = visibleCardIds(board)
  return board.relations.filter((relation) => visible.has(relation.fromId) && visible.has(relation.toId))
}

export function moveSubtree(board: BoardDoc, nodeId: string, delta: { x: number; y: number }): BoardDoc {
  if (!board.cards.some((card) => card.id === nodeId)) throw new Error('卡片不存在')
  const ids = subtreeIds(board, nodeId)
  return {
    ...board,
    cards: board.cards.map((card) => ids.has(card.id) ? { ...card, x: card.x + delta.x, y: card.y + delta.y } : card),
    updatedAt: Date.now()
  }
}

export function createGroup(board: BoardDoc, ids: string[], title: string): BoardDoc {
  const selected = new Set(ids)
  if (!selected.size || selected.size !== ids.length) throw new Error('请选择未重复的卡片')
  if (board.cards.filter((card) => selected.has(card.id)).length !== selected.size) throw new Error('卡片不存在')
  if (board.cards.some((card) => selected.has(card.id) && card.groupId)) throw new Error('请先解散已有分组')
  const id = crypto.randomUUID()
  return {
    ...board,
    cards: board.cards.map((card) => selected.has(card.id) ? { ...card, groupId: id } : card),
    groups: [...board.groups, { id, title: title.trim() || '未命名分组' }],
    updatedAt: Date.now()
  }
}

export function moveGroup(board: BoardDoc, groupId: string, delta: { x: number; y: number }): BoardDoc {
  if (!board.groups.some((group) => group.id === groupId)) throw new Error('分组不存在')
  return {
    ...board,
    cards: board.cards.map((card) => card.groupId === groupId ? { ...card, x: card.x + delta.x, y: card.y + delta.y } : card),
    updatedAt: Date.now()
  }
}

export function ungroup(board: BoardDoc, groupId: string): BoardDoc {
  if (!board.groups.some((group) => group.id === groupId)) throw new Error('分组不存在')
  return {
    ...board,
    cards: board.cards.map((card) => card.groupId === groupId ? { ...card, groupId: undefined } : card),
    groups: board.groups.filter((group) => group.id !== groupId),
    updatedAt: Date.now()
  }
}

export function resizeCard(board: BoardDoc, id: string, size: { width: number; height: number }): BoardDoc {
  if (!board.cards.some((card) => card.id === id)) throw new Error('卡片不存在')
  if (size.width < 150 || size.height < 80) throw new Error('卡片尺寸过小')
  return {
    ...board,
    cards: board.cards.map((card) => card.id === id ? { ...card, ...size } : card),
    updatedAt: Date.now()
  }
}
