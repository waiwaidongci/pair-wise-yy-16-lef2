// 选片台状态规则 —— 纯函数层。
// 本模块不 import React / localStorage / 照片数据源：
// 所有输入以参数传入，所有输出为新对象（不可变更新），便于单测与持久化解耦。

import type { Photo } from '../data/photos'
import {
  EMPTY_SELECTION,
  type MarkFilter,
  type MarkRecord,
  type MarkValue,
  type ProofOrder,
  type SelectionState,
  type SetVersion,
} from './types'

export interface PhotoRef {
  id: string
  seriesId: string
}

// ---------------------------------------------------------------------------
// 标记：每张照片只保留一份标记；重复提交沿用首次结果
// ---------------------------------------------------------------------------

/**
 * 提交一条标记。
 * - 与当前标记相同（重复提交）→ 原样返回 state，沿用首次结果（markedAt 不变）；
 * - 不同标记 → 替换为该照片唯一的一份标记，markedAt 取本次提交时间；
 * - 提交 null → 清除该照片的标记（回到未标记）。
 * 任何真实变更都会让所属系列当前「有效」的成套版本立即失效（旧版本保留可查）。
 */
export function applyMark(
  state: SelectionState,
  photo: PhotoRef,
  mark: MarkValue | null,
  now: number,
): SelectionState {
  const existing = state.marks[photo.id]

  if (mark === null) {
    if (!existing) return state // 未标记 → 清除是重复提交，沿用现状
    const marks = { ...state.marks }
    delete marks[photo.id]
    return { marks, versions: invalidateValidVersions(state.versions, photo.seriesId, now, photo.id) }
  }

  if (existing && existing.mark === mark) {
    return state // 重复提交同一标记：沿用首次结果
  }

  const record: MarkRecord = {
    photoId: photo.id,
    seriesId: photo.seriesId,
    mark,
    markedAt: now,
  }
  return {
    marks: { ...state.marks, [photo.id]: record },
    versions: invalidateValidVersions(state.versions, photo.seriesId, now, photo.id),
  }
}

/** 锁定后改动标记 → 该系列当前有效成套立即失效；历史版本全部保留。 */
function invalidateValidVersions(
  versions: SetVersion[],
  seriesId: string,
  now: number,
  changedPhotoId: string,
): SetVersion[] {
  return versions.map(v =>
    v.seriesId === seriesId && v.status === 'valid'
      ? {
          ...v,
          status: 'invalidated' as const,
          invalidatedAt: now,
          note: `锁定后标记被改动（${changedPhotoId}），成套失效`,
        }
      : v,
  )
}

// ---------------------------------------------------------------------------
// 锁定成套：须覆盖全部照片且无待复核
// ---------------------------------------------------------------------------

export interface LockReadiness {
  ok: boolean
  /** 尚未标记的照片 id。 */
  unmarked: string[]
  /** 仍为「待复核」的照片 id。 */
  pending: string[]
}

/** 锁定前置检查：全部照片都有标记，且没有任何「待复核」。 */
export function lockReadiness(state: SelectionState, photos: PhotoRef[]): LockReadiness {
  const unmarked: string[] = []
  const pending: string[] = []
  for (const p of photos) {
    const mark = state.marks[p.id]?.mark
    if (!mark) unmarked.push(p.id)
    else if (mark === 'pending') pending.push(p.id)
  }
  return { ok: unmarked.length === 0 && pending.length === 0, unmarked, pending }
}

/**
 * 锁定成套：为当前系列生成一份不可变快照版本。
 * 前置条件不满足时原样返回 state（不产生任何记录）。
 * 若存在旧的有效版本，则将其标记为「已被新版取代」（仍可查）。
 */
export function lockSet(
  state: SelectionState,
  seriesId: string,
  photos: PhotoRef[],
  now: number,
): SelectionState {
  if (!lockReadiness(state, photos).ok) return state

  const snapshot: Record<string, MarkValue> = {}
  for (const p of photos) {
    const mark = state.marks[p.id]?.mark
    if (mark) snapshot[p.id] = mark
  }

  const versionNumber =
    state.versions.filter(v => v.seriesId === seriesId).reduce((max, v) => Math.max(max, v.version), 0) + 1

  const version: SetVersion = {
    id: `${seriesId}-v${versionNumber}`,
    seriesId,
    version: versionNumber,
    lockedAt: now,
    marks: snapshot,
    status: 'valid',
  }

  const versions = [
    ...state.versions.map(v =>
      v.seriesId === seriesId && v.status === 'valid' ? { ...v, status: 'superseded' as const } : v,
    ),
    version,
  ]
  return { ...state, versions }
}

// ---------------------------------------------------------------------------
// 成套状态（派生）
// ---------------------------------------------------------------------------

export type SetState = 'draft' | 'valid' | 'invalidated'

export interface SeriesSetStatus {
  /** draft=从未锁定；valid=当前有有效成套；invalidated=锁过但已全部失效。 */
  state: SetState
  /** 当前有效成套（state === 'valid' 时存在）。 */
  current: SetVersion | null
  /** 最近一次失效的版本（用于提示）。 */
  lastInvalidated: SetVersion | null
  /** 该系列全部历史版本，新的在前（旧版仍可查）。 */
  history: SetVersion[]
}

export function setStatusForSeries(state: SelectionState, seriesId: string): SeriesSetStatus {
  const history = state.versions
    .filter(v => v.seriesId === seriesId)
    .slice()
    .sort((a, b) => b.version - a.version)
  const current = history.find(v => v.status === 'valid') ?? null
  const lastInvalidated = history.find(v => v.status === 'invalidated') ?? null
  const state_: SetState = current ? 'valid' : history.length > 0 ? 'invalidated' : 'draft'
  return { state: state_, current, lastInvalidated, history }
}

// ---------------------------------------------------------------------------
// 统计与跨系列比较：只读取当前有效标记，不得混用旧标记
// ---------------------------------------------------------------------------

export interface MarkTally {
  selected: number
  pending: number
  excluded: number
  unmarked: number
  total: number
}

/** 只统计当前有效（live）标记；历史版本快照不参与。 */
export function liveTally(state: SelectionState, photos: PhotoRef[]): MarkTally {
  const tally: MarkTally = { selected: 0, pending: 0, excluded: 0, unmarked: 0, total: photos.length }
  for (const p of photos) {
    const mark = state.marks[p.id]?.mark
    if (!mark) tally.unmarked += 1
    else tally[mark] += 1
  }
  return tally
}

export interface SeriesComparison {
  seriesId: string
  tally: MarkTally
  setState: SetState
  currentVersion: number | null
  lockedAt: number | null
  /** 已失效版本数（留痕规模），仅供展示，不参与统计。 */
  invalidatedCount: number
}

/**
 * 跨系列比较。输入仅为各系列的照片清单与当前 SelectionState；
 * 统计完全来自当前有效标记（state.marks），历史版本快照（SetVersion.marks）
 * 在任何分支都不会被读入统计 —— 保证「不混用旧标记」。
 */
export function compareSeries(
  state: SelectionState,
  seriesList: { id: string }[],
  photosBySeries: (seriesId: string) => PhotoRef[],
): SeriesComparison[] {
  return seriesList.map(series => {
    const photos = photosBySeries(series.id)
    const status = setStatusForSeries(state, series.id)
    return {
      seriesId: series.id,
      tally: liveTally(state, photos),
      setState: status.state,
      currentVersion: status.current?.version ?? null,
      lockedAt: status.current?.lockedAt ?? null,
      invalidatedCount: status.history.filter(v => v.status === 'invalidated').length,
    }
  })
}

// ---------------------------------------------------------------------------
// 校样墙：片序与筛选（纯派生，供界面与持久化共用一套规则）
// ---------------------------------------------------------------------------

export interface ProofItem {
  photo: Photo
  mark: MarkValue | null
  markedAt: number | null
}

/** 校样墙条目：照片 + 当前唯一标记（无则 null）。 */
export function proofItems(state: SelectionState, photos: Photo[]): ProofItem[] {
  return photos.map(photo => {
    const record = state.marks[photo.id]
    return { photo, mark: record?.mark ?? null, markedAt: record?.markedAt ?? null }
  })
}

const ORDER_PRIORITY: Record<Exclude<ProofOrder, 'sheet'>, (MarkValue | null)[]> = {
  'unmarked-first': [null, 'pending', 'selected', 'excluded'],
  'pending-first': ['pending', null, 'selected', 'excluded'],
  'selected-first': ['selected', 'pending', 'excluded', null],
}

/** 片序：默认按 photos.json 的 order 字段；其余为分组优先、组内仍按片序。 */
export function orderProofItems(items: ProofItem[], order: ProofOrder): ProofItem[] {
  const sorted = items.slice().sort((a, b) => a.photo.order - b.photo.order)
  if (order === 'sheet') return sorted
  const priority = ORDER_PRIORITY[order]
  return sorted.sort((a, b) => priority.indexOf(a.mark) - priority.indexOf(b.mark))
}

/** 校样墙筛选：按当前标记过滤。 */
export function filterProofItems(items: ProofItem[], filter: MarkFilter): ProofItem[] {
  if (filter === 'all') return items
  if (filter === 'unmarked') return items.filter(i => i.mark === null)
  return items.filter(i => i.mark === filter)
}

// ---------------------------------------------------------------------------
// 状态迁移守卫（存储层调用）
// ---------------------------------------------------------------------------

/** 校验并修复从持久层读回的状态；任何非法内容都回退为空状态，避免脏数据扩散。 */
export function normalizeSelection(raw: unknown): SelectionState {
  if (!raw || typeof raw !== 'object') return EMPTY_SELECTION
  const candidate = raw as Partial<SelectionState>
  const marks: SelectionState['marks'] = {}
  if (candidate.marks && typeof candidate.marks === 'object') {
    for (const [photoId, record] of Object.entries(candidate.marks)) {
      if (
        record &&
        typeof record === 'object' &&
        typeof record.photoId === 'string' &&
        typeof record.seriesId === 'string' &&
        typeof record.markedAt === 'number' &&
        (record.mark === 'selected' || record.mark === 'pending' || record.mark === 'excluded')
      ) {
        marks[photoId] = { photoId: record.photoId, seriesId: record.seriesId, mark: record.mark, markedAt: record.markedAt }
      }
    }
  }
  const versions: SetVersion[] = []
  if (Array.isArray(candidate.versions)) {
    for (const v of candidate.versions) {
      if (
        v &&
        typeof v === 'object' &&
        typeof v.id === 'string' &&
        typeof v.seriesId === 'string' &&
        typeof v.version === 'number' &&
        typeof v.lockedAt === 'number' &&
        (v.status === 'valid' || v.status === 'superseded' || v.status === 'invalidated') &&
        v.marks &&
        typeof v.marks === 'object'
      ) {
        versions.push(v as SetVersion)
      }
    }
  }
  return { marks, versions }
}
