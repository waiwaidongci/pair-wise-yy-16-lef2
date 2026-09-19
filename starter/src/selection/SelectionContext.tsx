// 界面桥接层 —— 唯一的 React 粘合处：
// 状态规则来自 selection/rules.ts（纯函数），记录存取来自 selection/storage.ts，
// 组件只消费本 context，不直接触碰规则细节或 localStorage。

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { allSeries, photosForSeries, type Photo } from '../data/photos'
import {
  applyMark,
  compareSeries,
  filterProofItems,
  liveTally,
  lockReadiness,
  lockSet,
  orderProofItems,
  proofItems,
  setStatusForSeries,
  type LockReadiness,
  type MarkTally,
  type ProofItem,
  type SeriesComparison,
  type SeriesSetStatus,
} from './rules'
import {
  DEFAULT_UI_PREFS,
  loadSelection,
  loadUiPrefs,
  saveSelection,
  saveUiPrefs,
  type ReviewPrefs,
  type UiPrefs,
  type WorkFilter,
} from './storage'
import type { MarkFilter, MarkValue, ProofOrder, SelectionState } from './types'

interface SelectionApi {
  state: SelectionState
  /** 提交标记；重复提交同一标记时规则层会沿用首次结果。 */
  markPhoto: (photo: Photo, mark: MarkValue) => void
  /** 清除某张照片的标记（回到未标记）。 */
  clearMark: (photo: Photo) => void
  /** 尝试锁定成套；前置条件不满足时返回 false 且不产生任何记录。 */
  lockSeries: (seriesId: string) => boolean
  readiness: (seriesId: string) => LockReadiness
  setStatus: (seriesId: string) => SeriesSetStatus
  tally: (seriesId: string) => MarkTally
  /** 校样墙条目：已按当前片序与筛选派生。 */
  wallItems: (seriesId: string, order: ProofOrder, filter: MarkFilter) => ProofItem[]
  /** 跨系列比较：只读取当前有效标记。 */
  comparison: () => SeriesComparison[]
}

const SelectionContext = createContext<SelectionApi | null>(null)

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SelectionState>(() => loadSelection())

  // 任何状态变化立即落盘 —— 刷新后标记与锁定状态保持一致
  useEffect(() => {
    saveSelection(state)
  }, [state])

  const api = useMemo<SelectionApi>(() => {
    const photosOf = (seriesId: string) => photosForSeries(seriesId)
    return {
      state,
      markPhoto: (photo, mark) =>
        setState(s => applyMark(s, { id: photo.id, seriesId: photo.seriesId }, mark, Date.now())),
      clearMark: photo =>
        setState(s => applyMark(s, { id: photo.id, seriesId: photo.seriesId }, null, Date.now())),
      lockSeries: seriesId => {
        const readiness = lockReadiness(state, photosOf(seriesId))
        if (!readiness.ok) return false
        setState(s => lockSet(s, seriesId, photosOf(seriesId), Date.now()))
        return true
      },
      readiness: seriesId => lockReadiness(state, photosOf(seriesId)),
      setStatus: seriesId => setStatusForSeries(state, seriesId),
      tally: seriesId => liveTally(state, photosOf(seriesId)),
      wallItems: (seriesId, order, filter) =>
        filterProofItems(orderProofItems(proofItems(state, photosOf(seriesId)), order), filter),
      comparison: () => compareSeries(state, allSeries, photosOf),
    }
  }, [state])

  return <SelectionContext.Provider value={api}>{children}</SelectionContext.Provider>
}

export function useSelection(): SelectionApi {
  const ctx = useContext(SelectionContext)
  if (!ctx) throw new Error('useSelection 必须在 <SelectionProvider> 内使用')
  return ctx
}

// ---------------------------------------------------------------------------
// 界面偏好：筛选、片序、复核模式 —— 刷新后保持一致
// ---------------------------------------------------------------------------

interface UiPrefsApi {
  prefs: UiPrefs
  setWorkFilter: (filter: WorkFilter) => void
  setReviewPrefs: (patch: Partial<ReviewPrefs>) => void
}

const UiPrefsContext = createContext<UiPrefsApi | null>(null)

function initialPrefs(): UiPrefs {
  const stored = loadUiPrefs()
  if (stored) return stored
  // 首次访问且为窄屏：默认进入逐张复核模式，移动端开箱即可逐张过片
  const preferSingle =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(max-width: 768px)').matches
      : false
  return {
    ...DEFAULT_UI_PREFS,
    review: { ...DEFAULT_UI_PREFS.review, mode: preferSingle ? 'single' : 'wall' },
  }
}

export function UiPrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<UiPrefs>(initialPrefs)

  useEffect(() => {
    saveUiPrefs(prefs)
  }, [prefs])

  const api = useMemo<UiPrefsApi>(
    () => ({
      prefs,
      setWorkFilter: filter => setPrefs(p => ({ ...p, workFilter: filter })),
      setReviewPrefs: patch =>
        setPrefs(p => ({ ...p, review: { ...p.review, ...patch } })),
    }),
    [prefs],
  )

  return <UiPrefsContext.Provider value={api}>{children}</UiPrefsContext.Provider>
}

export function useUiPrefs(): UiPrefsApi {
  const ctx = useContext(UiPrefsContext)
  if (!ctx) throw new Error('useUiPrefs 必须在 <UiPrefsProvider> 内使用')
  return ctx
}
