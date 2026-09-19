import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  allSeries,
  categories,
  photosForCategory,
  type CategoryId,
} from '../data/photos'
import { useLightbox } from '../components/Lightbox'
import { PhotoCard } from '../components/PhotoCard'
import { useUiPrefs } from '../selection/SelectionContext'

export function Work() {
  // 筛选状态放在全局 UI 偏好里：进入系列页再返回、甚至刷新后都保持（约束 #1）
  const { prefs, setWorkFilter } = useUiPrefs()
  const filter = prefs.workFilter
  const lightbox = useLightbox()

  const photos = useMemo(() => photosForCategory(filter), [filter])
  const visibleSeries = useMemo(
    () => allSeries.filter(s => filter === 'all' || s.category === (filter as CategoryId)),
    [filter],
  )

  return (
    <main className="page">
      <header className="page-head">
        <p className="eyebrow">作品集</p>
        <h1>所有作品</h1>
        <p className="lede">从贴近面孔的凝视，到远离人群的高原。</p>
      </header>

      <div className="filters" role="group" aria-label="按分类筛选">
        <button
          type="button"
          aria-pressed={filter === 'all'}
          onClick={() => setWorkFilter('all')}
        >
          全部
        </button>
        {categories.map(c => (
          <button
            key={c.id}
            type="button"
            aria-pressed={filter === c.id}
            onClick={() => setWorkFilter(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <p className="photo-count">{photos.length} 张照片</p>

      <nav className="series-links" aria-label="系列入口">
        {visibleSeries.map(s => (
          <Link key={s.id} to={`/work/${s.id}`} className="text-link">
            进入《{s.title}》系列 →
          </Link>
        ))}
      </nav>

      <div className="masonry">
        {photos.map((photo, i) => (
          <PhotoCard key={photo.id} photo={photo} onOpen={() => lightbox.open(photos, i)} />
        ))}
      </div>
    </main>
  )
}
