// 按 photos.json 的 width/height 预留宽高比的图片容器：
// 图片加载完成前容器已撑开正确比例，避免布局抖动（task.md 约束 #3）。

import { photoSrc, type Photo } from '../data/photos'

export function RatioImage({
  photo,
  className,
  loading = 'lazy',
}: {
  photo: Photo
  className?: string
  loading?: 'lazy' | 'eager'
}) {
  return (
    <span
      className={`ratio-box${className ? ` ${className}` : ''}`}
      style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
    >
      <img
        src={photoSrc(photo)}
        alt={photo.altText}
        width={photo.width}
        height={photo.height}
        loading={loading}
      />
    </span>
  )
}
