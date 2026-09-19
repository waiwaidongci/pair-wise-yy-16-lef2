// /work 网格与系列页共用的照片卡片：整块可点击，打开共享灯箱。

import { categoryLabel, type Photo } from '../data/photos'
import { RatioImage } from './RatioImage'

export function PhotoCard({
  photo,
  onOpen,
}: {
  photo: Photo
  onOpen: () => void
}) {
  return (
    <button type="button" className="photo-button" aria-label={photo.title} onClick={onOpen}>
      <RatioImage photo={photo} />
      <span className="photo-meta">
        <strong>{photo.title}</strong>
        <span className="photo-category">{categoryLabel(photo.category)}</span>
      </span>
    </button>
  )
}
