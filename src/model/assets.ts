import type { BoardDoc, Workspace } from './types'

export function pruneAssets(workspace: Workspace, retained: BoardDoc[] = []): Workspace {
  const ids = new Set([...workspace.boards, ...retained].flatMap((b) => b.cards.flatMap((c) => c.type === 'image' ? [c.assetId] : [])))
  const assets = workspace.assets.filter((a) => ids.has(a.id))
  return assets.length === workspace.assets.length ? workspace : { ...workspace, assets }
}
