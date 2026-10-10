import { describe, expect, it } from 'vitest'
import { unzipSync, zipSync, strToU8 } from 'fflate'
import { createBoard } from '../model/operations'
import type { Workspace } from '../model/types'
import { exportBackup, importBackup } from './backup'

function fixture(): Workspace {
  const board = createBoard('知识库')
  board.cards.push({ id: 'picture', type: 'image', assetId: 'asset', alt: '图', x: 1, y: 2, width: 200, height: 100, color: 'sky' })
  return { schemaVersion: 1, boards: [board], activeBoardId: board.id, assets: [{ id: 'asset', mimeType: 'image/png', bytes: Uint8Array.of(137,80,78,71,13,10,26,10) }] }
}
describe('complete backup', () => {
  it('omits unreachable assets from a backup', async () => {
    const w = fixture()
    w.assets.push({ id: 'unused', mimeType: 'image/png', bytes: Uint8Array.of(1,2,3) })
    const result = await importBackup(await exportBackup(w), { ...w, boards: [], assets: [] })
    expect(result.assets).toHaveLength(1)
  })
  it('round trips bytes and appends remapped boards without mutating the current workspace', async () => {
    const current = fixture()
    const backup = await exportBackup(current)
    const next = await importBackup(backup, current)
    expect(next.boards).toHaveLength(2)
    expect(current.boards).toHaveLength(1)
    expect(next.boards[1].id).not.toBe(current.boards[0].id)
    expect(next.boards[1].cards[0].id).not.toBe('picture')
    expect(next.assets[1].bytes).toEqual(current.assets[0].bytes)
    expect(next.boards[1].cards[0]).toMatchObject({ assetId: next.assets[1].id })
  })
  it('rejects a missing image without partially importing anything', async () => {
    const current = fixture()
    const files = unzipSync(new Uint8Array(await (await exportBackup(current)).arrayBuffer()))
    delete files['assets/asset']
    await expect(importBackup(new Blob([Uint8Array.from(zipSync(files))]), current)).rejects.toThrow()
    expect(current.boards).toHaveLength(1)
  })
  it('rejects corrupt and future-version backups', async () => {
    const current = fixture()
    await expect(importBackup(new Blob(['not zip']), current)).rejects.toThrow()
    const files = { 'manifest.json': strToU8(JSON.stringify({ schemaVersion: 2 })) }
    await expect(importBackup(new Blob([Uint8Array.from(zipSync(files))]), current)).rejects.toThrow(/版本/)
  })
  it('rejects cyclic hierarchy and unsafe links before import', async () => {
    const current = fixture()
    const bad = fixture()
    bad.boards[0].cards = [{ id: 'x', type: 'link', url: 'javascript:alert(1)', title: 'x', x: 0, y: 0, width: 200, height: 100, color: 'cream' }]
    await expect(importBackup(await exportBackup(bad), current)).rejects.toThrow()
    bad.boards[0].cards = [{ id: 'x', type: 'text', text: 'x', x: 0, y: 0, width: 200, height: 100, color: 'cream' }]
    bad.boards[0].hierarchies = [{ nodeId: 'x', rootId: 'x', parentId: 'x', collapsed: false, order: 0 }]
    await expect(importBackup(await exportBackup(bad), current)).rejects.toThrow()
  })
})
