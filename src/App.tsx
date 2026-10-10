import { useEffect, useRef, useState } from 'react'
import { Cloud, Search, Download, Upload, PanelLeft, X } from 'lucide-react'
import Canvas from './components/Canvas'
import Sidebar from './components/Sidebar'
import Toolbar from './components/Toolbar'
import Inspector from './components/Inspector'
import SearchDialog from './components/SearchDialog'
import { useCanvasStore } from './store/useCanvasStore'
import { usePersistence } from './storage/usePersistence'
import { exportBackup, importBackup } from './storage/backup'

const statusLabels = { loading: '读取中', pending: '等待保存', saving: '保存中', saved: '已保存到本机', error: '保存遇到问题' }
export default function App() {
  const store = useCanvasStore()
  const persistence = usePersistence(store)
  const [searchOpen, setSearchOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const importInput = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (busy || !persistence.ready || persistence.status === 'loading') return
      if (event.key === 'Escape') { setSearchOpen(false); setHelpOpen(false); return }
      const target = event.target as HTMLElement
      if (target.closest('input,textarea,select,[contenteditable="true"]') || searchOpen || helpOpen) return
      const modifier = event.ctrlKey || event.metaKey
      const key = event.key.toLowerCase()
      if (modifier && key === 'k') { event.preventDefault(); setSearchOpen(true) }
      else if (modifier && key === 'z') { event.preventDefault(); event.shiftKey ? store.redo() : store.undo() }
      else if (modifier && key === 'y') { event.preventDefault(); store.redo() }
      else if (modifier && key === 'c' && store.selection.cardIds.length) { event.preventDefault(); store.copy() }
      else if (modifier && key === 'v') { event.preventDefault(); store.paste() }
      else if (modifier && key === 's') { event.preventDefault(); void persistence.flush() }
      else if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); store.deleteSelection() }
      else if (!modifier && !event.altKey && !event.shiftKey && !target.closest('button,a') && store.selection.cardIds[0] && event.key === 'Tab') { event.preventDefault(); store.addChild(store.selection.cardIds[0]) }
      else if (!modifier && !event.altKey && !event.shiftKey && !target.closest('button,a') && store.selection.cardIds[0] && event.key === 'Enter') { event.preventDefault(); store.addSibling(store.selection.cardIds[0]) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [store, persistence, busy, searchOpen, helpOpen])
  const download = async () => {
    try {
      store.endTransaction()
      const blob = await exportBackup(store.workspace)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url; anchor.download = `无界画布-${new Date().toISOString().slice(0, 10)}.zip`; anchor.click()
      setTimeout(() => URL.revokeObjectURL(url), 30000)
      setMessage('已导出全部画布和图片的 ZIP 备份')
    } catch (e) { setMessage(e instanceof Error ? e.message : '导出失败') }
  }
  return <div className={`app-shell ${sidebarOpen ? '' : 'sidebar-hidden'}`}>
    {sidebarOpen && <Sidebar store={store} onCollapse={() => setSidebarOpen(false)} onHelp={() => setHelpOpen(true)} />}
    <main className="main-area">
      <header className="topbar">
        <div className="topbar__title"><button className="icon-button" aria-label={sidebarOpen ? '隐藏画布列表' : '显示画布列表'} onClick={() => setSidebarOpen(!sidebarOpen)}><PanelLeft size={18} /></button><span className="workspace-breadcrumb">工作空间 /</span><input value={store.board.title} onFocus={store.beginTransaction} onBlur={store.endTransaction} onChange={(event) => store.renameBoard(event.target.value)} aria-label="画布标题" /></div>
        <div className="topbar__actions"><button className={`save-indicator ${persistence.status === 'error' ? 'has-error' : ''}`} onClick={() => void (persistence.loadFailed ? persistence.retryLoad() : persistence.flush())} title="自动保存到本机，点击重试"><Cloud size={15} /> {statusLabels[persistence.status]}</button><button className="topbar__search" aria-label="搜索画布" onClick={() => setSearchOpen(true)}><Search size={16} /><span>搜索</span><kbd>Ctrl K</kbd></button><button className="icon-button" title="导入 ZIP 备份" aria-label="导入备份" onClick={() => importInput.current?.click()}><Upload size={18} /></button><button className="share-button" onClick={() => void download()}><Download size={16} /> 导出</button></div>
      </header>
      <div className="workspace-stage" key={store.board.id}><Canvas store={store} /><div className="stage-label"><span className="stage-label__dot" /> 无限画布 <span>·</span> {store.board.cards.length} 张卡片</div><Inspector store={store} /><Toolbar store={store} /></div>
    </main>
    <input ref={importInput} type="file" accept=".zip,application/zip" hidden aria-label="选择备份文件" onChange={async (event) => {
      const file = event.target.files?.[0]; if (!file) return
      setBusy(true)
      try {
        store.endTransaction()
        const next = await importBackup(file, store.workspace)
        await persistence.commitImport(next)
        setMessage('导入完成，备份内容已添加为新画布')
      } catch (e) { setMessage(`导入失败，现有画布保持完整。${e instanceof Error ? e.message : ''}`) }
      finally { setBusy(false); event.target.value = '' }
    }} />
    {(persistence.error || message) && <div className={`app-notice ${persistence.error ? 'has-error' : ''}`} role="alert"><span>{persistence.error || message}</span>{persistence.loadFailed && <button onClick={() => void persistence.retryLoad()}>重试读取</button>}<button aria-label="关闭提示" onClick={() => setMessage('')} disabled={!!persistence.error}><X size={15} /></button></div>}
    {searchOpen && <SearchDialog store={store} onClose={() => setSearchOpen(false)} />}
    {helpOpen && <div className="modal-backdrop" onClick={() => setHelpOpen(false)}><section className="help-dialog" role="dialog" aria-modal="true" aria-label="使用帮助" onClick={(e) => e.stopPropagation()}><button className="icon-button help-close" aria-label="关闭帮助" onClick={() => setHelpOpen(false)}><X size={18} /></button><p className="eyebrow">你的个人灵感空间</p><h2>自由放下，慢慢连接</h2><p>拖动空白处平移，滚轮缩放；Shift 拖动框选，Shift 点击多选。拖动卡片圆点创建关联线。属性面板可以更改导图上级和颜色。</p><div className="shortcut-list">{[['Ctrl Z / Y','撤销 / 重做'],['Ctrl C / V','复制 / 粘贴选中卡片及分支'],['Tab / Enter','新建子想法 / 同级想法'],['Delete','删除选中内容'],['Ctrl K','搜索当前画布'],['Ctrl S','立即保存']].map(([key,label]) => <div key={key}><kbd>{key}</kbd><span>{label}</span></div>)}</div><p>文字输入时保留正常的编辑快捷键。图片支持 PNG、JPEG、WebP、GIF，单张最大 20 MB。</p><p>数据保存在当前浏览器的本机存储中。清理浏览器数据或更换浏览器前，请先导出 ZIP 备份。导入会添加新画布。不要在多个标签页同时编辑同一工作区。</p></section></div>}
    {(!persistence.ready || persistence.status === 'loading' || busy) && <div className="loading-overlay">{busy ? '正在验证并导入备份…' : '正在读取你的画布…'}</div>}
  </div>
}
