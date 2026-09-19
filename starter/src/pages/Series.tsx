import { Link, Navigate, useParams } from 'react-router-dom'
import { categoryLabel, photosForSeries, photoSrc, seriesById } from '../data/photos'
import { useLightbox } from '../components/Lightbox'
import { RatioImage } from '../components/RatioImage'

export function Series() {
  const { seriesId } = useParams<{ seriesId: string }>()
  const series = seriesId ? seriesById(seriesId) : undefined
  const lightbox = useLightbox()

  if (!series) return <Navigate to="/work" replace />

  // 与 /work 共享同一份数据模型：照片集由 photos.json 按 seriesId 派生（约束 #4）
  const photos = photosForSeries(series.id)
  const cover = photos[0]

  return (
    <main>
      <section className="series-hero" style={{ backgroundImage: `url(${photoSrc(cover)})` }}>
        <div className="series-hero-overlay">
          <p className="eyebrow">
            {categoryLabel(series.category)} · {photos.length} 幅
          </p>
          <h1>{series.title}</h1>
          <p className="lede">{series.summary}</p>
        </div>
      </section>

      <div className="story">
        {photos.map((photo, i) => (
          <div key={photo.id}>
            <article className={`story-block${i % 2 === 1 ? ' story-block-flip' : ''}`}>
              <button
                type="button"
                className="photo-button story-photo"
                aria-label={photo.title}
                onClick={() => lightbox.open(photos, i)}
              >
                <RatioImage photo={photo} />
                <span className="photo-meta">
                  <strong>{photo.title}</strong>
                  <span className="photo-category">{categoryLabel(photo.category)}</span>
                </span>
              </button>
              <div className="story-text">
                <p className="story-index">{String(photo.order).padStart(2, '0')}</p>
                <h2>{photo.title}</h2>
                <p>{photo.caption}</p>
              </div>
            </article>
            {i === 1 && <blockquote className="pull-quote">“{series.summary}”</blockquote>}
          </div>
        ))}
      </div>

      <p className="back-row">
        <Link to="/work" className="text-link">
          ← 返回作品集
        </Link>
      </p>
    </main>
  )
}
