import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { loadWorkspace, saveWorkspace } from './database'
import { createBoard } from '../model/operations'

describe('local database', () => {
  it('atomically restores boards, viewport and image bytes after saving', async () => {
    const board = createBoard('持久化')
    board.viewport = { x: 12, y: 34, zoom: 1.2 }
    board.cards.push({ id: 'image', type: 'image', assetId: 'asset', alt: '图', x: 0, y: 0, width: 200, height: 100, color: 'sky' })
    const workspace = { schemaVersion: 1 as const, boards: [board], activeBoardId: board.id, assets: [{ id: 'asset', mimeType: 'image/png', bytes: Uint8Array.of(1,2,3) }] }
    await saveWorkspace(workspace)
    expect(await loadWorkspace()).toEqual(workspace)
  })
})
