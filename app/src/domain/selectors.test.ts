import { describe, expect, it } from 'vitest'
import { applyMark } from './marks'
import { lockSeries } from './locking'
import { seriesProgress, seriesStats } from './selectors'
import { emptyCullingState } from './types'

const SERIES = { id: 'gaze', photoIds: ['p1', 'p2', 'p3'] }
const PHOTOS = SERIES.photoIds.map((id) => ({ id, seriesId: 'gaze' }))

describe('seriesStats — 跨系列比较只读取当前有效标记', () => {
  it('统计当前标记的分类计数与入选名单', () => {
    let s = emptyCullingState()
    s = applyMark(s, PHOTOS[0], 'selected', 1000)
    s = applyMark(s, PHOTOS[1], 'review', 1001)
    const stats = seriesStats(SERIES, s.marks)
    expect(stats).toMatchObject({
      total: 3,
      selected: 1,
      review: 1,
      excluded: 0,
      unmarked: 1,
      selectedIds: ['p1'],
    })
  })

  it('锁定后改动标记：统计反映当前值，而不是旧快照', () => {
    let s = emptyCullingState()
    for (const p of PHOTOS) s = applyMark(s, p, 'selected', 1000)
    const r = lockSeries(s, SERIES, 2000)
    if (!r.ok) throw new Error('lock should succeed')

    // 锁定快照里 p1 是 selected；当前已改为 excluded
    s = applyMark(r.state, PHOTOS[0], 'excluded', 3000)
    const stats = seriesStats(SERIES, s.marks)
    expect(stats.selected).toBe(2)
    expect(stats.excluded).toBe(1)
    expect(stats.selectedIds).toEqual(['p2', 'p3'])
    // 旧版快照仍保持原样，但绝不参与统计
    expect(s.locks[0].snapshot['p1']).toBe('selected')
  })
})

describe('seriesProgress', () => {
  it('返回已标记数与待复核数', () => {
    let s = emptyCullingState()
    s = applyMark(s, PHOTOS[0], 'selected', 1000)
    s = applyMark(s, PHOTOS[1], 'review', 1001)
    expect(seriesProgress(SERIES.photoIds, s.marks)).toEqual({ marked: 2, total: 3, review: 1 })
  })
})
