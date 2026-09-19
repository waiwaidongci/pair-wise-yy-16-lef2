import { Link } from 'react-router-dom'
import { allSeries, categoryLabel, photoById, photosForSeries, photoSrc } from '../data/photos'
import { useLightbox } from '../components/Lightbox'

export function Home() {
  const lightbox = useLightbox()
  const heroPhoto = photoById('pastoral-01')!

  return (
    <main>
      <section className="hero" style={{ backgroundImage: `url(${photoSrc(heroPhoto)})` }}>
        <div className="hero-overlay">
          <p className="eyebrow">独立摄影师 · 高原与面孔</p>
          <h1>在凝视与旷野之间</h1>
          <p className="lede">记录黑白人像的细微情绪，以及高原地区自然与牧场生活的辽阔节奏。</p>
          <Link to="/work" className="text-link">
            浏览全部作品 →
          </Link>
        </div>
      </section>

      <section className="home-series">
        <div className="section-head">
          <p className="eyebrow">精选作品</p>
          <h2>三个系列</h2>
        </div>
        <div className="series-grid">
          {allSeries.map(series => {
            const photos = photosForSeries(series.id)
            const cover = photoById(series.photoIds[0])!
            return (
              <div
                key={series.id}
                className="series-card"
                role="button"
                tabIndex={0}
                onClick={() => lightbox.open(photos, 0)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    lightbox.open(photos, 0)
                  }
                }}
              >
                <span
                  className="ratio-box series-card-media"
                  style={{ aspectRatio: `${cover.width} / ${cover.height}` }}
                >
                  <img src={photoSrc(cover)} alt={cover.altText} loading="lazy" />
                </span>
                <span className="series-card-body">
                  <span className="eyebrow">
                    {categoryLabel(series.category)} · {photos.length} 幅
                  </span>
                  <strong>{series.title}</strong>
                  <span className="series-card-summary">{series.summary}</span>
                  <Link
                    to={`/work/${series.id}`}
                    className="text-link"
                    onClick={e => e.stopPropagation()}
                  >
                    进入系列 →
                  </Link>
                </span>
              </div>
            )
          })}
        </div>
      </section>
    </main>
  )
}
