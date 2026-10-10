import { describe, expect, it } from 'vitest'
import { commit, undo, redo, searchCards, duplicateCards } from './history'
import { addCard, addChild, createBoard } from './operations'

describe('history and discovery', () => {
  it('undoes a committed transaction and invalidates redo after a new edit', () => {
    const start = { past: [] as number[], present: 0, future: [] as number[] }
    const edited = commit(start, 10)
    expect(undo(edited).present).toBe(0)
    expect(redo(undo(edited)).present).toBe(10)
    expect(commit(undo(edited), 3).future).toEqual([])
  })
  it('searches text and link titles without matching empty queries', () => {
    let board = createBoard('test')
    board = addCard(board, { id: 'a', type: 'text', text: 'Hello 思考', color: 'cream', x: 0, y: 0, width: 200, height: 100 })
    board = addCard(board, { id: 'b', type: 'link', title: 'HELLO', url: 'https://example.com', color: 'mint', x: 0, y: 0, width: 200, height: 100 })
    expect(searchCards(board, 'hello')).toEqual(['a', 'b'])
    expect(searchCards(board, ' ')).toEqual([])
  })
  it('copies a whole subtree, remapping hierarchy and internal connections', () => {
    let board = createBoard('test')
    const base = { type: 'text' as const, text: 'x', color: 'cream' as const, x: 0, y: 0, width: 200, height: 100 }
    board = addCard(board, { ...base, id: 'a' })
    board = addChild(board, 'a', { ...base, id: 'b', x: 300 })
    board = { ...board, relations: [{ id: 'r', fromId: 'a', toId: 'b', label: 'test' }] }
    const result = duplicateCards(board, board, ['a'], { x: 40, y: 40 })
    expect(result.board.cards).toHaveLength(4)
    expect(result.ids).toHaveLength(2)
    const child = result.board.hierarchies.find((h) => h.nodeId === result.ids[1])!
    expect(child.parentId).toBe(result.ids[0])
    expect(result.board.relations[1].fromId).toBe(result.ids[0])
  })
})
