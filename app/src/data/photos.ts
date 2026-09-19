import rawData from '../../../mock-data/photos.json'

/**
 * 内容数据层 —— 直接引用仓库根部的 mock-data/photos.json（权威数据源），
 * 不复制、不增删。图片文件本身已拷贝到 public/photos/ 供离线访问。
 */

export interface Photo {
  id: string
  category: string
  seriesId: string
  file: string
  title: string
  altText: string
  caption: string
  width: number
  height: number
  order: number
}

export interface Series {
  id: string
  title: string
  category: string
  summary: string
  photoIds: string[]
}

export interface Category {
  id: string
  label: string
}

export const categories = rawData.categories as Category[]
export const seriesList = rawData.series as Series[]
export const photos = rawData.photos as Photo[]

export const photoById = new Map(photos.map((p) => [p.id, p]))
export const seriesById = new Map(seriesList.map((s) => [s.id, s]))

/** 某系列内按片序（order 字段）排列的照片。 */
export function photosOfSeries(seriesId: string): Photo[] {
  const series = seriesById.get(seriesId)
  if (!series) return []
  return series.photoIds
    .map((id) => photoById.get(id))
    .filter((p): p is Photo => p !== undefined)
    .sort((a, b) => a.order - b.order)
}

/** 全部照片的全局片序：按系列在数据中的顺序展开，系列内按 order。 */
export const sheetOrder: Photo[] = seriesList.flatMap((s) => photosOfSeries(s.id))

/** 照片在全局片序中的序号（从 1 开始），用于校样墙编号。 */
export const sheetIndex = new Map(sheetOrder.map((p, i) => [p.id, i + 1]))
