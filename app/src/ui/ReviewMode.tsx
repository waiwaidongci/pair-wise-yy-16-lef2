import { useCallback, useEffect } from 'react'
import { photosOfSeries, seriesList } from '../data/photos'
import { seriesProgress } from '../domain/selectors'
import { MARKS } from '../domain/types'
import { useCulling } from './store'
import { MarkBadge, MarkButtons } from './marks-ui'

/**
 * 逐张复核：一次只看一张照片，大按钮三选一。
 * 移动端的主要工作视图；当前系列与停留位置保存在偏好里，刷新后接着看。
 */
export function ReviewMode() {
  const { state, prefs, updatePrefs, submitMark } = useCulling()

  const series = seriesList.find((s) => s.id === prefs.reviewSeries) ?? seriesList[0]
  const photos = photosOfSeries(series.id)
  const cursorId = prefs.reviewCursor[series.id]
  const currentIndex = Math.max(
    0,
    photos.findIndex((p) => p.id === cursorId),
  )
  const photo = photos[currentIndex]
  const record = photo ? state.marks[photo.id] : undefined
  const progress = seriesProgress(series.photoIds, state.marks)

  const goTo = useCallback(
    (index: number) => {
      const target = photos[index]
      if (!target) return
      updatePrefs({ reviewCursor: { ...prefs.reviewCursor, [series.id]: target.id } })
    },
    [photos, prefs.reviewCursor, series.id, updatePrefs],
  )

  const mark = useCallback(
    (markValue: (typeof MARKS)[number]) => {
      if (!photo) return
      submitMark(photo.id, markValue)
      // 标记后自动前进到下一张，便于连续复核
      if (currentIndex < photos.length - 1) goTo(currentIndex + 1)
    },
    [photo, submitMark, currentIndex, photos.length, goTo],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goTo(currentIndex - 1)
      else if (e.key === 'ArrowRight') goTo(currentIndex + 1)
      else if (e.key === '1') mark('selected')
      else if (e.key === '2') mark('review')
      else if (e.key === '3') mark('excluded')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goTo, mark, currentIndex])

  if (!photo) return null

  return (
    <section className="view-review">
      <div className="chip-row review-series-row" role="group" aria-label="选择系列">
        {seriesList.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`chip${s.id === series.id ? ' is-active' : ''}`}
            onClick={() => updatePrefs({ reviewSeries: s.id })}
          >
            {s.title}
          </button>
        ))}
      </div>

      <div className="review-stage">
        <div className="review-img" style={{ aspectRatio: `${photo.width} / ${photo.height}` }}>
          <img src={`/${photo.file}`} alt={photo.altText} />
        </div>
        <div className="review-info">
          <div className="review-title-row">
            <h2>{photo.title}</h2>
            <MarkBadge record={record} />
          </div>
          <p className="review-caption">{photo.caption}</p>
          <p className="review-position">
            第 {currentIndex + 1} / {photos.length} 张 · 已标记 {progress.marked}/{progress.total}
            {progress.review > 0 && <em className="warn"> · 待复核 {progress.review}</em>}
          </p>
          <MarkButtons current={record?.mark} onSubmit={mark} size="lg" />
          <div className="review-nav">
            <button type="button" onClick={() => goTo(currentIndex - 1)} disabled={currentIndex === 0}>
              ← 上一张
            </button>
            <button
              type="button"
              onClick={() => goTo(currentIndex + 1)}
              disabled={currentIndex === photos.length - 1}
            >
              下一张 →
            </button>
          </div>
          <p className="review-hint">键盘：←/→ 切换，1 入选，2 待复核，3 排除</p>
        </div>
      </div>
    </section>
  )
}
