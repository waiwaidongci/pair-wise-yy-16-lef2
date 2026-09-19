// 记录存储层 —— 负责把选片状态与界面偏好写入 localStorage 并读回。
// 本模块不 import React，也不包含任何状态规则（规则全在 rules.ts）；
// 读回的数据一律经 rules.normalizeSelection 校验后才交给上层。

import { normalizeSelection } from './rules'
import {
  EMPTY_SELECTION,
  type MarkFilter,
  type ProofOrder,
  type SelectionState,
} from './types'
import type { CategoryId } from '../data/photos'

const SELECTION_KEY = 'photolog.selection.v1'
const UI_PREFS_KEY = 'photolog.ui.v1'

/** 可注入的存储后端（默认 localStorage），便于测试与降级。 */
export interface StorageBackend {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

function defaultBackend(): StorageBackend | null {
  try {
    if (typeof localStorage !== 'undefined') return localStorage
  } catch {
    // 隐私模式等场景下访问 localStorage 会抛错 —— 降级为内存态
  }
  return null
}

// ---------------------------------------------------------------------------
// 选片状态（标记 + 成套版本）
// ---------------------------------------------------------------------------

export function loadSelection(backend: StorageBackend | null = defaultBackend()): SelectionState {
  if (!backend) return EMPTY_SELECTION
  try {
    const raw = backend.getItem(SELECTION_KEY)
    if (!raw) return EMPTY_SELECTION
    return normalizeSelection(JSON.parse(raw))
  } catch {
    return EMPTY_SELECTION
  }
}

export function saveSelection(
  state: SelectionState,
  backend: StorageBackend | null = defaultBackend(),
): void {
  if (!backend) return
  try {
    backend.setItem(SELECTION_KEY, JSON.stringify(state))
  } catch {
    // 存储写失败（配额等）不阻断交互；内存态仍然一致
  }
}

// ---------------------------------------------------------------------------
// 界面偏好：筛选、片序、复核模式 —— 刷新后需与锁定时一致
// ---------------------------------------------------------------------------

export type WorkFilter = CategoryId | 'all'
export type ReviewMode = 'wall' | 'single'

export interface ReviewPrefs {
  seriesId: string
  markFilter: MarkFilter
  order: ProofOrder
  mode: ReviewMode
}

export interface UiPrefs {
  /** /work 的分类筛选。 */
  workFilter: WorkFilter
  /** 选片台的系列、标记筛选、片序与复核模式。 */
  review: ReviewPrefs
}

export const DEFAULT_UI_PREFS: UiPrefs = {
  workFilter: 'all',
  review: { seriesId: 'gaze', markFilter: 'all', order: 'sheet', mode: 'wall' },
}

const WORK_FILTERS: WorkFilter[] = ['all', 'portrait', 'landscape', 'pastoral']
const MARK_FILTERS: MarkFilter[] = ['all', 'unmarked', 'selected', 'pending', 'excluded']
const PROOF_ORDERS: ProofOrder[] = ['sheet', 'unmarked-first', 'pending-first', 'selected-first']
const REVIEW_MODES: ReviewMode[] = ['wall', 'single']

export function loadUiPrefs(backend: StorageBackend | null = defaultBackend()): UiPrefs | null {
  if (!backend) return null
  try {
    const raw = backend.getItem(UI_PREFS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<UiPrefs>
    const review = (parsed.review ?? {}) as Partial<ReviewPrefs>
    return {
      workFilter: WORK_FILTERS.includes(parsed.workFilter as WorkFilter)
        ? (parsed.workFilter as WorkFilter)
        : DEFAULT_UI_PREFS.workFilter,
      review: {
        seriesId: typeof review.seriesId === 'string' ? review.seriesId : DEFAULT_UI_PREFS.review.seriesId,
        markFilter: MARK_FILTERS.includes(review.markFilter as MarkFilter)
          ? (review.markFilter as MarkFilter)
          : DEFAULT_UI_PREFS.review.markFilter,
        order: PROOF_ORDERS.includes(review.order as ProofOrder)
          ? (review.order as ProofOrder)
          : DEFAULT_UI_PREFS.review.order,
        mode: REVIEW_MODES.includes(review.mode as ReviewMode)
          ? (review.mode as ReviewMode)
          : DEFAULT_UI_PREFS.review.mode,
      },
    }
  } catch {
    return null
  }
}

export function saveUiPrefs(
  prefs: UiPrefs,
  backend: StorageBackend | null = defaultBackend(),
): void {
  if (!backend) return
  try {
    backend.setItem(UI_PREFS_KEY, JSON.stringify(prefs))
  } catch {
    // 同上：写失败不阻断交互
  }
}
