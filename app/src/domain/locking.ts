import type { CullingState, LockedVersion, Mark, MarkRecord } from './types'

export interface LockEligibility {
  ok: boolean
  /** 尚未标记的照片 id */
  unmarked: string[]
  /** 仍为「待复核」的照片 id */
  review: string[]
  /** 该系列当前是否存在仍有效的锁定版本 */
  hasActiveLock: boolean
}

/**
 * 锁定成套的前置条件：覆盖系列内全部照片、无待复核、且当前没有仍有效的成套。
 */
export function lockEligibility(
  photoIds: string[],
  marks: Record<string, MarkRecord>,
  locks: LockedVersion[],
  seriesId: string,
): LockEligibility {
  const unmarked = photoIds.filter((id) => !marks[id])
  const review = photoIds.filter((id) => marks[id]?.mark === 'review')
  const hasActiveLock = locks.some((l) => l.seriesId === seriesId && l.status === 'active')
  return { ok: unmarked.length === 0 && review.length === 0 && !hasActiveLock, unmarked, review, hasActiveLock }
}

export type LockResult =
  | { ok: true; state: CullingState; lock: LockedVersion }
  | { ok: false; state: CullingState; eligibility: LockEligibility }

/**
 * 锁定成套：把当前全部标记快照为一个新的版本号。
 * 不满足前置条件时不产生任何变化，并返回原因。
 */
export function lockSeries(
  state: CullingState,
  series: { id: string; photoIds: string[] },
  now: number,
): LockResult {
  const eligibility = lockEligibility(series.photoIds, state.marks, state.locks, series.id)
  if (!eligibility.ok) {
    return { ok: false, state, eligibility }
  }

  const version = state.locks.filter((l) => l.seriesId === series.id).length + 1
  const snapshot: Record<string, Mark> = {}
  for (const id of series.photoIds) {
    snapshot[id] = state.marks[id].mark
  }

  const lock: LockedVersion = {
    id: `${series.id}-v${version}`,
    seriesId: series.id,
    version,
    lockedAt: now,
    status: 'active',
    snapshot,
  }
  return { ok: true, state: { ...state, locks: [...state.locks, lock] }, lock }
}

/** 该系列当前仍有效的锁定版本（若有）。 */
export function activeLock(locks: LockedVersion[], seriesId: string): LockedVersion | undefined {
  return locks.find((l) => l.seriesId === seriesId && l.status === 'active')
}

/**
 * 对比某个锁定版本的快照与当前标记，返回已发生变化的照片 id 列表。
 * 用于留痕界面展示「旧版 vs 当前」的差异。
 */
export function diffWithSnapshot(
  lock: LockedVersion,
  marks: Record<string, MarkRecord>,
): string[] {
  return Object.keys(lock.snapshot).filter((id) => marks[id]?.mark !== lock.snapshot[id])
}
