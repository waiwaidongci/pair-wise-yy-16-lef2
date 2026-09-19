import { useMemo, useState } from 'react'
import { allSeries, categoryLabel, seriesById, type Photo } from '../data/photos'
import { RatioImage } from '../components/RatioImage'
import { useSelection, useUiPrefs } from '../selection/SelectionContext'
import {
  MARK_FILTER_LABELS,
  MARK_LABELS,
  MARK_VALUES,
  PROOF_ORDER_LABELS,
  SET_STATUS_LABELS,
  type MarkFilter,
  type MarkValue,
  type ProofOrder,
  type SetVersion,
} from '../selection/types'
import type { ProofItem } from '../selection/rules'

const MARK_FILTERS: MarkFilter[] = ['all', 'unmarked', 'selected', 'pending', 'excluded']
const PROOF_ORDERS: ProofOrder[] = ['sheet', 'unmarked-first', 'pending-first', 'selected-first']

function formatTime(ts: number): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ts))
}

export function Review() {
  const selection = useSelection()
  const { prefs, setReviewPrefs } = useUiPrefs()
  const { seriesId, markFilter, order, mode } = prefs.review

  const series = seriesById(seriesId) ?? allSeries[0]
  const readiness = selection.readiness(series.id)
  const tally = selection.tally(series.id)
  const items = useMemo(
    () => selection.wallItems(series.id, order, markFilter),
    [selection, series.id, order, markFilter],
  )

  return (
    <main className="page review-page">
      <header className="page-head">
        <p className="eyebrow">离线选片台</p>
        <h1>校样墙</h1>
        <p className="lede">
          每张照片只保留一份标记：入选、待复核或排除。全部覆盖且无待复核后，即可锁定成套。
        </p>
      </header>

      <div className="series-tabs" role="group" aria-label="选择系列">
        {allSeries.map(s => (
          <button
            key={s.id}
            type="button"
            aria-pressed={series.id === s.id}
            onClick={() => setReviewPrefs({ seriesId: s.id })}
          >
            {s.title}
          </button>
        ))}
      </div>

      <SetBanner seriesId={series.id} />

      <div className="review-toolbar">
        <div className="mark-filters" role="group" aria-label="按标记筛选">
          {MARK_FILTERS.map(f => (
            <button
              key={f}
              type="button"
              aria-pressed={markFilter === f}
              onClick={() => setReviewPrefs({ markFilter: f })}
            >
              {MARK_FILTER_LABELS[f]}
            </button>
          ))}
        </div>

        <label className="order-select">
          片序
          <select
            value={order}
            onChange={e => setReviewPrefs({ order: e.target.value as ProofOrder })}
          >
            {PROOF_ORDERS.map(o => (
              <option key={o} value={o}>
                {PROOF_ORDER_LABELS[o]}
              </option>
            ))}
          </select>
        </label>

        <div className="mode-toggle" role="group" aria-label="复核模式">
          <button
            type="button"
            aria-pressed={mode === 'wall'}
            onClick={() => setReviewPrefs({ mode: 'wall' })}
          >
            校样墙
          </button>
          <button
            type="button"
            aria-pressed={mode === 'single'}
            onClick={() => setReviewPrefs({ mode: 'single' })}
          >
            逐张复核
          </button>
        </div>

        <p className="review-progress" aria-live="polite">
          已标记 {tally.total - tally.unmarked} / {tally.total}
          {tally.pending > 0 && ` · 待复核 ${tally.pending}`}
        </p>

        <button
          type="button"
          className="lock-button"
          disabled={!readiness.ok}
          title={
            readiness.ok
              ? '锁定当前标记，生成成套版本'
              : `尚不可锁定：${readiness.unmarked.length} 张未标记，${readiness.pending.length} 张待复核`
          }
          onClick={() => selection.lockSeries(series.id)}
        >
          锁定成套
        </button>
      </div>

      {!readiness.ok && (
        <p className="lock-hint" role="note">
          锁定前须覆盖全部照片且无待复核：还差 {readiness.unmarked.length} 张未标记、
          {readiness.pending.length} 张待复核。
        </p>
      )}

      {mode === 'wall' ? (
        <ProofWall items={items} />
      ) : (
        <SingleReview items={items} total={tally.total} />
      )}

      <VersionHistory seriesId={series.id} />
    </main>
  )
}

// ---------------------------------------------------------------------------
// 成套状态横幅
// ---------------------------------------------------------------------------

function SetBanner({ seriesId }: { seriesId: string }) {
  const selection = useSelection()
  const status = selection.setStatus(seriesId)

  if (status.state === 'valid' && status.current) {
    return (
      <p className="set-banner set-valid" role="status">
        成套 v{status.current.version} 有效 · 锁定于 {formatTime(status.current.lockedAt)}
        。锁定后的任何标记改动都会让它立即失效。
      </p>
    )
  }
  if (status.state === 'invalidated' && status.lastInvalidated) {
    return (
      <p className="set-banner set-invalid" role="alert">
        成套 v{status.lastInvalidated.version} 已失效 —— {status.lastInvalidated.note}（
        {formatTime(status.lastInvalidated.invalidatedAt!)}）。旧版仍可在下方留痕中查看；
        重新锁定将生成 v{status.lastInvalidated.version + 1}。
      </p>
    )
  }
  return (
    <p className="set-banner set-draft" role="status">
      尚未锁定成套。完成全部标记（且无待复核）后可锁定，锁定记录会永久留痕。
    </p>
  )
}

// ---------------------------------------------------------------------------
// 校样墙
// ---------------------------------------------------------------------------

function ProofWall({ items }: { items: ProofItem[] }) {
  if (items.length === 0) {
    return <p className="empty-note">当前筛选下没有照片。</p>
  }
  return (
    <div className="proof-wall">
      {items.map(item => (
        <ProofCard key={item.photo.id} item={item} />
      ))}
    </div>
  )
}

function ProofCard({ item }: { item: ProofItem }) {
  const selection = useSelection()
  const { photo, mark, markedAt } = item

  return (
    <article
      className={`proof-card${mark ? ` proof-${mark}` : ''}`}
      data-photo-id={photo.id}
      data-mark={mark ?? 'unmarked'}
      data-marked-at={markedAt ?? ''}
    >
      <div className="proof-media">
        <RatioImage photo={photo} />
        <span className="proof-order">#{String(photo.order).padStart(2, '0')}</span>
      </div>
      <div className="proof-body">
        <div className="proof-title-row">
          <strong>{photo.title}</strong>
          <span className="proof-category">{categoryLabel(photo.category)}</span>
        </div>
        <MarkButtons photo={photo} mark={mark} />
        <p className="proof-meta">
          {mark && markedAt ? (
            <>
              {MARK_LABELS[mark]} · 标记于 {formatTime(markedAt)}
              <button
                type="button"
                className="clear-mark"
                onClick={() => selection.clearMark(photo)}
              >
                清除
              </button>
            </>
          ) : (
            '未标记'
          )}
        </p>
      </div>
    </article>
  )
}

function MarkButtons({ photo, mark, large }: { photo: Photo; mark: MarkValue | null; large?: boolean }) {
  const selection = useSelection()
  return (
    <div className={`mark-segment${large ? ' mark-segment-lg' : ''}`} role="group" aria-label="标记">
      {MARK_VALUES.map(value => (
        <button
          key={value}
          type="button"
          className={`mark-btn mark-${value}`}
          aria-pressed={mark === value}
          onClick={() => selection.markPhoto(photo, value)}
        >
          {MARK_LABELS[value]}
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// 逐张复核（移动端友好）
// ---------------------------------------------------------------------------

function SingleReview({ items, total }: { items: ProofItem[]; total: number }) {
  const selection = useSelection()
  const [index, setIndex] = useState(0)

  if (items.length === 0) {
    return <p className="empty-note">当前筛选下没有照片。</p>
  }

  const clamped = Math.min(index, items.length - 1)
  const item = items[clamped]
  const markedCount = items.filter(i => i.mark !== null).length

  const go = (delta: number) =>
    setIndex(i => (i + delta + items.length) % items.length)

  const markAndAdvance = (value: MarkValue) => {
    selection.markPhoto(item.photo, value)
    // 打标后自动前进到下一张未复核的照片，便于移动端连续过片
    const nextUnmarked = items.findIndex((it, i) => i > clamped && it.mark === null)
    if (nextUnmarked !== -1) setIndex(nextUnmarked)
    else if (clamped < items.length - 1) setIndex(clamped + 1)
  }

  return (
    <section className="single-review" aria-label="逐张复核">
      <div className="single-stage">
        <RatioImage photo={item.photo} loading="eager" />
        <span className="proof-order">#{String(item.photo.order).padStart(2, '0')}</span>
      </div>
      <div className="single-panel">
        <p className="eyebrow">
          {clamped + 1} / {items.length} · 本页已标记 {markedCount} / {total}
        </p>
        <h2>{item.photo.title}</h2>
        <p className="single-caption">{item.photo.caption}</p>
        <MarkButtons photo={item.photo} mark={item.mark} large />
        <div className="single-nav">
          <button type="button" onClick={() => go(-1)} aria-label="上一张">
            ← 上一张
          </button>
          <button type="button" onClick={() => go(1)} aria-label="下一张">
            下一张 →
          </button>
        </div>
        <div className="single-quick">
          {MARK_VALUES.map(value => (
            <button key={value} type="button" onClick={() => markAndAdvance(value)}>
              标为{MARK_LABELS[value]}并继续
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// 成套留痕：全部历史版本，旧版仍可查
// ---------------------------------------------------------------------------

function VersionHistory({ seriesId }: { seriesId: string }) {
  const selection = useSelection()
  const status = selection.setStatus(seriesId)
  const series = seriesById(seriesId)!

  return (
    <section className="version-history" aria-label="成套留痕">
      <h2>成套留痕 · {series.title}</h2>
      {status.history.length === 0 ? (
        <p className="empty-note">还没有锁定记录。</p>
      ) : (
        <ol className="version-list">
          {status.history.map(v => (
            <VersionRow key={v.id} version={v} />
          ))}
        </ol>
      )}
    </section>
  )
}

function VersionRow({ version }: { version: SetVersion }) {
  const photos = seriesById(version.seriesId)!.photoIds
  return (
    <li className={`version-row version-${version.status}`} data-version-id={version.id}>
      <details>
        <summary>
          <span className="version-tag">v{version.version}</span>
          <span className={`version-status status-${version.status}`}>
            {SET_STATUS_LABELS[version.status]}
          </span>
          <span className="version-time">锁定于 {formatTime(version.lockedAt)}</span>
          {version.invalidatedAt && (
            <span className="version-note">
              失效于 {formatTime(version.invalidatedAt)} · {version.note}
            </span>
          )}
        </summary>
        <ul className="version-snapshot">
          {photos.map(photoId => {
            const mark = version.marks[photoId]
            return (
              <li key={photoId}>
                <span className="snapshot-photo">{photoId}</span>
                <span className={`snapshot-mark mark-${mark}`}>
                  {mark ? MARK_LABELS[mark] : '未标记'}
                </span>
              </li>
            )
          })}
        </ul>
      </details>
    </li>
  )
}
