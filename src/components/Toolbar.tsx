import { useRef, useState } from 'react'
import { FolderPlus, GitBranchPlus, ImagePlus, LayoutTemplate, Link2, Plus, Trash2, X, Undo2, Redo2, Copy, ClipboardPaste } from 'lucide-react'
import type { useCanvasStore } from '../store/useCanvasStore'
import { centerCardPosition } from '../model/viewport'

type Store = ReturnType<typeof useCanvasStore>

export default function Toolbar({ store }: { store: Store }) {
  const imageInput = useRef<HTMLInputElement>(null)
  const [panel, setPanel] = useState<'link' | 'group' | null>(null)
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const paneCenter = () => {
    const pane = document.querySelector('.canvas-area')?.getBoundingClientRect()
    return pane ? centerCardPosition(store.board.viewport, pane) : { x: 0, y: 0 }
  }
  const addAtCenter = () => {
    store.addText(paneCenter())
  }
  const addMindMap = () => {
    store.addMindMap(paneCenter())
  }
  const selectedTree = store.selection.cardIds
    .map((id) => store.board.hierarchies.find((entry) => entry.nodeId === id))
    .find(Boolean)
  return <>
    {panel && <form className="tool-popover" onSubmit={(event) => {
      event.preventDefault()
      try {
        if (panel === 'link') store.addLink(title, url, paneCenter())
        else store.createGroup(title)
        setPanel(null); setTitle(''); setUrl(''); setError('')
      } catch (cause) { setError(cause instanceof Error ? cause.message : '操作失败') }
    }}>
      <div className="tool-popover__title">{panel === 'link' ? '添加链接卡片' : '创建分组'}<button type="button" onClick={() => setPanel(null)} aria-label="关闭"><X size={15} /></button></div>
      <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={panel === 'link' ? '链接标题' : '分组名称'} aria-label={panel === 'link' ? '链接标题' : '分组名称'} autoFocus />
      {panel === 'link' && <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com" aria-label="链接地址" />}
      {error && <p className="form-error">{error}</p>}
      <button type="submit" className="primary-button">创建</button>
    </form>}
    {error && !panel && <div className="tool-error" role="alert">{error}<button onClick={() => setError('')} aria-label="关闭错误">×</button></div>}
    <input ref={imageInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" style={{ display: 'none' }} aria-label="选择图片" onChange={async (event) => {
      const file = event.target.files?.[0]
      if (!file) return
      try { await store.addImage(file, paneCenter()); setError('') }
      catch (cause) { setError(cause instanceof Error ? cause.message : '添加图片失败') }
      event.target.value = ''
    }} />
    <div className="tool-dock" role="toolbar" aria-label="画布工具">
      <button className="tool-dock__button" title="撤销 Ctrl Z" aria-label="撤销" disabled={!store.canUndo} onClick={store.undo}><Undo2 size={18} /></button>
      <button className="tool-dock__button" title="重做 Ctrl Y" aria-label="重做" disabled={!store.canRedo} onClick={store.redo}><Redo2 size={18} /></button>
      <button className="tool-dock__button" title="复制 Ctrl C" aria-label="复制选中卡片" disabled={!store.selection.cardIds.length} onClick={store.copy}><Copy size={17} /></button>
      <button className="tool-dock__button" title="粘贴 Ctrl V" aria-label="粘贴卡片" disabled={!store.canPaste} onClick={store.paste}><ClipboardPaste size={17} /></button>
      <span className="tool-dock__divider" />
      <button className="tool-dock__add" onClick={addAtCenter}><Plus size={18} /> <span>文字卡片</span></button>
      <button className="tool-dock__button" onClick={addMindMap} title="新建思维导图" aria-label="新建思维导图"><GitBranchPlus size={18} /></button>
      <button className="tool-dock__button" onClick={() => imageInput.current?.click()} title="添加图片" aria-label="添加图片"><ImagePlus size={18} /></button>
      <button className="tool-dock__button" onClick={() => { setPanel('link'); setError('') }} title="添加链接" aria-label="添加链接"><Link2 size={18} /></button>
      <button className="tool-dock__button" onClick={() => { setPanel('group'); setError('') }} disabled={!store.selection.cardIds.length} title="组合选中卡片" aria-label="组合选中卡片"><FolderPlus size={18} /></button>
      <button className="tool-dock__button" onClick={() => selectedTree && store.layoutBranch(selectedTree.nodeId)} disabled={!selectedTree} title="排列选中分支" aria-label="排列选中分支"><LayoutTemplate size={18} /></button>
      <span className="tool-dock__divider" />
      <button className="tool-dock__button" onClick={store.deleteSelection} title="删除选中内容" aria-label="删除选中内容" disabled={!store.selection.cardIds.length && !store.selection.relationIds.length}><Trash2 size={18} /></button>
    </div>
  </>
}
