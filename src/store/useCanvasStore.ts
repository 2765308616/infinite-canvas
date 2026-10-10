import { useCallback, useRef, useState } from 'react'
import { commit, undo as undoHistory, redo as redoHistory, duplicateCards, type History } from '../model/history'
import { pruneAssets } from '../model/assets'
import {
  addCard, addChild as addChildNode, addRelation, createBoard,
  createGroup as createGroupOperation, moveGroup as moveGroupOperation, ungroup as ungroupOperation,
  detachSubtree as detachNode, makeRoot, moveCard, moveSubtree,
  removeCards, reparent as reparentNode, setCollapsed
  , resizeCard
} from '../model/operations'
import { layoutTree } from '../model/layout'
import { normalizeHttpUrl, validateImage } from '../model/content'
import type { BoardDoc, Card, Relation, Viewport, Workspace } from '../model/types'

export type CanvasSelection = { cardIds: string[]; relationIds: string[] }

export function useCanvasStore() {
  const [workspace, rawSetWorkspace] = useState<Workspace>(() => {
    const board = createBoard('我的画布')
    return { schemaVersion: 1, boards: [board], assets: [], activeBoardId: board.id }
  })
  const workspaceRef = useRef(workspace)
  const histories = useRef(new Map<string, History<BoardDoc>>())
  const transaction = useRef<BoardDoc | null>(null)
  const clipboard = useRef<{ board: BoardDoc; ids: string[]; count: number } | null>(null)
  const [selection, setSelection] = useState<CanvasSelection>({ cardIds: [], relationIds: [] })
  const [focusRequest, setFocusRequest] = useState<{ id: string; nonce: number } | null>(null)
  const board = workspace.boards.find((item) => item.id === workspace.activeBoardId) ?? workspace.boards[0]

  const mutateWorkspace = useCallback((edit: (current: Workspace) => Workspace, record = true) => {
    const current = workspaceRef.current
    let next = edit(current)
    if (record && !transaction.current) for (const previous of current.boards) {
      const edited = next.boards.find((b) => b.id === previous.id)
      if (edited && edited !== previous) {
        const history = histories.current.get(previous.id) ?? { past: [], present: previous, future: [] }
        histories.current.set(previous.id, commit({ ...history, present: previous }, edited))
      }
    }
    const retained = [...histories.current.values()].flatMap((h) => [...h.past, h.present, ...h.future])
    if (transaction.current) retained.push(transaction.current)
    if (clipboard.current) retained.push(clipboard.current.board)
    next = pruneAssets(next, retained)
    workspaceRef.current = next
    rawSetWorkspace(next)
  }, [])
  const setWorkspace = useCallback((next: Workspace) => {
    histories.current.clear(); transaction.current = null
    clipboard.current = null
    workspaceRef.current = pruneAssets(next); rawSetWorkspace(workspaceRef.current)
    setSelection({ cardIds: [], relationIds: [] })
  }, [])
  const updateBoard = useCallback((edit: (board: BoardDoc) => BoardDoc, record = true) => {
    mutateWorkspace((current) => ({
      ...current,
      boards: current.boards.map((item) => item.id === current.activeBoardId ? edit(item) : item)
    }), record)
  }, [mutateWorkspace])
  const beginTransaction = useCallback(() => {
    if (!transaction.current) transaction.current = workspaceRef.current.boards.find((b) => b.id === workspaceRef.current.activeBoardId)!
  }, [])
  const endTransaction = useCallback(() => {
    const original = transaction.current
    if (!original) return
    transaction.current = null
    const next = workspaceRef.current.boards.find((b) => b.id === original.id)!
    if (next !== original) {
      const history = histories.current.get(original.id) ?? { past: [], present: original, future: [] }
      histories.current.set(original.id, commit({ ...history, present: original }, next))
      rawSetWorkspace({ ...workspaceRef.current })
    }
  }, [])
  const navigateHistory = useCallback((direction: 'undo' | 'redo') => {
    endTransaction()
    const current = workspaceRef.current
    const history = histories.current.get(current.activeBoardId)
    if (!history) return
    const next = direction === 'undo' ? undoHistory(history) : redoHistory(history)
    histories.current.set(current.activeBoardId, next)
    mutateWorkspace((w) => ({ ...w, boards: w.boards.map((b) => b.id === w.activeBoardId ? { ...next.present, viewport: b.viewport } : b) }), false)
    setSelection({ cardIds: [], relationIds: [] })
  }, [endTransaction, mutateWorkspace])

  const addText = useCallback((position: { x: number; y: number }) => {
    updateBoard((current) => addCard(current, {
      id: crypto.randomUUID(), type: 'text', x: position.x, y: position.y,
      width: 220, height: 110, color: 'cream', text: ''
    }))
  }, [updateBoard])

  const addImage = useCallback(async (file: File, position: { x: number; y: number }) => {
    await validateImage(file)
    const bytes = new Uint8Array(await file.arrayBuffer())
    const assetId = crypto.randomUUID()
    const cardId = crypto.randomUUID()
    const boardId = board.id
    mutateWorkspace((current) => ({
      ...current,
      assets: [...current.assets, { id: assetId, mimeType: file.type, bytes }],
      boards: current.boards.map((item) => item.id === boardId ? addCard(item, {
        id: cardId, type: 'image', assetId, alt: file.name,
        x: position.x, y: position.y, width: 250, height: 185, color: 'sky'
      }) : item)
    }))
  }, [board.id, mutateWorkspace])

  const replaceImage = useCallback(async (id: string, file: File) => {
    await validateImage(file)
    const bytes = new Uint8Array(await file.arrayBuffer())
    const assetId = crypto.randomUUID()
    const boardId = board.id
    mutateWorkspace((current) => ({ ...current, assets: [...current.assets, { id: assetId, mimeType: file.type, bytes }], boards: current.boards.map((b) => b.id === boardId ? { ...b, cards: b.cards.map((c) => c.id === id && c.type === 'image' ? { ...c, assetId, alt: file.name } : c) } : b) }))
  }, [board.id, mutateWorkspace])

  const addLink = useCallback((title: string, urlInput: string, position: { x: number; y: number }) => {
    const url = normalizeHttpUrl(urlInput)
    updateBoard((current) => addCard(current, {
      id: crypto.randomUUID(), type: 'link', title: title.trim() || new URL(url).hostname, url,
      x: position.x, y: position.y, width: 230, height: 110, color: 'mint'
    }))
  }, [updateBoard])

  const newBoard = useCallback((title: string) => {
    const next = createBoard(title)
    endTransaction()
    mutateWorkspace((current) => ({ ...current, boards: [...current.boards, next], activeBoardId: next.id }), false)
    setSelection({ cardIds: [], relationIds: [] })
  }, [endTransaction, mutateWorkspace])

  const selectBoard = useCallback((id: string) => {
    endTransaction()
    mutateWorkspace((current) => current.boards.some((item) => item.id === id)
      ? { ...current, activeBoardId: id } : current, false)
    setSelection({ cardIds: [], relationIds: [] })
  }, [endTransaction, mutateWorkspace])

  const renameBoard = useCallback((title: string) => {
    updateBoard((current) => ({ ...current, title: title.trim() || '未命名画布', updatedAt: Date.now() }))
  }, [updateBoard])

  const updateCard = useCallback((id: string, edit: (card: Card) => Card) => {
    updateBoard((current) => ({
      ...current,
      cards: current.cards.map((card) => card.id === id ? edit(card) : card),
      updatedAt: Date.now()
    }))
  }, [updateBoard])

  const editLink = useCallback((id: string, title: string, urlInput: string) => {
    const url = normalizeHttpUrl(urlInput)
    updateCard(id, (card) => card.type === 'link' ? { ...card, title: title.trim() || new URL(url).hostname, url } : card)
  }, [updateCard])

  const move = useCallback((id: string, position: { x: number; y: number }) => {
    updateBoard((current) => {
      const old = current.cards.find((card) => card.id === id)
      if (!old) return current
      return current.hierarchies.some((entry) => entry.nodeId === id)
        ? moveSubtree(current, id, { x: position.x - old.x, y: position.y - old.y })
        : moveCard(current, id, position)
    })
  }, [updateBoard])

  const resize = useCallback((id: string, size: { width: number; height: number }) => {
    updateBoard((current) => resizeCard(current, id, size))
  }, [updateBoard])
  const moveCards = useCallback((changes: { id: string; position: { x: number; y: number } }[]) => {
    updateBoard((current) => {
      const changed = new Set(changes.map((c) => c.id))
      let next = current
      for (const change of changes) {
        let parentId = current.hierarchies.find((h) => h.nodeId === change.id)?.parentId
        let covered = false
        while (parentId) { if (changed.has(parentId)) { covered = true; break } parentId = current.hierarchies.find((h) => h.nodeId === parentId)?.parentId }
        if (covered) continue
        const old = current.cards.find((c) => c.id === change.id)
        if (!old) continue
        next = current.hierarchies.some((h) => h.nodeId === change.id) ? moveSubtree(next, change.id, { x: change.position.x - old.x, y: change.position.y - old.y }) : moveCard(next, change.id, change.position)
      }
      return next
    })
  }, [updateBoard])

  const addMindMap = useCallback((position: { x: number; y: number }) => {
    updateBoard((current) => {
      const id = crypto.randomUUID()
      return makeRoot(addCard(current, {
        id, type: 'text', text: '中心主题', color: 'lavender',
        x: position.x, y: position.y, width: 220, height: 110
      }), id)
    })
  }, [updateBoard])

  const addChild = useCallback((parentId: string) => {
    updateBoard((current) => {
      const parent = current.cards.find((card) => card.id === parentId)
      if (!parent) return current
      const siblingCount = current.hierarchies.filter((entry) => entry.parentId === parentId).length
      return addChildNode(current, parentId, {
        id: crypto.randomUUID(), type: 'text', text: '', color: 'sky',
        x: parent.x + parent.width + 64, y: parent.y + siblingCount * 130,
        width: 200, height: 96
      })
    })
  }, [updateBoard])

  const toggleCollapse = useCallback((id: string) => {
    updateBoard((current) => {
      const entry = current.hierarchies.find((item) => item.nodeId === id)
      return entry ? setCollapsed(current, id, !entry.collapsed) : current
    })
  }, [updateBoard])

  const layoutBranch = useCallback((id: string) => {
    updateBoard((current) => layoutTree(current, id))
  }, [updateBoard])

  const detach = useCallback((id: string) => {
    updateBoard((current) => detachNode(current, id))
  }, [updateBoard])

  const reparent = useCallback((id: string, parentId: string) => {
    updateBoard((current) => reparentNode(current, id, parentId))
  }, [updateBoard])

  const createGroup = useCallback((title: string) => {
    updateBoard((current) => createGroupOperation(current, selection.cardIds, title))
  }, [selection.cardIds, updateBoard])

  const moveGroup = useCallback((groupId: string, delta: { x: number; y: number }) => {
    updateBoard((current) => moveGroupOperation(current, groupId, delta))
  }, [updateBoard])

  const ungroup = useCallback((groupId: string) => {
    updateBoard((current) => ungroupOperation(current, groupId))
  }, [updateBoard])

  const connect = useCallback((fromId: string, toId: string) => {
    updateBoard((current) => addRelation(current, {
      id: crypto.randomUUID(), fromId, toId, label: ''
    }))
  }, [updateBoard])

  const deleteSelection = useCallback(() => {
    updateBoard((current) => {
      const withoutCards = removeCards(current, selection.cardIds)
      return { ...withoutCards, relations: withoutCards.relations.filter((relation) => !selection.relationIds.includes(relation.id)) }
    })
    setSelection({ cardIds: [], relationIds: [] })
  }, [selection, updateBoard])

  const setViewport = useCallback((viewport: Viewport) => {
    updateBoard((current) => ({ ...current, viewport }), false)
  }, [updateBoard])

  const updateRelation = useCallback((id: string, edit: (relation: Relation) => Relation) => {
    updateBoard((current) => ({ ...current, relations: current.relations.map((relation) => relation.id === id ? edit(relation) : relation) }))
  }, [updateBoard])

  const copy = () => { clipboard.current = { board, ids: [...selection.cardIds], count: 0 }; rawSetWorkspace({ ...workspaceRef.current }) }
  const paste = () => {
    const clip = clipboard.current
    if (!clip?.ids.length) return
    clip.count++
    let ids: string[] = []
    updateBoard((current) => { const result = duplicateCards(current, clip.board, clip.ids, { x: clip.count * 35, y: clip.count * 35 }); ids = result.ids; return result.board })
    setSelection({ cardIds: ids, relationIds: [] })
  }
  const focusCard = (id: string) => {
    updateBoard((current) => {
      let next = current
      let h = current.hierarchies.find((item) => item.nodeId === id)
      while (h?.parentId) { next = setCollapsed(next, h.parentId, false); h = current.hierarchies.find((item) => item.nodeId === h!.parentId) }
      return next
    })
    setSelection({ cardIds: [id], relationIds: [] }); setFocusRequest({ id, nonce: Date.now() })
  }
  const addSibling = (id: string) => {
    const h = board.hierarchies.find((item) => item.nodeId === id)
    if (h?.parentId) addChild(h.parentId)
  }
  const renameGroup = (id: string, title: string) => updateBoard((b) => ({ ...b, groups: b.groups.map((g) => g.id === id ? { ...g, title: title.trim() || '未命名分组' } : g) }))
  const history = histories.current.get(board.id)
  return {
    workspace, board, selection, setSelection, setWorkspace, updateBoard,
    addText, addImage, replaceImage, addLink, editLink, newBoard, selectBoard, renameBoard, updateCard, moveCard: move, moveCards, resizeCard: resize,
    connect, deleteSelection, setViewport, updateRelation,
    addMindMap, addChild, toggleCollapse, layoutBranch, detach, reparent,
    createGroup, moveGroup, ungroup, renameGroup, beginTransaction, endTransaction,
    undo: () => navigateHistory('undo'), redo: () => navigateHistory('redo'),
    canUndo: !!history?.past.length, canRedo: !!history?.future.length,
    copy, paste, canPaste: !!clipboard.current?.ids.length, focusCard, focusRequest, addSibling
  }
}
