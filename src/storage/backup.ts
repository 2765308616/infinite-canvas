import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { normalizeHttpUrl, validateImage } from '../model/content'
import type { BoardDoc, Workspace } from '../model/types'
import { pruneAssets } from '../model/assets'

const fail = (message = '备份内容不完整或格式不正确'): never => { throw new Error(message) }
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : fail()
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : fail()
const string = (value: unknown): string => typeof value === 'string' ? value : fail()
const number = (value: unknown): number => typeof value === 'number' && Number.isFinite(value) ? value : fail()
function unique(values: string[]) { if (values.some((id) => !id) || new Set(values).size !== values.length) fail('备份中存在重复或空 ID') }

export function validateWorkspace(value: unknown): Workspace {
  const w = object(value)
  if (w.schemaVersion !== 1) fail('不支持此备份版本，请使用版本 1 的备份')
  const boards = array(w.boards)
  const assets = array(w.assets)
  if (!boards.length) fail('备份没有画布')
  const assetIds = assets.map((a) => string(object(a).id)); unique(assetIds)
  for (const item of assets) {
    const a = object(item)
    if (!(a.bytes instanceof Uint8Array) || !['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(string(a.mimeType))) fail('图片数据无效')
  }
  const allIds: string[] = []
  for (const item of boards) {
    const b = object(item)
    allIds.push(string(b.id)); string(b.title); number(b.updatedAt)
    if (b.schemaVersion !== 1) fail('画布版本不支持')
    const viewport = object(b.viewport)
    number(viewport.x); number(viewport.y)
    if (number(viewport.zoom) < 0.2 || number(viewport.zoom) > 2.5) fail('视图缩放无效')
    const cards = array(b.cards).map(object)
    const cardIds = cards.map((c) => string(c.id)); unique(cardIds); allIds.push(...cardIds)
    const groups = array(b.groups).map(object)
    const groupIds = groups.map((g) => { string(g.title); return string(g.id) }); unique(groupIds); allIds.push(...groupIds)
    for (const c of cards) {
      number(c.x); number(c.y)
      if (number(c.width) < 150 || number(c.height) < 80) fail('卡片尺寸无效')
      if (!['cream','rose','mint','sky','lavender'].includes(string(c.color))) fail('卡片颜色无效')
      if (c.groupId !== undefined && !groupIds.includes(string(c.groupId))) fail('分组引用缺失')
      if (c.type === 'text') string(c.text)
      else if (c.type === 'link') { string(c.title); normalizeHttpUrl(string(c.url)) }
      else if (c.type === 'image') { string(c.alt); if (!assetIds.includes(string(c.assetId))) fail('图片资源缺失') }
      else fail('卡片类型不支持')
    }
    const hs = array(b.hierarchies).map(object)
    unique(hs.map((h) => string(h.nodeId)))
    const map = new Map(hs.map((h) => [string(h.nodeId), h]))
    for (const h of hs) {
      if (!cardIds.includes(string(h.nodeId)) || !map.has(string(h.rootId)) || typeof h.collapsed !== 'boolean' || !Number.isInteger(number(h.order)) || number(h.order) < 0) fail('导图结构无效')
      const seen = new Set<string>()
      let cursor = h
      while (cursor.parentId !== null) {
        const id = string(cursor.nodeId)
        if (seen.has(id)) fail('导图不能循环连接')
        seen.add(id)
        const parent = map.get(string(cursor.parentId))
        if (!parent) fail('导图父节点缺失')
        cursor = parent!
      }
      if (cursor.nodeId !== h.rootId) fail('导图根节点不一致')
    }
    const rs = array(b.relations).map(object)
    const relationIds = rs.map((r) => string(r.id)); unique(relationIds); allIds.push(...relationIds)
    for (const r of rs) {
      string(r.label)
      if (!cardIds.includes(string(r.fromId)) || !cardIds.includes(string(r.toId)) || r.fromId === r.toId) fail('连线引用无效')
    }
  }
  unique(allIds)
  if (!boards.some((b) => object(b).id === string(w.activeBoardId))) fail('当前画布缺失')
  return value as Workspace
}

export async function exportBackup(workspace: Workspace): Promise<Blob> {
  workspace = pruneAssets(workspace)
  const files: Record<string, Uint8Array> = {}
  const manifest = { ...workspace, assets: workspace.assets.map((a) => ({ id: a.id, mimeType: a.mimeType, path: `assets/${a.id}` })) }
  files['manifest.json'] = strToU8(JSON.stringify(manifest))
  for (const asset of workspace.assets) files[`assets/${asset.id}`] = asset.bytes
  return new Blob([Uint8Array.from(zipSync(files, { level: 6 }))], { type: 'application/zip' })
}

export async function importBackup(blob: Blob, current: Workspace): Promise<Workspace> {
  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(new Uint8Array(await blob.arrayBuffer()))
  } catch { return fail('无法读取 ZIP 备份，文件可能已损坏或超出浏览器内存') }
  if (!files['manifest.json']) fail('缺少 manifest.json')
  let raw: Record<string, unknown>
  try { raw = object(JSON.parse(strFromU8(files['manifest.json']))) } catch { return fail('备份清单损坏') }
  if (raw.schemaVersion !== 1) fail('不支持此备份版本')
  const assets = await Promise.all(array(raw.assets).map(async (value) => {
    const a = object(value)
    const bytes = files[string(a.path)]
    if (!bytes) fail('备份中缺少图片文件')
    const mimeType = string(a.mimeType)
    await validateImage(new File([Uint8Array.from(bytes)], 'image', { type: mimeType }))
    return { id: string(a.id), mimeType, bytes }
  }))
  const imported = validateWorkspace({ ...raw, assets })
  const assetMap = new Map(assets.map((a) => [a.id, crypto.randomUUID()]))
  const boards: BoardDoc[] = imported.boards.map((b) => {
    const cardMap = new Map(b.cards.map((c) => [c.id, crypto.randomUUID()]))
    const groupMap = new Map(b.groups.map((g) => [g.id, crypto.randomUUID()]))
    return { ...b, id: crypto.randomUUID(), title: `${b.title}（导入）`, cards: b.cards.map((c) => ({ ...c, id: cardMap.get(c.id)!, groupId: c.groupId ? groupMap.get(c.groupId) : undefined, ...(c.type === 'image' ? { assetId: assetMap.get(c.assetId)! } : {}) })), groups: b.groups.map((g) => ({ ...g, id: groupMap.get(g.id)! })), hierarchies: b.hierarchies.map((h) => ({ ...h, nodeId: cardMap.get(h.nodeId)!, rootId: cardMap.get(h.rootId)!, parentId: h.parentId ? cardMap.get(h.parentId)! : null })), relations: b.relations.map((r) => ({ ...r, id: crypto.randomUUID(), fromId: cardMap.get(r.fromId)!, toId: cardMap.get(r.toId)! })) }
  })
  return { ...current, boards: [...current.boards, ...boards], assets: [...current.assets, ...assets.map((a) => ({ ...a, id: assetMap.get(a.id)! }))], activeBoardId: boards[0].id }
}
