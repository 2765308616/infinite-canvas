import { LayoutGrid, PanelLeftClose, Plus, Settings2, Sparkles } from 'lucide-react'
import type { useCanvasStore } from '../store/useCanvasStore'

type Store = ReturnType<typeof useCanvasStore>

export default function Sidebar({ store, onCollapse, onHelp }: { store: Store; onCollapse: () => void; onHelp: () => void }) {
  return (
    <aside className="sidebar">
      <div className="brand"><div className="brand__mark"><Sparkles size={19} /></div><span>无界<span className="brand__light">画布</span></span><button className="icon-button brand__collapse" onClick={onCollapse} title="隐藏侧边栏" aria-label="隐藏侧边栏"><PanelLeftClose size={17} /></button></div>
      <div className="sidebar__top"><div className="sidebar__section-title">工作空间 <span>个人</span></div></div>
      <div className="sidebar__section-heading"><span>我的画布</span><button className="icon-button" aria-label="新建画布" title="新建画布" onClick={() => store.newBoard(`新画布 ${store.workspace.boards.length + 1}`)}><Plus size={17} /></button></div>
      <nav className="board-list" aria-label="画布列表">
        {store.workspace.boards.map((board) => (
          <button key={board.id} className={`board-list__item ${board.id === store.board.id ? 'is-active' : ''}`} onClick={() => store.selectBoard(board.id)}>
            <LayoutGrid size={17} /><span>{board.title}</span><small>{board.cards.length}</small>
          </button>
        ))}
      </nav>
      <div className="sidebar__spacer" />
      <div className="sidebar__tip"><div className="sidebar__tip-icon"><Sparkles size={15} /></div><strong>小提示</strong><p>双击空白处创建卡片；拖动卡片两侧的圆点连接想法。</p></div>
      <button className="sidebar__settings" onClick={onHelp}><Settings2 size={17} /> 使用帮助</button>
      <div className="sidebar__footer"><span className="avatar">我</span><div><strong>个人工作区</strong><small>只属于你的灵感空间</small></div></div>
    </aside>
  )
}
