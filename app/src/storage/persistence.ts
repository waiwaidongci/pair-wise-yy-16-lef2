import { emptyCullingState, type CullingState } from '../domain/types'

/**
 * 记录存储层 —— 负责把状态规则层产出的状态持久化到本地（localStorage），
 * 以及界面偏好（筛选、片序、复核位置等）的读写。
 * 本层不做任何业务判断，只做序列化 / 反序列化与容错。
 */

/** 可注入的存储介质，便于测试或非浏览器环境替换。 */
export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export const STATE_KEY = 'culling-trail:v1:state'
export const PREFS_KEY = 'culling-trail:v1:prefs'

export type ViewId = 'wall' | 'review' | 'locks' | 'compare'
export type SortMode = 'sheet' | 'status'

/** 界面偏好：刷新后筛选、片序与复核位置需要与刷新前一致。 */
export interface UiPrefs {
  view: ViewId
  /** 'all' 或系列 id */
  filterSeries: string
  /** 'all' | 'unmarked' | 具体标记 */
  filterMark: string
  /** 片序（sheet）或按标记分组（status） */
  sortMode: SortMode
  /** 逐张复核：当前系列与每个系列停留的照片 */
  reviewSeries: string
  reviewCursor: Record<string, string>
}

export function defaultPrefs(): UiPrefs {
  return {
    view: 'wall',
    filterSeries: 'all',
    filterMark: 'all',
    sortMode: 'sheet',
    reviewSeries: 'gaze',
    reviewCursor: {},
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** 反序列化业务状态；数据缺失或损坏时回退到空状态，绝不让界面崩掉。 */
export function parseState(raw: string | null): CullingState {
  if (!raw) return emptyCullingState()
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed) || parsed.schemaVersion !== 1) return emptyCullingState()
    if (!isRecord(parsed.marks) || !Array.isArray(parsed.locks)) return emptyCullingState()
    return parsed as unknown as CullingState
  } catch {
    return emptyCullingState()
  }
}

/** 反序列化界面偏好；逐项校验，缺项用默认值补齐。 */
export function parsePrefs(raw: string | null): UiPrefs {
  const base = defaultPrefs()
  if (!raw) return base
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) return base
    return {
      view: typeof parsed.view === 'string' ? (parsed.view as ViewId) : base.view,
      filterSeries: typeof parsed.filterSeries === 'string' ? parsed.filterSeries : base.filterSeries,
      filterMark: typeof parsed.filterMark === 'string' ? parsed.filterMark : base.filterMark,
      sortMode: parsed.sortMode === 'status' ? 'status' : 'sheet',
      reviewSeries: typeof parsed.reviewSeries === 'string' ? parsed.reviewSeries : base.reviewSeries,
      reviewCursor: isRecord(parsed.reviewCursor)
        ? (parsed.reviewCursor as Record<string, string>)
        : {},
    }
  } catch {
    return base
  }
}

export function loadState(storage: StorageLike): CullingState {
  return parseState(storage.getItem(STATE_KEY))
}

export function saveState(storage: StorageLike, state: CullingState): void {
  storage.setItem(STATE_KEY, JSON.stringify(state))
}

export function loadPrefs(storage: StorageLike): UiPrefs {
  return parsePrefs(storage.getItem(PREFS_KEY))
}

export function savePrefs(storage: StorageLike, prefs: UiPrefs): void {
  storage.setItem(PREFS_KEY, JSON.stringify(prefs))
}

export function clearAll(storage: StorageLike): void {
  storage.removeItem(STATE_KEY)
  storage.removeItem(PREFS_KEY)
}
