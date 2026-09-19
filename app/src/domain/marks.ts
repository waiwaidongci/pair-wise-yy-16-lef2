import type { CullingState, Mark } from './types'

/**
 * 提交一份标记。规则：
 * - 照片还没有标记 → 记录为当前标记；
 * - 重复提交同一份标记 → 沿用首次结果（原记录与时间戳不变，状态原样返回）；
 * - 提交不同的标记 → 覆盖为最新标记；若该照片所属系列存在「有效」的锁定版本，
 *   且新标记与快照不一致，则该版本立即失效（旧版保留可查）。
 *
 * 纯函数：不修改入参，返回新状态；无变化时返回原引用，方便上层跳过持久化。
 */
export function applyMark(
  state: CullingState,
  photo: { id: string; seriesId: string },
  mark: Mark,
  now: number,
): CullingState {
  const existing = state.marks[photo.id]
  if (existing && existing.mark === mark) {
    // 重复提交：沿用首次结果
    return state
  }

  const marks = { ...state.marks, [photo.id]: { mark, at: now } }

  // 改动标记使相关系列的有效成套立即失效
  const locks = state.locks.map((lock) => {
    if (
      lock.status === 'active' &&
      lock.seriesId === photo.seriesId &&
      lock.snapshot[photo.id] !== mark
    ) {
      return { ...lock, status: 'invalidated' as const, invalidatedAt: now }
    }
    return lock
  })

  return { ...state, marks, locks }
}
