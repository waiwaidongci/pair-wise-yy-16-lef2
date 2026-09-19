// 选片台领域模型 —— 纯类型定义，不依赖 React / localStorage / 数据源实现。

/** 一张照片当前唯一持有的标记。 */
export type MarkValue = 'selected' | 'pending' | 'excluded'

export const MARK_VALUES: readonly MarkValue[] = ['selected', 'pending', 'excluded']

export const MARK_LABELS: Record<MarkValue, string> = {
  selected: '入选',
  pending: '待复核',
  excluded: '排除',
}

/** 每张照片只保留一份标记记录。 */
export interface MarkRecord {
  photoId: string
  seriesId: string
  mark: MarkValue
  /** 当前标记首次提交的时间；重复提交同一标记时沿用首次结果，不被刷新。 */
  markedAt: number
}

/** 成套版本的留痕状态。 */
export type SetVersionStatus = 'valid' | 'superseded' | 'invalidated'

export const SET_STATUS_LABELS: Record<SetVersionStatus, string> = {
  valid: '有效',
  superseded: '已被新版取代',
  invalidated: '已失效',
}

/** 一次「锁定成套」留下的不可变快照。旧版本永远保留可查。 */
export interface SetVersion {
  id: string
  seriesId: string
  version: number
  lockedAt: number
  /** 锁定时刻全系列照片标记的快照（photoId -> mark）。 */
  marks: Record<string, MarkValue>
  status: SetVersionStatus
  invalidatedAt?: number
  /** 失效原因（哪次改动让成套失效）。 */
  note?: string
}

/** 选片台的全部持久化状态：当前有效标记 + 历史成套版本。 */
export interface SelectionState {
  /** 当前有效标记（live marks），每张照片至多一条。 */
  marks: Record<string, MarkRecord>
  /** 全部历史成套版本（含已失效 / 已被取代），只增不删。 */
  versions: SetVersion[]
}

export const EMPTY_SELECTION: SelectionState = { marks: {}, versions: [] }

/** 校样墙支持的片序。 */
export type ProofOrder = 'sheet' | 'unmarked-first' | 'pending-first' | 'selected-first'

export const PROOF_ORDER_LABELS: Record<ProofOrder, string> = {
  sheet: '按片序',
  'unmarked-first': '未标记优先',
  'pending-first': '待复核优先',
  'selected-first': '入选优先',
}

/** 校样墙的标记筛选。 */
export type MarkFilter = 'all' | 'unmarked' | MarkValue

export const MARK_FILTER_LABELS: Record<MarkFilter, string> = {
  all: '全部',
  unmarked: '未标记',
  selected: '入选',
  pending: '待复核',
  excluded: '排除',
}
