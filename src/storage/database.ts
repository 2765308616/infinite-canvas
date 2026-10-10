import { openDB } from 'idb'
import type { Workspace } from '../model/types'
import { validateWorkspace } from './backup'
import { pruneAssets } from '../model/assets'

const database = () => openDB('infinite-canvas', 1, { upgrade(db) { db.createObjectStore('workspace') } })
export async function loadWorkspace(): Promise<Workspace | null> {
  const db = await database()
  try { const value = await db.get('workspace', 'current'); return value ? pruneAssets(validateWorkspace(value)) : null }
  finally { db.close() }
}
export async function saveWorkspace(workspace: Workspace): Promise<void> {
  const db = await database()
  try {
    const transaction = db.transaction('workspace', 'readwrite')
    await transaction.store.put(pruneAssets(workspace), 'current')
    await transaction.done
  } finally { db.close() }
}
