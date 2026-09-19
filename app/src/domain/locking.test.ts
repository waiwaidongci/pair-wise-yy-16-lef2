import { describe, expect, it } from 'vitest'
import { applyMark } from './marks'
import { activeLock, diffWithSnapshot, lockEligibility, lockSeries } from './locking'
import { emptyCullingState, type MarkRecord } from './types'

const SERIES = { id: 'gaze', photoIds: ['p1', 'p2', 'p3'] }
const PHOTOS = SERIES.photoIds.map((id) => ({ id, seriesId: 'gaze' }))

function marksOf(entries: Array<[string, MarkRecord['mark']]>): Record<string, MarkRecord> {
  return Object.fromEntries(entries.map(([id, mark], i) => [id, { mark, at: 1000 + i }]))
}

describe('lockEligibility — 锁定成套的前置条件', () => {
  it('存在未标记照片时不可锁定', () => {
    const e = lockEligibility(SERIES.photoIds, marksOf([['p1', 'selected']]), [], 'gaze')
    expect(e.ok).toBe(false)
    expect(e.unmarked).toEqual(['p2', 'p3'])
  })

  it('存在待复核照片时不可锁定', () => {
    const e = lockEligibility(
      SERIES.photoIds,
      marksOf([['p1', 'selected'], ['p2', 'review'], ['p3', 'excluded']]),
      [],
      'gaze',
    )
    expect(e.ok).toBe(false)
    expect(e.review).toEqual(['p2'])
  })

  it('全部覆盖且无待复核时可锁定', () => {
    const e = lockEligibility(
      SERIES.photoIds,
      marksOf([['p1', 'selected'], ['p2', 'excluded'], ['p3', 'selected']]),
      [],
      'gaze',
    )
    expect(e.ok).toBe(true)
  })

  it('已有有效成套时不可重复锁定', () => {
    let s = emptyCullingState()
    for (const p of PHOTOS) s = applyMark(s, p, 'selected', 1000)
    const r = lockSeries(s, SERIES, 2000)
    if (!r.ok) throw new Error('lock should succeed')
    const e = lockEligibility(SERIES.photoIds, r.state.marks, r.state.locks, 'gaze')
    expect(e.ok).toBe(false)
    expect(e.hasActiveLock).toBe(true)
    const again = lockSeries(r.state, SERIES, 3000)
    expect(again.ok).toBe(false)
  })
})

describe('lockSeries — 快照与版本号', () => {
  it('快照完整记录锁定时刻的标记', () => {
    let s = emptyCullingState()
    s = applyMark(s, PHOTOS[0], 'selected', 1000)
    s = applyMark(s, PHOTOS[1], 'excluded', 1001)
    s = applyMark(s, PHOTOS[2], 'selected', 1002)
    const r = lockSeries(s, SERIES, 5000)
    if (!r.ok) throw new Error('lock should succeed')
    expect(r.lock.version).toBe(1)
    expect(r.lock.snapshot).toEqual({ p1: 'selected', p2: 'excluded', p3: 'selected' })
    expect(activeLock(r.state.locks, 'gaze')?.id).toBe(r.lock.id)
  })
})

describe('diffWithSnapshot — 旧版与当前的差异', () => {
  it('列出锁定后发生变化的照片', () => {
    let s = emptyCullingState()
    for (const p of PHOTOS) s = applyMark(s, p, 'selected', 1000)
    const r = lockSeries(s, SERIES, 2000)
    if (!r.ok) throw new Error('lock should succeed')
    s = applyMark(r.state, PHOTOS[1], 'excluded', 3000)
    expect(diffWithSnapshot(r.lock, s.marks)).toEqual(['p2'])
  })
})
