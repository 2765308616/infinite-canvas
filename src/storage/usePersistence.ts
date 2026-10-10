import { useCallback, useEffect, useRef, useState } from 'react'
import type { useCanvasStore } from '../store/useCanvasStore'
import type { Workspace } from '../model/types'
import { loadWorkspace, saveWorkspace } from './database'

type Adapter = { load: () => Promise<Workspace | null>; save: (workspace: Workspace) => Promise<void> }
const defaultAdapter: Adapter = { load: loadWorkspace, save: saveWorkspace }
export function usePersistence(store: ReturnType<typeof useCanvasStore>, adapter = defaultAdapter) {
  const backend = useRef(adapter).current
  const [ready, setReady] = useState(false)
  const [status, setStatus] = useState<'loading' | 'pending' | 'saving' | 'saved' | 'error'>('loading')
  const [error, setError] = useState('')
  const latest = useRef(store.workspace)
  latest.current = store.workspace
  const saved = useRef<Workspace | null>(null)
  const loadBlocked = useRef(false)
  const importing = useRef(false)
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const enqueue = useCallback((snapshot: Workspace) => {
    const operation = queue.current.catch(() => {}).then(() => backend.save(snapshot))
    queue.current = operation
    return operation
  }, [backend])
  useEffect(() => {
    let cancelled = false
    backend.load().then((workspace) => {
      if (cancelled) return
      if (workspace) store.setWorkspace(workspace)
      saved.current = workspace ?? latest.current
      loadBlocked.current = false
      setStatus('saved'); setReady(true)
    }).catch((cause) => {
      if (cancelled) return
      saved.current = latest.current
      loadBlocked.current = true
      setError(`读取本地数据失败，自动保存已暂停以保护原数据。请先导出当前内容，再重新打开应用。${cause instanceof Error ? cause.message : ''}`)
      setStatus('error'); setReady(true)
    })
    return () => { cancelled = true }
  }, [backend, store.setWorkspace])
  const flush = useCallback(async () => {
    if (!ready || importing.current || loadBlocked.current) return false
    const snapshot = latest.current
    if (snapshot === saved.current) return true
    setStatus('saving')
    try {
      await enqueue(snapshot)
      saved.current = snapshot
      setError(''); setStatus(latest.current === snapshot ? 'saved' : 'pending')
      return true
    } catch (cause) {
      setError(`保存失败，当前内容仍在内存中，请立即导出备份。${cause instanceof Error ? cause.message : ''}`)
      setStatus('error'); return false
    }
  }, [ready, enqueue])
  useEffect(() => {
    if (!ready || store.workspace === saved.current || loadBlocked.current || importing.current) return
    setStatus('pending')
    const timer = setTimeout(() => { void flush() }, 600)
    return () => clearTimeout(timer)
  }, [ready, store.workspace, flush])
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') void flush() }
    const onUnload = (event: BeforeUnloadEvent) => {
      if (latest.current !== saved.current) { event.preventDefault(); event.returnValue = ''; void flush() }
    }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('beforeunload', onUnload)
    return () => { document.removeEventListener('visibilitychange', onHide); window.removeEventListener('beforeunload', onUnload) }
  }, [flush])
  const commitImport = async (next: Workspace) => {
    if (loadBlocked.current) throw new Error('本地数据尚未成功读取，导入已暂停以保护原数据')
    importing.current = true
    try {
      await enqueue(next)
      saved.current = next; latest.current = next
      store.setWorkspace(next); setError(''); setStatus('saved')
    } finally { importing.current = false }
  }
  const retryLoad = async () => {
    if (!loadBlocked.current) return
    importing.current = true; setStatus('loading')
    try {
      const original = await backend.load()
      const hasEdits = latest.current !== saved.current
      const next = original && hasEdits ? { ...original, boards: [...original.boards, ...latest.current.boards], assets: [...original.assets, ...latest.current.assets], activeBoardId: latest.current.activeBoardId } : original ?? latest.current
      latest.current = next; store.setWorkspace(next)
      loadBlocked.current = false
      await enqueue(next)
      saved.current = next; setError(''); setStatus('saved')
    } catch (cause) {
      setError(`恢复失败，请保留当前导出备份后再重试。${cause instanceof Error ? cause.message : ''}`); setStatus('error')
    } finally { importing.current = false }
  }
  return { ready, status, error, flush, commitImport, retryLoad, loadFailed: loadBlocked.current }
}
