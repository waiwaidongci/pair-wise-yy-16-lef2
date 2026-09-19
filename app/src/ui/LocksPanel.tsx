import { useState } from 'react'
import { photoById, seriesList } from '../data/photos'
import { diffWithSnapshot, lockEligibility } from '../domain/locking'
import { MARK_LABEL, type LockedVersion } from '../domain/types'
import { useCulling } from './store'
import { formatTime } from './marks-ui'

/**
 * 成套留痕：每个系列的锁定前置条件、锁定操作，以及全部历史版本。
 * 已失效的旧版保留可查，并能对照当前标记看到差异。
 */

function VersionDetail({ lock }: { lock: LockedVersion }) {
  const { state } = useCulling()
  const changed = new Set(diffWithSnapshot(lock, state.marks))
  return (
    <ul className="version-detail">
      {Object.entries(lock.snapshot).map(([photoId, mark]) => {
        const photo = photoById.get(photoId)
        const current = state.marks[photoId]?.mark
        const diverged = changed.has(photoId)
        return (
          <li key={photoId} className={diverged ? 'is-diverged' : ''}>
            <span className="vd-title">{photo?.title ?? photoId}</span>
            <span>快照：{MARK_LABEL[mark]}</span>
            <span>
              当前：{current ? MARK_LABEL[current] : '未标记'}
              {diverged && <em className="warn">（已变更）</em>}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

function VersionRow({ lock }: { lock: LockedVersion }) {
  const [open, setOpen] = useState(false)
  const selectedCount = Object.values(lock.snapshot).filter((m) => m === 'selected').length
  const excludedCount = Object.values(lock.snapshot).filter((m) => m === 'excluded').length
  return (
    <li className={`version-row version-${lock.status}`}>
      <button type="button" className="version-head" onClick={() => setOpen((v) => !v)}>
        <span className="version-name">成套 v{lock.version}</span>
        {lock.status === 'active' ? (
          <span className="badge badge-lock-active">有效</span>
        ) : (
          <span className="badge badge-lock-invalid">已失效</span>
        )}
        <span className="version-meta">
          锁定于 {formatTime(lock.lockedAt)}
          {lock.invalidatedAt && ` · 失效于 ${formatTime(lock.invalidatedAt)}`}
        </span>
        <span className="version-meta">
          入选 {selectedCount} · 排除 {excludedCount}
        </span>
        <span className="version-toggle">{open ? '收起 ▲' : '明细 ▼'}</span>
      </button>
      {open && <VersionDetail lock={lock} />}
    </li>
  )
}

export function LocksPanel() {
  const { state, lock } = useCulling()

  return (
    <section className="view-locks">
      <p className="view-note">
        锁定成套前需覆盖系列内全部照片且无待复核；锁定后任何标记改动会让该版立即失效，旧版保留在此备查。
      </p>
      {seriesList.map((series) => {
        const eligibility = lockEligibility(series.photoIds, state.marks, state.locks, series.id)
        const versions = state.locks.filter((l) => l.seriesId === series.id).slice().reverse()
        const reason = eligibility.hasActiveLock
          ? '当前已有有效成套'
          : eligibility.unmarked.length > 0
            ? `还有 ${eligibility.unmarked.length} 张未标记`
            : eligibility.review.length > 0
              ? `还有 ${eligibility.review.length} 张待复核`
              : '可以锁定'
        return (
          <section key={series.id} className="series-block">
            <header className="series-header">
              <div>
                <h2>{series.title}</h2>
                <p className="series-summary">{reason}</p>
              </div>
              <div className="series-lockbar">
                <button
                  type="button"
                  className="lock-btn"
                  disabled={!eligibility.ok}
                  onClick={() => lock(series.id)}
                >
                  锁定成套（v{versions.length + 1}）
                </button>
              </div>
            </header>
            {versions.length === 0 ? (
              <p className="empty-hint">还没有锁定记录。</p>
            ) : (
              <ul className="version-list">
                {versions.map((lockItem) => (
                  <VersionRow key={lockItem.id} lock={lockItem} />
                ))}
              </ul>
            )}
          </section>
        )
      })}
    </section>
  )
}
