// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { usePersistence } from './usePersistence'
import { useCanvasStore } from '../store/useCanvasStore'
import { exportBackup } from './backup'

describe('save errors', () => {
  it('recovers local data and retains work created during a read failure', async () => {
    const save = vi.fn(async () => {})
    const load = vi.fn(async () => { throw new Error('temporarily unavailable') })
    const { result } = renderHook(() => { const store = useCanvasStore(); return { store, persistence: usePersistence(store, { load, save }) } })
    await act(async () => {})
    const original = { ...result.current.store.workspace, boards: [{ ...result.current.store.board, id: 'recovered', title: '原有数据' }], activeBoardId: 'recovered' }
    act(() => result.current.store.addText({ x: 1, y: 2 }))
    load.mockImplementation(async () => original as never)
    await act(async () => result.current.persistence.retryLoad())
    expect(result.current.store.workspace.boards).toHaveLength(2)
    expect(result.current.store.workspace.boards[0].title).toBe('原有数据')
    expect(result.current.store.workspace.boards[1].cards).toHaveLength(1)
    expect(result.current.persistence.status).toBe('saved')
  })
  it('does not allow an old flush to overwrite an import in progress', async () => {
    const writes: unknown[] = []
    let release!: () => void
    const gate = new Promise<void>((resolve) => { release = resolve })
    const save = vi.fn(async (workspace) => { writes.push(workspace); if (writes.length === 1) await gate })
    const load = async () => null
    const { result } = renderHook(() => { const store = useCanvasStore(); return { store, persistence: usePersistence(store, { load, save }) } })
    await act(async () => {})
    act(() => result.current.store.addText({ x: 0, y: 0 }))
    const next = { ...result.current.store.workspace, boards: [{ ...result.current.store.board, title: '导入结果' }] }
    let importing!: Promise<void>
    act(() => { importing = result.current.persistence.commitImport(next) })
    await act(async () => { await Promise.resolve() })
    let flushing!: Promise<boolean>
    act(() => { flushing = result.current.persistence.flush() })
    await act(async () => { release(); await importing; await flushing })
    expect(writes.at(-1)).toBe(next)
    expect(result.current.store.board.title).toBe('导入结果')
  })
  it('does not overwrite unread local data after a load failure', async () => {
    const save = vi.fn(async () => {})
    const load = vi.fn(async () => { throw new Error('future schema') })
    const { result } = renderHook(() => { const store = useCanvasStore(); return { store, persistence: usePersistence(store, { load, save }) } })
    await act(async () => {})
    act(() => result.current.store.addText({ x: 1, y: 2 }))
    await act(async () => { await result.current.persistence.flush() })
    expect(save).not.toHaveBeenCalled()
    expect(result.current.persistence.status).toBe('error')
  })
  it('reports failure and keeps edited memory exportable', async () => {
    const save = vi.fn(async () => { throw new Error('quota exceeded') })
    const load = vi.fn(async () => null)
    const { result } = renderHook(() => {
      const store = useCanvasStore()
      return { store, persistence: usePersistence(store, { load, save }) }
    })
    await act(async () => {})
    act(() => result.current.store.addText({ x: 1, y: 2 }))
    await act(async () => { await result.current.persistence.flush() })
    expect(result.current.persistence.status).toBe('error')
    expect(result.current.store.board.cards).toHaveLength(1)
    expect((await exportBackup(result.current.store.workspace)).size).toBeGreaterThan(0)
  })
})
