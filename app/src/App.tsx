import { useCulling } from './ui/store'
import { ProofWall } from './ui/ProofWall'
import { ReviewMode } from './ui/ReviewMode'
import { LocksPanel } from './ui/LocksPanel'
import { CompareView } from './ui/CompareView'
import type { ViewId } from './storage/persistence'

const VIEWS: Array<{ id: ViewId; label: string }> = [
  { id: 'wall', label: '校样墙' },
  { id: 'review', label: '逐张复核' },
  { id: 'locks', label: '成套留痕' },
  { id: 'compare', label: '跨系列比较' },
]

export default function App() {
  const { prefs, updatePrefs, resetAll } = useCulling()

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-title">
          <h1>选片台</h1>
          <p>离线校样与成套留痕 · 数据仅保存在本机浏览器</p>
        </div>
        <nav className="app-tabs" aria-label="视图切换">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              className={`tab${prefs.view === v.id ? ' is-active' : ''}`}
              onClick={() => updatePrefs({ view: v.id })}
            >
              {v.label}
            </button>
          ))}
        </nav>
      </header>

      <main>
        {prefs.view === 'wall' && <ProofWall />}
        {prefs.view === 'review' && <ReviewMode />}
        {prefs.view === 'locks' && <LocksPanel />}
        {prefs.view === 'compare' && <CompareView />}
      </main>

      <footer className="app-footer">
        <span>标记、锁定版本与界面偏好均存储于 localStorage，离线可用，刷新后保持一致。</span>
        <button
          type="button"
          className="reset-btn"
          onClick={() => {
            if (window.confirm('确定清除本机全部标记与锁定记录？此操作不可撤销。')) resetAll()
          }}
        >
          清除本机数据
        </button>
      </footer>
    </div>
  )
}
