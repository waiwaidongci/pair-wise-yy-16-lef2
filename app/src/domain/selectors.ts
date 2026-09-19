import type { Mark, MarkRecord } from './types'

export interface SeriesStats {
  seriesId: string
  total: number
  selected: number
  review: number
  excluded: number
  unmarked: number
  /** 入选 / 总数，0..1 */
  selectedRatio: number
  /** 当前标记为「入选」的照片 id（按片序） */
  selectedIds: string[]
}

/**
 * 跨系列比较的唯一数据来源：当前有效标记（state.marks）。
 * 历史锁定版本的快照一律不参与统计，避免新旧标记混用。
 */
export function seriesStats(
  series: { id: string; photoIds: string[] },
  marks: Record<string, MarkRecord>,
): SeriesStats {
  let selected = 0
  let review = 0
  let excluded = 0
  let unmarked = 0
  const selectedIds: string[] = []

  for (const id of series.photoIds) {
    const mark: Mark | undefined = marks[id]?.mark
    if (mark === 'selected') {
      selected += 1
      selectedIds.push(id)
    } else if (mark === 'review') {
      review += 1
    } else if (mark === 'excluded') {
      excluded += 1
    } else {
      unmarked += 1
    }
  }

  const total = series.photoIds.length
  return {
    seriesId: series.id,
    total,
    selected,
    review,
    excluded,
    unmarked,
    selectedRatio: total === 0 ? 0 : selected / total,
    selectedIds,
  }
}

export interface SeriesProgress {
  marked: number
  total: number
  review: number
}

/** 校样墙 / 复核视图用的进度：已标记数与待复核数（同样只读当前标记）。 */
export function seriesProgress(
  photoIds: string[],
  marks: Record<string, MarkRecord>,
): SeriesProgress {
  const stats = seriesStats({ id: '', photoIds }, marks)
  return { marked: stats.total - stats.unmarked, total: stats.total, review: stats.review }
}
