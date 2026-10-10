import { describe, expect, it } from 'vitest'
import { addCard, addRelation, createBoard, moveCard, removeCards, resizeCard } from './operations'
import type { Card } from './types'

const card = (id: string): Card => ({
  id,
  type: 'text',
  x: 120,
  y: 80,
  width: 220,
  height: 110,
  text: id,
  color: 'cream'
})

describe('board document operations', () => {
  it('starts with an empty versioned board', () => {
    const board = createBoard('想法')
    expect(board.schemaVersion).toBe(1)
    expect(board.title).toBe('想法')
    expect(board.cards).toEqual([])
    expect(board.hierarchies).toEqual([])
    expect(board.relations).toEqual([])
  })

  it('adds a card without changing its identity or position', () => {
    const initial = createBoard('计划')
    const updated = addCard(initial, card('a'))
    expect(updated.cards).toHaveLength(1)
    expect(updated.cards[0]).toMatchObject({ id: 'a', x: 120, y: 80 })
    expect(initial.cards).toHaveLength(0)
  })

  it('deletes a parent with its descendants and attached relations', () => {
    const board = createBoard('计划')
    board.cards = [card('root'), card('child'), card('other')]
    board.hierarchies = [
      { nodeId: 'root', rootId: 'root', parentId: null, order: 0, collapsed: false },
      { nodeId: 'child', rootId: 'root', parentId: 'root', order: 0, collapsed: false }
    ]
    board.relations = [{ id: 'r', fromId: 'child', toId: 'other', label: '参考' }]
    const updated = removeCards(board, ['root'])
    expect(updated.cards.map((item) => item.id)).toEqual(['other'])
    expect(updated.hierarchies).toEqual([])
    expect(updated.relations).toEqual([])
  })

  it('refuses a relation whose target does not exist', () => {
    const board = addCard(createBoard('计划'), card('a'))
    expect(() => addRelation(board, { id: 'edge', fromId: 'a', toId: 'missing', label: '' })).toThrow()
    expect(board.relations).toEqual([])
  })

  it('adds a relation between existing cards', () => {
    const board = createBoard('计划')
    board.cards = [card('a'), card('b')]
    const updated = addRelation(board, { id: 'edge', fromId: 'a', toId: 'b', label: '关联' })
    expect(updated.relations).toEqual([{ id: 'edge', fromId: 'a', toId: 'b', label: '关联' }])
  })

  it('moves only the requested card', () => {
    const board = createBoard('计划')
    board.cards = [card('a'), card('b')]
    const updated = moveCard(board, 'a', { x: 400, y: 300 })
    expect(updated.cards[0]).toMatchObject({ x: 400, y: 300 })
    expect(updated.cards[1]).toMatchObject({ x: 120, y: 80 })
  })

  it('resizes one card without changing its content', () => {
    const board = addCard(createBoard('计划'), card('a'))
    const updated = resizeCard(board, 'a', { width: 300, height: 180 })
    expect(updated.cards[0]).toMatchObject({ width: 300, height: 180, text: 'a' })
    expect(board.cards[0]).toMatchObject({ width: 220, height: 110 })
  })
})
