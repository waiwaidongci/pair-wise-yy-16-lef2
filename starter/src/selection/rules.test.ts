// 状态规则层的单元测试 —— 逐条对应选片台的需求语义。

import { describe, expect, it } from 'vitest'
import {
  applyMark,
  compareSeries,
  filterProofItems,
  liveTally,
  lockReadiness,
  lockSet,
  normalizeSelection,
  orderProofItems,
  proofItems,
  setStatusForSeries,
} from './rules'
import { EMPTY_SELECTION, type SelectionState } from './types'
import { loadSelection, loadUiPrefs, saveSelection, saveUiPrefs, type StorageBackend } from './storage'
import type { Photo } from '../data/photos'

const T0 = 1_000_000

function photo(id: string, seriesId = 'gaze', order = 1): Photo {
  return {
    id,
    seriesId,
    category: 'portrait',
    file: `photos/portrait/${id}.jpg`,
    title: id,
    altText: id,
    caption: id,
    width: 100,
    height: 100,
    order,
  }
}

const SERIES = [photo('p1', 'gaze', 1), photo('p2', 'gaze', 2), photo('p3', 'gaze', 3)]

function fullyMarked(state: SelectionState, mark: 'selected' | 'excluded' = 'selected'): SelectionState {
  return SERIES.reduce(
    (s, p, i) => applyMark(s, p, i === 1 ? 'excluded' : mark, T0 + i),
    state,
  )
}

describe('标记：每张照片只保留一份，重复提交沿用首次结果', () => {
  it('首次提交创建唯一记录', () => {
    const s = applyMark(EMPTY_SELECTION, SERIES[0], 'selected', T0)
    expect(Object.keys(s.marks)).toHaveLength(1)
    expect(s.marks.p1).toMatchObject({ mark: 'selected', markedAt: T0 })
  })

  it('重复提交同一标记是空操作：状态原样返回，markedAt 不变', () => {
    const s1 = applyMark(EMPTY_SELECTION, SERIES[0], 'selected', T0)
    const s2 = applyMark(s1, SERIES[0], 'selected', T0 + 999)
    expect(s2).toBe(s1)
    expect(s2.marks.p1.markedAt).toBe(T0)
  })

  it('提交不同标记会替换（仍只有一份记录）', () => {
    let s = applyMark(EMPTY_SELECTION, SERIES[0], 'pending', T0)
    s = applyMark(s, SERIES[0], 'excluded', T0 + 10)
    expect(Object.keys(s.marks)).toHaveLength(1)
    expect(s.marks.p1.mark).toBe('excluded')
    expect(s.marks.p1.markedAt).toBe(T0 + 10)
  })

  it('清除标记回到未标记；对未标记照片的清除是空操作', () => {
    let s = applyMark(EMPTY_SELECTION, SERIES[0], 'selected', T0)
    s = applyMark(s, SERIES[0], null, T0 + 5)
    expect(s.marks.p1).toBeUndefined()
    const again = applyMark(s, SERIES[0], null, T0 + 6)
    expect(again).toBe(s)
  })
})

describe('锁定成套：须覆盖全部照片且无待复核', () => {
  it('有未标记照片时不可锁定', () => {
    let s = applyMark(EMPTY_SELECTION, SERIES[0], 'selected', T0)
    s = applyMark(s, SERIES[1], 'excluded', T0 + 1)
    const r = lockReadiness(s, SERIES)
    expect(r.ok).toBe(false)
    expect(r.unmarked).toEqual(['p3'])
    expect(lockSet(s, 'gaze', SERIES, T0 + 2)).toBe(s)
  })

  it('存在待复核时不可锁定', () => {
    let s = fullyMarked(EMPTY_SELECTION)
    s = applyMark(s, SERIES[2], 'pending', T0 + 10)
    const r = lockReadiness(s, SERIES)
    expect(r.ok).toBe(false)
    expect(r.pending).toEqual(['p3'])
    expect(lockSet(s, 'gaze', SERIES, T0 + 11)).toBe(s)
  })

  it('全部覆盖且无待复核时可锁定，生成不可变快照', () => {
    const s = fullyMarked(EMPTY_SELECTION)
    const locked = lockSet(s, 'gaze', SERIES, T0 + 100)
    expect(locked.versions).toHaveLength(1)
    expect(locked.versions[0]).toMatchObject({
      seriesId: 'gaze',
      version: 1,
      status: 'valid',
      lockedAt: T0 + 100,
      marks: { p1: 'selected', p2: 'excluded', p3: 'selected' },
    })
    expect(setStatusForSeries(locked, 'gaze').state).toBe('valid')
  })
})

describe('锁定后改动标记：成套立即失效，旧版仍可查', () => {
  it('锁定后改动任何标记 → 当前版本立即失效并留痕', () => {
    let s = fullyMarked(EMPTY_SELECTION)
    s = lockSet(s, 'gaze', SERIES, T0 + 100)
    const after = applyMark(s, SERIES[0], 'excluded', T0 + 200)
    const v = after.versions[0]
    expect(v.status).toBe('invalidated')
    expect(v.invalidatedAt).toBe(T0 + 200)
    expect(v.note).toContain('p1')
    expect(setStatusForSeries(after, 'gaze').state).toBe('invalidated')
  })

  it('锁定后的重复提交（同一标记）不会让成套失效', () => {
    let s = fullyMarked(EMPTY_SELECTION)
    s = lockSet(s, 'gaze', SERIES, T0 + 100)
    const after = applyMark(s, SERIES[0], 'selected', T0 + 200) // 与快照相同
    expect(after).toBe(s)
    expect(after.versions[0].status).toBe('valid')
  })

  it('失效后重新锁定生成新版本，旧版本全部保留可查', () => {
    let s = fullyMarked(EMPTY_SELECTION)
    s = lockSet(s, 'gaze', SERIES, T0 + 100)
    s = applyMark(s, SERIES[0], 'excluded', T0 + 200) // v1 失效
    s = lockSet(s, 'gaze', SERIES, T0 + 300) // v2
    const status = setStatusForSeries(s, 'gaze')
    expect(status.state).toBe('valid')
    expect(status.current?.version).toBe(2)
    expect(status.history).toHaveLength(2)
    expect(status.history.map(v => v.status)).toEqual(['valid', 'invalidated'])
    // 旧版快照仍是锁定时刻的标记（p1=selected），未被后续改动污染
    expect(status.history[1].marks.p1).toBe('selected')
  })
})

describe('跨系列比较：只读取当前有效标记，不混用旧标记', () => {
  it('锁定后改动标记，比较页统计反映改动后的当前标记', () => {
    const gazePhotos = SERIES
    const wildPhotos = [photo('w1', 'wilderness', 1), photo('w2', 'wilderness', 2)]
    let s = fullyMarked(EMPTY_SELECTION) // gaze: selected, excluded, selected
    s = lockSet(s, 'gaze', gazePhotos, T0 + 100)
    s = applyMark(s, SERIES[0], 'excluded', T0 + 200) // 改动 → v1 失效
    s = applyMark(s, wildPhotos[0], 'pending', T0 + 300)

    const rows = compareSeries(
      s,
      [{ id: 'gaze' }, { id: 'wilderness' }],
      id => (id === 'gaze' ? gazePhotos : wildPhotos),
    )
    const gaze = rows.find(r => r.seriesId === 'gaze')!
    // 当前有效标记：excluded×2 + selected×1（而非快照里的 selected×2 + excluded×1）
    expect(gaze.tally).toMatchObject({ selected: 1, excluded: 2, pending: 0, unmarked: 0 })
    expect(gaze.setState).toBe('invalidated')
    const wild = rows.find(r => r.seriesId === 'wilderness')!
    expect(wild.tally).toMatchObject({ selected: 0, pending: 1, unmarked: 1 })
    expect(wild.setState).toBe('draft')
  })

  it('liveTally 只统计 live marks', () => {
    let s = fullyMarked(EMPTY_SELECTION)
    s = lockSet(s, 'gaze', SERIES, T0 + 100)
    s = applyMark(s, SERIES[0], null, T0 + 200) // 清除一个
    const tally = liveTally(s, SERIES)
    expect(tally).toMatchObject({ selected: 1, excluded: 1, unmarked: 1, total: 3 })
  })
})

describe('校样墙：片序与筛选', () => {
  it('默认按片序（order 字段）排列', () => {
    const items = proofItems(EMPTY_SELECTION, SERIES.slice().reverse())
    const ordered = orderProofItems(items, 'sheet')
    expect(ordered.map(i => i.photo.id)).toEqual(['p1', 'p2', 'p3'])
  })

  it('未标记优先时组内仍按片序', () => {
    let s = applyMark(EMPTY_SELECTION, SERIES[0], 'selected', T0)
    s = applyMark(s, SERIES[2], 'pending', T0 + 1)
    const items = proofItems(s, SERIES)
    const ordered = orderProofItems(items, 'unmarked-first')
    expect(ordered.map(i => i.photo.id)).toEqual(['p2', 'p3', 'p1'])
  })

  it('按标记筛选', () => {
    let s = applyMark(EMPTY_SELECTION, SERIES[0], 'selected', T0)
    s = applyMark(s, SERIES[1], 'pending', T0 + 1)
    const items = proofItems(s, SERIES)
    expect(filterProofItems(items, 'unmarked').map(i => i.photo.id)).toEqual(['p3'])
    expect(filterProofItems(items, 'pending').map(i => i.photo.id)).toEqual(['p2'])
    expect(filterProofItems(items, 'all')).toHaveLength(3)
  })
})

describe('记录存储：读写一致，脏数据回退', () => {
  function memoryBackend(): StorageBackend & { data: Map<string, string> } {
    const data = new Map<string, string>()
    return {
      data,
      getItem: k => data.get(k) ?? null,
      setItem: (k, v) => void data.set(k, v),
    }
  }

  it('状态写入后可完整读回（刷新一致性）', () => {
    const backend = memoryBackend()
    let s = fullyMarked(EMPTY_SELECTION)
    s = lockSet(s, 'gaze', SERIES, T0 + 100)
    saveSelection(s, backend)
    expect(loadSelection(backend)).toEqual(s)
  })

  it('损坏的 JSON 与非法结构都回退为空状态', () => {
    const backend = memoryBackend()
    backend.setItem('photolog.selection.v1', '{oops')
    expect(loadSelection(backend)).toEqual(EMPTY_SELECTION)
    backend.setItem('photolog.selection.v1', JSON.stringify({ marks: { p1: { mark: 'nope' } } }))
    expect(loadSelection(backend)).toEqual(EMPTY_SELECTION)
  })

  it('normalizeSelection 过滤非法标记但保留合法记录', () => {
    const normalized = normalizeSelection({
      marks: {
        p1: { photoId: 'p1', seriesId: 'gaze', mark: 'selected', markedAt: 1 },
        p2: { photoId: 'p2', seriesId: 'gaze', mark: 'bogus', markedAt: 2 },
      },
      versions: [],
    })
    expect(Object.keys(normalized.marks)).toEqual(['p1'])
  })

  it('界面偏好（筛选/片序/模式）写入后可读回', () => {
    const backend = memoryBackend()
    saveUiPrefs(
      { workFilter: 'pastoral', review: { seriesId: 'gaze', markFilter: 'pending', order: 'pending-first', mode: 'single' } },
      backend,
    )
    const prefs = loadUiPrefs(backend)
    expect(prefs?.workFilter).toBe('pastoral')
    expect(prefs?.review).toEqual({ seriesId: 'gaze', markFilter: 'pending', order: 'pending-first', mode: 'single' })
  })

  it('非法偏好值回退为默认', () => {
    const backend = memoryBackend()
    backend.setItem(
      'photolog.ui.v1',
      JSON.stringify({ workFilter: 'street', review: { seriesId: 'gaze', markFilter: '???', order: '???', mode: '???' } }),
    )
    const prefs = loadUiPrefs(backend)!
    expect(prefs.workFilter).toBe('all')
    expect(prefs.review.markFilter).toBe('all')
    expect(prefs.review.order).toBe('sheet')
    expect(prefs.review.mode).toBe('wall')
  })
})
