import { useEffect, useState } from 'react'
import { ExternalLink, GitBranchPlus, Palette, Unlink2, X } from 'lucide-react'
import type { useCanvasStore } from '../store/useCanvasStore'
import type { CardColor } from '../model/types'

type Store = ReturnType<typeof useCanvasStore>
const colors: { id: CardColor; label: string }[] = [
  { id: 'cream', label: '奶油' }, { id: 'rose', label: '樱粉' }, { id: 'mint', label: '薄荷' },
  { id: 'sky', label: '浅蓝' }, { id: 'lavender', label: '淡紫' }
]

export default function Inspector({ store }: { store: Store }) {
  const card = store.board.cards.find((item) => item.id === store.selection.cardIds[0])
  const relation = !card ? store.board.relations.find((item) => item.id === store.selection.relationIds[0]) : undefined
  const hierarchy = store.board.hierarchies.find((item) => item.nodeId === card?.id)
  const group = store.board.groups.find((item) => item.id === card?.groupId)
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    setTitle(card?.type === 'link' ? card.title : '')
    setUrl(card?.type === 'link' ? card.url : '')
    setError('')
  }, [card?.id])
  if (!card && !relation) return null
  return <aside className="inspector" aria-label="属性面板">
    <div className="inspector__head"><strong>{card ? '卡片属性' : '连线属性'}</strong><button className="icon-button" aria-label="关闭属性面板" onClick={() => store.setSelection({ cardIds: [], relationIds: [] })}><X size={17} /></button></div>
    {card ? <>
      <div className="inspector__section"><span className="inspector__label">类型</span><strong>{card.type === 'text' ? '文字卡片' : card.type === 'image' ? '图片卡片' : '链接卡片'}</strong></div>
      <div className="inspector__section"><span className="inspector__label"><Palette size={14} /> 卡片颜色</span><div className="color-options">{colors.map((color) => <button key={color.id} className={`color-swatch color-swatch--${color.id} ${card.color === color.id ? 'is-active' : ''}`} aria-label={color.label} title={color.label} onClick={() => store.updateCard(card.id, (current) => ({ ...current, color: color.id }))} />)}</div></div>
      {card.type === 'link' && <form className="inspector__section inspector__form" onSubmit={(event) => { event.preventDefault(); try { store.editLink(card.id, title, url); setError('') } catch (cause) { setError(cause instanceof Error ? cause.message : '链接无效') } }}><label>标题<input value={title} onChange={(event) => setTitle(event.target.value)} /></label><label>地址<input value={url} onChange={(event) => setUrl(event.target.value)} /></label>{error && <p className="form-error">{error}</p>}<button type="submit">保存链接</button><a href={card.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /> 打开链接</a></form>}
      {card.type === 'image' && <div className="inspector__section"><span className="inspector__label">图片说明</span><input value={card.alt} onFocus={store.beginTransaction} onBlur={store.endTransaction} onChange={(event) => store.updateCard(card.id, (current) => current.type === 'image' ? { ...current, alt: event.target.value } : current)} aria-label="图片说明" /><label className="file-label">替换图片<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={async (event) => { const file = event.target.files?.[0]; if (file) try { await store.replaceImage(card.id, file); setError('') } catch (e) { setError(e instanceof Error ? e.message : '替换失败') } event.target.value = '' }} /></label></div>}
      <div className="inspector__section"><label>上级想法<select aria-label="上级想法" value={hierarchy?.parentId ?? ''} onChange={(event) => { try { if (event.target.value) store.reparent(card.id, event.target.value); else store.detach(card.id); setError('') } catch (e) { setError(e instanceof Error ? e.message : '无法移动分支') } }}><option value="">无（独立）</option>{store.board.cards.filter((c) => c.id !== card.id).map((c) => <option key={c.id} value={c.id}>{c.type === 'text' ? c.text || '空白想法' : c.type === 'link' ? c.title : c.alt}</option>)}</select></label></div>
      {group && <div className="inspector__section"><label>分组名称<input aria-label="分组名称" value={group.title} onFocus={store.beginTransaction} onBlur={store.endTransaction} onChange={(event) => store.renameGroup(group.id, event.target.value)} /></label></div>}
      {error && card.type !== 'link' && <p className="form-error">{error}</p>}
      <div className="inspector__section inspector__actions"><button onClick={() => store.addChild(card.id)}><GitBranchPlus size={15} /> 添加子想法</button>{hierarchy && <button onClick={() => store.layoutBranch(card.id)}>排列此分支</button>}{hierarchy?.parentId && <button onClick={() => store.detach(card.id)}>独立为新导图</button>}{group && <button onClick={() => store.ungroup(group.id)}><Unlink2 size={15} /> 解散「{group.title}」</button>}</div>
    </> : relation && <div className="inspector__section"><label>连线说明<input value={relation.label} onFocus={store.beginTransaction} onBlur={store.endTransaction} onChange={(event) => store.updateRelation(relation.id, (current) => ({ ...current, label: event.target.value }))} aria-label="连线说明" /></label></div>}
  </aside>
}
