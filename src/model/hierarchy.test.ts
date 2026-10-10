import { describe, expect, it } from 'vitest'
import { addChild, createBoard, makeRoot, moveSubtree, reparent, setCollapsed, visibleCardIds, visibleRelations } from './operations'
import { layoutTree } from './layout'
import type { BoardDoc, Card } from './types'

const card = (id: string, x = 0, y = 0): Card => ({ id, type: 'text', text: id, x, y, width: 180, height: 80, color: 'cream' })
const withCards = (...cards: Card[]): BoardDoc => ({ ...createBoard('导图'), cards })

describe('mind-map hierarchy', () => {
  it('creates two independent roots', () => {
    const board = withCards(card('a'), card('b'))
    const updated = makeRoot(makeRoot(board, 'a'), 'b')
    expect(updated.hierarchies).toMatchObject([
      { nodeId: 'a', rootId: 'a', parentId: null },
      { nodeId: 'b', rootId: 'b', parentId: null }
    ])
  })

  it('turns a free card into a root when adding its first child', () => {
    const board = withCards(card('a'))
    const updated = addChild(board, 'a', card('b', 250, 0))
    expect(updated.hierarchies).toMatchObject([
      { nodeId: 'a', rootId: 'a', parentId: null },
      { nodeId: 'b', rootId: 'a', parentId: 'a' }
    ])
  })

  it('rejects making a parent its own descendant', () => {
    let board = withCards(card('a'))
    board = addChild(board, 'a', card('b'))
    expect(() => reparent(board, 'a', 'b')).toThrow()
    expect(board.hierarchies.find((entry) => entry.nodeId === 'a')?.parentId).toBeNull()
  })

  it('hides folded descendants and relations that lead to them', () => {
    let board = withCards(card('a'), card('free'))
    board = addChild(board, 'a', card('b'))
    board = addChild(board, 'b', card('c'))
    board.relations = [{ id: 'cross', fromId: 'free', toId: 'c', label: '' }]
    const folded = setCollapsed(board, 'a', true)
    expect([...visibleCardIds(folded)].sort()).toEqual(['a', 'free'])
    expect(visibleRelations(folded)).toEqual([])
    expect([...visibleCardIds(setCollapsed(folded, 'a', false))].sort()).toEqual(['a', 'b', 'c', 'free'])
  })

  it('moves a whole subtree while leaving unrelated cards still', () => {
    let board = withCards(card('a', 0, 0), card('free', 700, 500))
    board = addChild(board, 'a', card('b', 200, 0))
    const moved = moveSubtree(board, 'a', { x: 50, y: 30 })
    expect(moved.cards.map((item) => [item.id, item.x, item.y])).toEqual([
      ['a', 50, 30], ['free', 700, 500], ['b', 250, 30]
    ])
  })

  it('lays out only the selected tree from left to right', () => {
    let board = withCards(card('a', 10, 20), card('free', 900, 700))
    board = addChild(board, 'a', card('b'))
    board = addChild(board, 'a', card('c'))
    const laidOut = layoutTree(board, 'a')
    expect(laidOut.cards.find((item) => item.id === 'a')).toMatchObject({ x: 10, y: 20 })
    expect(laidOut.cards.find((item) => item.id === 'b')!.x).toBeGreaterThan(190)
    expect(laidOut.cards.find((item) => item.id === 'c')!.y).toBeGreaterThan(laidOut.cards.find((item) => item.id === 'b')!.y)
    expect(laidOut.cards.find((item) => item.id === 'free')).toMatchObject({ x: 900, y: 700 })
  })
})
