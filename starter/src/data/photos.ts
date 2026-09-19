import rawData from './photos.json'

// mock-data/photos.json 是唯一权威内容源；本文件只做类型化读取与派生查询，
// 不在任何页面组件里重复硬编码照片列表（task.md 约束 #4）。

export type CategoryId = 'portrait' | 'landscape' | 'pastoral'

export interface Photo {
  id: string
  category: CategoryId
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
  category: CategoryId
  summary: string
  photoIds: string[]
}

export interface Category {
  id: CategoryId
  label: string
}

interface PhotoData {
  categories: Category[]
  series: Series[]
  photos: Photo[]
}

export const photoData = rawData as PhotoData

export const categories: Category[] = photoData.categories
export const allSeries: Series[] = photoData.series
export const allPhotos: Photo[] = photoData.photos

export function photoSrc(photo: Photo): string {
  return `/${photo.file}`
}

export function photoById(id: string): Photo | undefined {
  return allPhotos.find(p => p.id === id)
}

export function seriesById(seriesId: string): Series | undefined {
  return allSeries.find(s => s.id === seriesId)
}

/** 按 order 字段升序返回某系列的全部照片（系列详情页 / 校样墙的片序）。 */
export function photosForSeries(seriesId: string): Photo[] {
  return allPhotos.filter(p => p.seriesId === seriesId).sort((a, b) => a.order - b.order)
}

export function photosForCategory(category: CategoryId | 'all'): Photo[] {
  return category === 'all' ? allPhotos : allPhotos.filter(p => p.category === category)
}

export function categoryLabel(categoryId: string): string {
  return categories.find(c => c.id === categoryId)?.label ?? categoryId
}
