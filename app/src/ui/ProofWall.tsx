import { useMemo } from 'react'
import { photosOfSeries, seriesList, sheetIndex, type Photo, type Series } from '../data/photos'
import { lockEligibility, activeLock } from '../domain/locking'
import { seriesProgress } from '../domain/selectors'
import { MARK_LABEL, MARKS, type Mark } from '../domain/types'
import { useCulling } from './store'
import { MarkBadge, MarkButtons } from './marks-ui'

/**
 * 校样墙：按片序展示全部（或筛选后的）照片，每张卡片上直接三选一标记。
 * 筛选条件与片序模式保存在界面偏好里，刷新后保持一致。
 */

const STATUS_RANK: Record<string, number> = { unmarked: 0, review: 1, selected: 2, excluded: 3 }

function statusOf(mark: Mark | undefined): string {
  return mark ?? 'unmarked'
}

function SeriesLockBar({ series }: { series: Series }) {
  const { state, lock } = useCulling()
  const eligibility = lockEligibility(series.photoIds, state.marks, state.locks, series.id)
  const active = activeLock(state.locks, series.id)
  const latest = [...state.locks].reverse().find((l) => l.seriesId === series.id)
  const progress = seriesProgress(series.photoIds, state.marks)

  const reason = active
    ? `v${active.version} 有效，如需调整请先改动标记使旧版失效`
    : eligibility.unmarked.length > 0
      ? `还有 ${eligibility.unmarked.length} 张未标记`
      : eligibility.review.length > 0
        ? `还有 ${eligibility.review.length} 张待复核`
        : '锁定当前成套'

  return (
    <div className="series-lockbar">
      <span className="series-progress">
        已标记 {progress.marked}/{progress.total}
        {progress.review > 0 && <em className="warn"> · 待复核 {progress.review}</em>}
      </span>
      {active ? (
        <span className="badge badge-lock-active">成套 v{active.version} · 有效</span>
      ) : latest ? (
        <span className="badge badge-lock-invalid">成套 v{latest.version} · 已失效</span>
      ) : (
        <span className="badge badge-unmarked">未锁定</span>
      )}
      <button
        type="button"
        className="lock-btn"
        disabled={!eligibility.ok}
        title={reason}
        onClick={() => lock(series.id)}
      >
        {active ? '已锁定' : latest ? '重新锁定成套' : '锁定成套'}
      </button>
    </div>
  )
}

function PhotoCard({ photo }: { photo: Photo }) {
  const { state, submitMark } = useCulling()
  const record = state.marks[photo.id]
  return (
    <figure className="proof-card" data-photo-id={photo.id}>
      <div className="proof-img" style={{ aspectRatio: `${photo.width} / ${photo.height}` }}>
        <img src={`/${photo.file}`} alt={photo.altText} loading="lazy" />
        <span className="proof-index">#{sheetIndex.get(photo.id)}</span>
      </div>
      <figcaption>
        <div className="proof-head">
          <span className="proof-title">{photo.title}</span>
          <MarkBadge record={record} />
        </div>
        <MarkButtons current={record?.mark} onSubmit={(mark) => submitMark(photo.id, mark)} />
      </figcaption>
    </figure>
  )
}

export function ProofWall() {
  const { state, prefs, updatePrefs } = useCulling()

  const visibleSeries = useMemo(
    () => (prefs.filterSeries === 'all' ? seriesList : seriesList.filter((s) => s.id === prefs.filterSeries)),
    [prefs.filterSeries],
  )

  const photosFor = (series: Series): Photo[] => {
    let list = photosOfSeries(series.id)
    if (prefs.filterMark !== 'all') {
      list = list.filter((p) => statusOf(state.marks[p.id]?.mark) === prefs.filterMark)
    }
    if (prefs.sortMode === 'status') {
      list = [...list].sort(
        (a, b) =>
          STATUS_RANK[statusOf(state.marks[a.id]?.mark)] - STATUS_RANK[statusOf(state.marks[b.id]?.mark)] ||
          a.order - b.order,
      )
    }
    return list
  }

  return (
    <section className="view-wall">
      <div className="filter-bar">
        <div className="chip-row" role="group" aria-label="系列筛选">
          <button
            type="button"
            className={`chip${prefs.filterSeries === 'all' ? ' is-active' : ''}`}
            onClick={() => updatePrefs({ filterSeries: 'all' })}
          >
            全部系列
          </button>
          {seriesList.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`chip${prefs.filterSeries === s.id ? ' is-active' : ''}`}
              onClick={() => updatePrefs({ filterSeries: s.id })}
            >
              {s.title}
            </button>
          ))}
        </div>
        <div className="chip-row" role="group" aria-label="标记筛选">
          <button
            type="button"
            className={`chip${prefs.filterMark === 'all' ? ' is-active' : ''}`}
            onClick={() => updatePrefs({ filterMark: 'all' })}
          >
            全部标记
          </button>
          <button
            type="button"
            className={`chip${prefs.filterMark === 'unmarked' ? ' is-active' : ''}`}
            onClick={() => updatePrefs({ filterMark: 'unmarked' })}
          >
            未标记
          </button>
          {MARKS.map((m) => (
            <button
              key={m}
              type="button"
              className={`chip${prefs.filterMark === m ? ' is-active' : ''}`}
              onClick={() => updatePrefs({ filterMark: m })}
            >
              {MARK_LABEL[m]}
            </button>
          ))}
        </div>
        <div className="chip-row" role="group" aria-label="片序">
          <button
            type="button"
            className={`chip${prefs.sortMode === 'sheet' ? ' is-active' : ''}`}
            onClick={() => updatePrefs({ sortMode: 'sheet' })}
          >
            按片序
          </button>
          <button
            type="button"
            className={`chip${prefs.sortMode === 'status' ? ' is-active' : ''}`}
            onClick={() => updatePrefs({ sortMode: 'status' })}
          >
            按标记分组
          </button>
        </div>
      </div>

      {visibleSeries.map((series) => {
        const list = photosFor(series)
        return (
          <section key={series.id} className="series-block">
            <header className="series-header">
              <div>
                <h2>{series.title}</h2>
                <p className="series-summary">{series.summary}</p>
              </div>
              <SeriesLockBar series={series} />
            </header>
            {list.length === 0 ? (
              <p className="empty-hint">当前筛选条件下没有照片。</p>
            ) : (
              <div className="proof-grid">
                {list.map((p) => (
                  <PhotoCard key={p.id} photo={p} />
                ))}
              </div>
            )}
          </section>
        )
      })}
    </section>
  )
}
