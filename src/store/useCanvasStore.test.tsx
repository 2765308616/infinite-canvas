// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { File as NodeFile } from 'node:buffer'
import { describe, expect, it } from 'vitest'
import { useCanvasStore } from './useCanvasStore'

describe('canvas state', () => {
  it('copies a subtree and undoes deletion and layout independently', () => {
    const { result } = renderHook(() => useCanvasStore())
    act(() => result.current.addMindMap({ x: 0, y: 0 }))
    const id = result.current.board.cards[0].id
    act(() => result.current.addChild(id))
    act(() => result.current.setSelection({ cardIds: [id], relationIds: [] }))
    act(() => result.current.copy())
    act(() => result.current.paste())
    expect(result.current.board.cards).toHaveLength(4)
    const before = result.current.board.cards
    act(() => result.current.deleteSelection())
    expect(result.current.board.cards).toHaveLength(2)
    act(() => result.current.undo())
    expect(result.current.board.cards).toEqual(before)
    act(() => result.current.moveCard(id, { x: 20, y: 80 }))
    const moved = result.current.board.cards
    act(() => result.current.layoutBranch(id))
    act(() => result.current.undo())
    expect(result.current.board.cards).toEqual(moved)
  })
  it('moves a selected parent and child once when dragging together', () => {
    const { result } = renderHook(() => useCanvasStore())
    act(() => result.current.addText({ x: 0, y: 0 }))
    const parent = result.current.board.cards[0].id
    act(() => result.current.addChild(parent))
    const child = result.current.board.cards[1]
    act(() => result.current.moveCards([{ id: parent, position: { x: 50, y: 60 } }, { id: child.id, position: { x: child.x + 50, y: child.y + 60 } }]))
    expect(result.current.board.cards[1]).toMatchObject({ x: child.x + 50, y: child.y + 60 })
  })
  it('undoes an entire drag as one step and keeps each board history separate', () => {
    const { result } = renderHook(() => useCanvasStore())
    act(() => result.current.addText({ x: 0, y: 0 }))
    const id = result.current.board.cards[0].id
    act(() => result.current.beginTransaction())
    act(() => result.current.moveCard(id, { x: 20, y: 20 }))
    act(() => result.current.moveCard(id, { x: 50, y: 50 }))
    act(() => result.current.endTransaction())
    act(() => result.current.undo())
    expect(result.current.board.cards[0].x).toBe(0)
    act(() => result.current.redo())
    expect(result.current.board.cards[0].x).toBe(50)
    act(() => result.current.newBoard('第二张'))
    expect(result.current.canUndo).toBe(false)
  })
  it('rejects invalid grouping synchronously without changing state', () => {
    const { result } = renderHook(() => useCanvasStore())
    expect(() => result.current.createGroup('空')).toThrow()
    expect(result.current.board.groups).toHaveLength(0)
  })
  it('replaces an image while retaining the old asset for undo', async () => {
    const { result } = renderHook(() => useCanvasStore())
    const file = new NodeFile([Uint8Array.of(137,80,78,71,13,10,26,10)], 'a.png', { type: 'image/png' }) as unknown as File
    await act(async () => result.current.addImage(file, { x: 0, y: 0 }))
    const card = result.current.board.cards[0]
    await act(async () => result.current.replaceImage(card.id, file))
    expect(result.current.workspace.assets).toHaveLength(2)
    act(() => result.current.undo())
    expect(result.current.board.cards[0]).toEqual(card)
  })
  it('creates a text card on the active board', () => {
    const { result } = renderHook(() => useCanvasStore())
    expect(result.current.board.cards).toHaveLength(0)
    act(() => result.current.addText({ x: 40, y: 60 }))
    expect(result.current.board.cards).toHaveLength(1)
    expect(result.current.board.cards[0]).toMatchObject({ type: 'text', x: 40, y: 60 })
  })

  it('keeps boards independent when switching between them', () => {
    const { result } = renderHook(() => useCanvasStore())
    const originalId = result.current.board.id
    act(() => result.current.addText({ x: 0, y: 0 }))
    act(() => result.current.newBoard('另一张'))
    expect(result.current.board.cards).toHaveLength(0)
    act(() => result.current.selectBoard(originalId))
    expect(result.current.board.cards).toHaveLength(1)
  })

  it('creates a mind-map child from a free card and folds it', () => {
    const { result } = renderHook(() => useCanvasStore())
    act(() => result.current.addText({ x: 0, y: 0 }))
    const rootId = result.current.board.cards[0].id
    act(() => result.current.addChild(rootId))
    expect(result.current.board.hierarchies).toHaveLength(2)
    act(() => result.current.toggleCollapse(rootId))
    expect(result.current.board.hierarchies.find((entry) => entry.nodeId === rootId)?.collapsed).toBe(true)
  })

  it('adds an image card and its bytes together', async () => {
    const { result } = renderHook(() => useCanvasStore())
    const bytes = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10, 1)
    const file = new NodeFile([bytes], 'idea.png', { type: 'image/png' }) as unknown as File
    await act(async () => result.current.addImage(file, { x: 12, y: 34 }))
    expect(result.current.board.cards[0]).toMatchObject({ type: 'image', x: 12, y: 34 })
    expect(result.current.workspace.assets[0].bytes).toEqual(bytes)
  })

  it('rejects a dangerous link before changing the board', () => {
    const { result } = renderHook(() => useCanvasStore())
    expect(() => result.current.addLink('Run', 'javascript:alert(1)', { x: 0, y: 0 })).toThrow()
    expect(result.current.board.cards).toHaveLength(0)
  })

  it('creates a normalized HTTP link card', () => {
    const { result } = renderHook(() => useCanvasStore())
    act(() => result.current.addLink('参考', 'https://example.com', { x: 10, y: 20 }))
    expect(result.current.board.cards[0]).toMatchObject({
      type: 'link', title: '参考', url: 'https://example.com/', x: 10, y: 20
    })
  })
})
