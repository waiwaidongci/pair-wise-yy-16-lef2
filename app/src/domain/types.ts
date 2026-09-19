/**
 * 状态规则层 —— 共享类型定义。
 * 本层（domain/）为纯函数，不依赖 React、localStorage 或任何 IO。
 */

/** 一张照片的标记：入选 / 待复核 / 排除。每张照片同一时刻只有一份标记。 */
export type Mark = 'selected' | 'review' | 'excluded'

export const MARKS: readonly Mark[] = ['selected', 'review', 'excluded']

export const MARK_LABEL: Record<Mark, string> = {
  selected: '入选',
  review: '待复核',
  excluded: '排除',
}

/** 某张照片当前生效的标记记录（重复提交沿用首次结果时，保留首次的 at）。 */
export interface MarkRecord {
  mark: Mark
  at: number
}

/**
 * 一次成套锁定的留痕版本。锁定后改动标记会让它立即失效，
 * 但版本本身永远保留在 locks 数组中（旧版仍可查）。
 */
export interface LockedVersion {
  id: string
  seriesId: string
  /** 每个系列各自从 1 递增 */
  version: number
  lockedAt: number
  status: 'active' | 'invalidated'
  invalidatedAt?: number
  /** 锁定时刻该系列全部照片的标记快照（只含 入选/排除，无待复核） */
  snapshot: Record<string, Mark>
}

/** 需要持久化的全部业务状态。 */
export interface CullingState {
  schemaVersion: 1
  /** photoId -> 当前标记 */
  marks: Record<string, MarkRecord>
  /** 全部锁定版本（含已失效的旧版），只增不减 */
  locks: LockedVersion[]
}

export function emptyCullingState(): CullingState {
  return { schemaVersion: 1, marks: {}, locks: [] }
}
