import { describe, expect, it } from 'vitest'
import { applyMark } from './marks'
import { emptyCullingState } from './types'
import { lockSeries } from './locking'

const PHOTO = { id: 'portrait-01', seriesId: 'gaze' }
const SERIES = { id: 'gaze', photoIds: ['portrait-01', 'portrait-02'] }

function markedState() {
  let s = emptyCullingState()
  s = applyMark(s, { id: 'portrait-01', seriesId: 'gaze' }, 'selected', 1000)
  s = applyMark(s, { id: 'portrait-02', seriesId: 'gaze' }, 'excluded', 1001)
  return s
}

describe('applyMark — 每张照片只保留一份标记', () => {
  it('首次提交记录标记与时间戳', () => {
    const s = applyMark(emptyCullingState(), PHOTO, 'selected', 1000)
    expect(s.marks['portrait-01']).toEqual({ mark: 'selected', at: 1000 })
  })

  it('重复提交沿用首次结果：状态原样返回，时间戳不变', () => {
    const s1 = applyMark(emptyCullingState(), PHOTO, 'selected', 1000)
    const s2 = applyMark(s1, PHOTO, 'selected', 9999)
    expect(s2).toBe(s1)
    expect(s2.marks['portrait-01'].at).toBe(1000)
  })

  it('提交不同标记则覆盖为最新一份', () => {
    let s = applyMark(emptyCullingState(), PHOTO, 'review', 1000)
    s = applyMark(s, PHOTO, 'excluded', 2000)
    expect(s.marks['portrait-01']).toEqual({ mark: 'excluded', at: 2000 })
  })
})

describe('锁定后改动标记 — 成套立即失效、旧版仍可查', () => {
  it('改动与快照不一致的标记让有效版本立即失效', () => {
    let s = markedState()
    const locked = lockSeries(s, SERIES, 5000)
    if (!locked.ok) throw new Error('lock should succeed')
    s = locked.state

    s = applyMark(s, { id: 'portrait-01', seriesId: 'gaze' }, 'excluded', 6000)
    const lock = s.locks[0]
    expect(lock.status).toBe('invalidated')
    expect(lock.invalidatedAt).toBe(6000)
    // 旧版仍保留在记录中，快照不被改写
    expect(s.locks).toHaveLength(1)
    expect(lock.snapshot['portrait-01']).toBe('selected')
  })

  it('重复提交相同标记不会误伤有效成套', () => {
    let s = markedState()
    const locked = lockSeries(s, SERIES, 5000)
    if (!locked.ok) throw new Error('lock should succeed')
    s = locked.state
    s = applyMark(s, { id: 'portrait-01', seriesId: 'gaze' }, 'selected', 6000)
    expect(s.locks[0].status).toBe('active')
  })

  it('失效后即使把标记改回快照值，旧版也不会复活（留痕不可逆）', () => {
    let s = markedState()
    const locked = lockSeries(s, SERIES, 5000)
    if (!locked.ok) throw new Error('lock should succeed')
    s = locked.state
    s = applyMark(s, { id: 'portrait-01', seriesId: 'gaze' }, 'excluded', 6000)
    s = applyMark(s, { id: 'portrait-01', seriesId: 'gaze' }, 'selected', 7000)
    expect(s.locks[0].status).toBe('invalidated')
  })

  it('失效后可重新锁定产生新版本，旧版仍保留', () => {
    let s = markedState()
    const r1 = lockSeries(s, SERIES, 5000)
    if (!r1.ok) throw new Error('lock should succeed')
    s = applyMark(r1.state, { id: 'portrait-01', seriesId: 'gaze' }, 'excluded', 6000)
    const r2 = lockSeries(s, SERIES, 7000)
    if (!r2.ok) throw new Error('re-lock should succeed')
    expect(r2.lock.version).toBe(2)
    expect(r2.state.locks).toHaveLength(2)
    expect(r2.state.locks[0].status).toBe('invalidated')
    expect(r2.state.locks[1].status).toBe('active')
    expect(r2.state.locks[1].snapshot['portrait-01']).toBe('excluded')
  })
})
