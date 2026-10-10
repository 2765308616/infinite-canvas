import { useState } from 'react'
import { Search, X } from 'lucide-react'
import type { useCanvasStore } from '../store/useCanvasStore'
import { searchCards } from '../model/history'

export default function SearchDialog({ store, onClose }: { store: ReturnType<typeof useCanvasStore>; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const ids = searchCards(store.board, query)
  const open = (id: string) => { store.focusCard(id); onClose() }
  return <div className="modal-backdrop" onClick={onClose}><section className="search-dialog" role="dialog" aria-modal="true" aria-label="搜索当前画布" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Escape') onClose(); if (e.key === 'Enter' && ids[0]) open(ids[0]) }}>
    <div className="search-dialog__input"><Search size={19} /><input aria-label="搜索关键词" autoFocus placeholder="搜索当前画布中的想法…" value={query} onChange={(e) => setQuery(e.target.value)} /><button aria-label="关闭搜索" className="icon-button" onClick={onClose}><X size={18} /></button></div>
    <div className="search-results">{ids.map((id) => { const c = store.board.cards.find((card) => card.id === id)!; return <button key={id} onClick={() => open(id)}><span>{c.type === 'text' ? '想法' : c.type === 'image' ? '图片' : '链接'}</span><strong>{c.type === 'text' ? c.text : c.type === 'image' ? c.alt : c.title}</strong><small>定位 ↗</small></button> })}{!ids.length && <p>{query.trim() ? '没有找到匹配的卡片' : '输入关键词，按 Enter 定位第一条结果'}</p>}</div>
  </section></div>
}
