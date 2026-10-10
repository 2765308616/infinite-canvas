import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow, Background, BackgroundVariant, Controls, MiniMap, ReactFlowProvider, useReactFlow,
  type Edge, type NodeChange, type EdgeChange, type Connection
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import CardNode, { type CardFlowNode } from './CardNode'
import GroupNode, { type GroupFlowNode } from './GroupNode'
import type { useCanvasStore } from '../store/useCanvasStore'
import { visibleCardIds, visibleRelations } from '../model/operations'

const nodeTypes = { card: CardNode, groupBackdrop: GroupNode }
type Store = ReturnType<typeof useCanvasStore>
type FlowNode = CardFlowNode | GroupFlowNode

function CanvasInner({ store }: { store: Store }) {
  const flow = useReactFlow<FlowNode, Edge>()
  const { board, selection } = store
  const lastFocus = useRef<typeof store.focusRequest>(null)
  const visible = useMemo(() => visibleCardIds(board), [board])
  const [imageUrls, setImageUrls] = useState(new Map<string, string>())
  useEffect(() => {
    const urls = new Map(store.workspace.assets.map((asset) => [asset.id, URL.createObjectURL(new Blob([Uint8Array.from(asset.bytes)], { type: asset.mimeType }))]))
    setImageUrls(urls)
    return () => { for (const url of urls.values()) URL.revokeObjectURL(url) }
  }, [store.workspace.assets])
  useEffect(() => {
    if (!store.focusRequest || lastFocus.current === store.focusRequest) return
    lastFocus.current = store.focusRequest
    const card = board.cards.find((c) => c.id === store.focusRequest!.id)
    if (card) flow.setCenter(card.x + card.width / 2, card.y + card.height / 2, { zoom: 1, duration: 300 })
  }, [store.focusRequest, flow, board.cards])
  const groupNodes = useMemo<GroupFlowNode[]>(() => board.groups.flatMap((group) => {
    const members = board.cards.filter((card) => card.groupId === group.id && visible.has(card.id))
    if (!members.length) return []
    const x = Math.min(...members.map((card) => card.x)) - 25
    const y = Math.min(...members.map((card) => card.y)) - 45
    const maxX = Math.max(...members.map((card) => card.x + card.width))
    const maxY = Math.max(...members.map((card) => card.y + card.height))
    return [{ id: `grp-${group.id}`, type: 'groupBackdrop', position: { x, y }, width: maxX - x + 25, height: maxY - y + 25,
      zIndex: -1, selectable: false, dragHandle: '.group-backdrop__header', data: { title: group.title, count: members.length } }]
  }), [board.cards, board.groups, visible])
  const cardNodes = useMemo<CardFlowNode[]>(() => board.cards.filter((card) => visible.has(card.id)).map((card) => ({
    id: card.id,
    type: 'card',
    position: { x: card.x, y: card.y },
    width: card.width,
    height: card.height,
    selected: selection.cardIds.includes(card.id),
    data: {
      card,
      onTextChange: (id, text) => store.updateCard(id, (current) => current.type === 'text' ? { ...current, text } : current),
      onResize: store.resizeCard,
      imageUrl: card.type === 'image' ? imageUrls.get(card.assetId) : undefined,
      onEditStart: store.beginTransaction,
      onEditEnd: store.endTransaction,
      hierarchy: board.hierarchies.find((entry) => entry.nodeId === card.id),
      childCount: board.hierarchies.filter((entry) => entry.parentId === card.id).length,
      onAddChild: store.addChild,
      onToggleCollapse: store.toggleCollapse
    }
  })), [board, visible, selection.cardIds, store.updateCard, store.resizeCard, store.addChild, store.toggleCollapse, imageUrls])
  const nodes = useMemo<FlowNode[]>(() => [...groupNodes, ...cardNodes], [groupNodes, cardNodes])

  const edges = useMemo<Edge[]>(() => [
    ...board.hierarchies.filter((entry) => entry.parentId && visible.has(entry.nodeId) && visible.has(entry.parentId)).map((entry): Edge => ({
      id: `hier-${entry.nodeId}`, source: entry.parentId!, target: entry.nodeId,
      type: 'smoothstep', selectable: false,
      style: { stroke: '#8890db', strokeWidth: 2.5 }
    })),
    ...visibleRelations(board).map((relation): Edge => ({
    id: relation.id,
    source: relation.fromId,
    target: relation.toId,
    label: relation.label || undefined,
    type: 'smoothstep',
    selected: selection.relationIds.includes(relation.id),
    style: { stroke: '#7a86a0', strokeWidth: 2 }
  }))], [board, visible, selection.relationIds])

  const onNodesChange = (changes: NodeChange<FlowNode>[]) => {
    const moves: { id: string; position: { x: number; y: number } }[] = []
    for (const change of changes) {
      if (change.type === 'position' && change.position) {
        if (change.id.startsWith('grp-')) {
          const old = groupNodes.find((node) => node.id === change.id)
          if (old) store.moveGroup(change.id.slice(4), { x: change.position.x - old.position.x, y: change.position.y - old.position.y })
        } else moves.push({ id: change.id, position: change.position })
      }
      if (change.type === 'select' && !change.id.startsWith('grp-')) {
        store.setSelection((current) => ({
          ...current,
          cardIds: change.selected
            ? [...new Set([...current.cardIds, change.id])]
            : current.cardIds.filter((id) => id !== change.id)
        }))
      }
    }
    if (moves.length) store.moveCards(moves)
  }

  const onEdgesChange = (changes: EdgeChange<Edge>[]) => {
    for (const change of changes) {
      if (change.type === 'select') {
        store.setSelection((current) => ({
          ...current,
          relationIds: change.selected
            ? [...new Set([...current.relationIds, change.id])]
            : current.relationIds.filter((id) => id !== change.id)
        }))
      }
    }
  }

  const onConnect = (connection: Connection) => {
    if (connection.source && connection.target) store.connect(connection.source, connection.target)
  }

  return (
    <div className="canvas-area">
      <ReactFlow<FlowNode, Edge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStart={store.beginTransaction}
        onNodeDragStop={store.endTransaction}
        onPaneClick={() => store.setSelection({ cardIds: [], relationIds: [] })}
        onDoubleClick={(event) => {
          if ((event.target as HTMLElement).classList.contains('react-flow__pane')) {
            store.addText(flow.screenToFlowPosition({ x: event.clientX, y: event.clientY }))
          }
        }}
        onMoveEnd={(_, viewport) => store.setViewport(viewport)}
        defaultViewport={board.viewport}
        minZoom={0.2}
        maxZoom={2.5}
        panOnDrag
        selectionOnDrag={false}
        multiSelectionKeyCode="Shift"
        zoomOnDoubleClick={false}
        panOnScroll={false}
        deleteKeyCode={null}
        onlyRenderVisibleElements
        proOptions={{ hideAttribution: false }}
      >
        <Background color="#d5dceb" gap={28} size={1.4} variant={BackgroundVariant.Dots} />
        <Controls position="bottom-right" showInteractive={false} />
        <MiniMap position="bottom-left" pannable zoomable nodeColor="#6b7fd7" maskColor="rgba(236,239,249,.6)" />
      </ReactFlow>
      {board.cards.length === 0 && (
        <div className="empty-state">
          <div className="empty-state__mark">✳</div>
          <p className="eyebrow">一切从一个想法开始</p>
          <h2>给灵感一个落脚点</h2>
          <p>双击画布，或点击下方按钮，放下你的第一张卡片。</p>
          <button className="primary-button" onClick={() => store.addText({ x: 80, y: 40 })}>＋ 创建第一张卡片</button>
        </div>
      )}
    </div>
  )
}

export default function Canvas({ store }: { store: Store }) {
  return <ReactFlowProvider><CanvasInner store={store} /></ReactFlowProvider>
}
