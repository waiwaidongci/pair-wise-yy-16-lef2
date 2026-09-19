import { MARK_LABEL, MARKS, type Mark, type MarkRecord } from '../domain/types'

/** 标记徽章：展示照片当前唯一的一份标记。 */
export function MarkBadge({ record }: { record: MarkRecord | undefined }) {
  if (!record) return <span className="badge badge-unmarked">未标记</span>
  return <span className={`badge badge-${record.mark}`}>{MARK_LABEL[record.mark]}</span>
}

/** 三选一标记按钮组。重复点击当前标记属于重复提交，规则层会沿用首次结果。 */
export function MarkButtons({
  current,
  onSubmit,
  size = 'md',
}: {
  current: Mark | undefined
  onSubmit: (mark: Mark) => void
  size?: 'md' | 'lg'
}) {
  return (
    <div className={`mark-buttons mark-buttons-${size}`} role="group" aria-label="标记">
      {MARKS.map((mark) => (
        <button
          key={mark}
          type="button"
          className={`mark-btn mark-btn-${mark}${current === mark ? ' is-active' : ''}`}
          aria-pressed={current === mark}
          onClick={() => onSubmit(mark)}
        >
          {MARK_LABEL[mark]}
        </button>
      ))}
    </div>
  )
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', { hour12: false })
}
