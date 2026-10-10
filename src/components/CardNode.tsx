import { Handle, NodeResizer, Position, type Node, type NodeProps } from '@xyflow/react'
import { ChevronDown, ChevronRight, Plus } from 'lucide-react'
import type { Card, Hierarchy } from '../model/types'

export type CardNodeData = Record<string, unknown> & {
  card: Card
  onTextChange: (id: string, text: string) => void
  hierarchy?: Hierarchy
  childCount: number
  onAddChild: (id: string) => void
  onToggleCollapse: (id: string) => void
  onResize: (id: string, size: { width: number; height: number }) => void
  imageUrl?: string
  onEditStart: () => void
  onEditEnd: () => void
}
export type CardFlowNode = Node<CardNodeData, 'card'>

const cardLabels: Record<Card['type'], string> = { text: '想法', image: '图片', link: '链接' }

export default function CardNode({ id, data, selected }: NodeProps<CardFlowNode>) {
  const { card, onTextChange, hierarchy, childCount, onAddChild, onToggleCollapse, onResize, imageUrl } = data
  return (
    <div className={`canvas-card canvas-card--${card.color} ${selected ? 'is-selected' : ''} ${hierarchy ? 'is-mindmap' : ''}`} style={{ width: card.width, minHeight: card.height }}>
      <NodeResizer isVisible={selected} minWidth={150} minHeight={80} color="#7076d4" onResizeStart={data.onEditStart} onResizeEnd={(_, size) => { onResize(id, { width: size.width, height: size.height }); data.onEditEnd() }} />
      <div className="canvas-card__meta"><span className="canvas-card__dot" />{hierarchy ? (hierarchy.parentId ? '分支想法' : '中心主题') : cardLabels[card.type]}</div>
      {card.type === 'text' && (
        <textarea
          className="canvas-card__text nodrag nowheel"
          value={card.text}
          onChange={(event) => onTextChange(id, event.target.value)}
          onFocus={data.onEditStart}
          onBlur={data.onEditEnd}
          placeholder="输入一个想法…"
          aria-label="卡片内容"
          spellCheck={false}
        />
      )}
      {card.type === 'link' && (
        <div className="canvas-card__link">
          <a href={card.url} target="_blank" rel="noopener noreferrer" className="nodrag" onClick={(event) => event.stopPropagation()}>{card.title || '新链接'} ↗</a>
          <span>{card.url}</span>
        </div>
      )}
      {card.type === 'image' && <div className="canvas-card__image">{imageUrl ? <img src={imageUrl} alt={card.alt} draggable={false} /> : '图片未找到'}</div>}
      <div className="canvas-card__actions nodrag">
        {childCount > 0 && <button type="button" title={hierarchy?.collapsed ? '展开分支' : '折叠分支'} aria-label={hierarchy?.collapsed ? '展开分支' : '折叠分支'} onClick={(event) => { event.stopPropagation(); onToggleCollapse(id) }}>{hierarchy?.collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}<span>{childCount}</span></button>}
        <button type="button" title="添加子想法" aria-label="添加子想法" onClick={(event) => { event.stopPropagation(); onAddChild(id) }}><Plus size={14} /></button>
      </div>
      <Handle id="target" type="target" position={Position.Left} />
      <Handle id="source" type="source" position={Position.Right} />
    </div>
  )
}
