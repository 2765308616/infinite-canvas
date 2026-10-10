export type CardColor = 'cream' | 'rose' | 'mint' | 'sky' | 'lavender'

type CardBase = {
  id: string
  x: number
  y: number
  width: number
  height: number
  color: CardColor
  groupId?: string
}

export type Card = CardBase & (
  | { type: 'text'; text: string }
  | { type: 'image'; assetId: string; alt: string }
  | { type: 'link'; url: string; title: string }
)

export type Hierarchy = {
  nodeId: string
  rootId: string
  parentId: string | null
  order: number
  collapsed: boolean
}

export type Relation = { id: string; fromId: string; toId: string; label: string }
export type Group = { id: string; title: string }
export type Viewport = { x: number; y: number; zoom: number }

export type BoardDoc = {
  schemaVersion: 1
  id: string
  title: string
  updatedAt: number
  cards: Card[]
  hierarchies: Hierarchy[]
  relations: Relation[]
  groups: Group[]
  viewport: Viewport
}

export type AssetRecord = { id: string; mimeType: string; bytes: Uint8Array }
export type Workspace = {
  schemaVersion: 1
  boards: BoardDoc[]
  assets: AssetRecord[]
  activeBoardId: string
}
