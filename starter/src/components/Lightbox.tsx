// 全局共享灯箱：任何页面通过 LightboxContext.open(photos, index) 打开，
// 导航范围严格限定在调用方传入的照片子集内（task.md 约束 #2）。

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { categoryLabel, photoSrc, type Photo } from '../data/photos'

interface LightboxSession {
  photos: Photo[]
  index: number
}

interface LightboxApi {
  open: (photos: Photo[], index: number) => void
}

const LightboxContext = createContext<LightboxApi | null>(null)

export function useLightbox(): LightboxApi {
  const ctx = useContext(LightboxContext)
  if (!ctx) throw new Error('useLightbox 必须在 <LightboxProvider> 内使用')
  return ctx
}

export function LightboxProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<LightboxSession | null>(null)

  const open = useCallback((photos: Photo[], index: number) => {
    if (photos.length === 0) return
    setSession({ photos, index: Math.min(Math.max(index, 0), photos.length - 1) })
  }, [])

  const close = useCallback(() => setSession(null), [])

  const step = useCallback((delta: number) => {
    setSession(s =>
      s ? { ...s, index: (s.index + delta + s.photos.length) % s.photos.length } : s,
    )
  }, [])

  useEffect(() => {
    if (!session) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      if (e.key === 'ArrowLeft') step(-1)
      if (e.key === 'ArrowRight') step(1)
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [session, close, step])

  return (
    <LightboxContext.Provider value={{ open }}>
      {children}
      {session && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label="照片灯箱">
          <button type="button" className="lightbox-close" aria-label="关闭" onClick={close}>
            ×
          </button>
          <button
            type="button"
            className="lightbox-arrow lightbox-prev"
            aria-label="上一张"
            onClick={() => step(-1)}
          >
            ‹
          </button>
          <figure className="lightbox-stage">
            <img
              className="lightbox-image"
              src={photoSrc(session.photos[session.index])}
              alt={session.photos[session.index].altText}
              width={session.photos[session.index].width}
              height={session.photos[session.index].height}
            />
            <figcaption className="lightbox-info">
              <p className="eyebrow">
                {categoryLabel(session.photos[session.index].category)} · {session.index + 1} /{' '}
                {session.photos.length}
              </p>
              <h2>{session.photos[session.index].title}</h2>
              <p className="lightbox-caption">{session.photos[session.index].caption}</p>
            </figcaption>
          </figure>
          <button
            type="button"
            className="lightbox-arrow lightbox-next"
            aria-label="下一张"
            onClick={() => step(1)}
          >
            ›
          </button>
        </div>
      )}
    </LightboxContext.Provider>
  )
}
