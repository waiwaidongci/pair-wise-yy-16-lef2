import { allSeries, categoryLabel, seriesById } from '../data/photos'
import { useSelection } from '../selection/SelectionContext'

function formatTime(ts: number): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ts))
}

const SET_STATE_LABELS = {
  draft: '未锁定',
  valid: '成套有效',
  invalidated: '已失效',
} as const

/**
 * 跨系列比较 —— 统计完全来自当前有效标记（live marks）。
 * 已失效成套的历史快照只出现在选片台的留痕里，绝不参与本页统计。
 */
export function Compare() {
  const selection = useSelection()
  const rows = selection.comparison()

  const totals = rows.reduce(
    (acc, r) => ({
      selected: acc.selected + r.tally.selected,
      pending: acc.pending + r.tally.pending,
      excluded: acc.excluded + r.tally.excluded,
      unmarked: acc.unmarked + r.tally.unmarked,
      total: acc.total + r.tally.total,
    }),
    { selected: 0, pending: 0, excluded: 0, unmarked: 0, total: 0 },
  )

  return (
    <main className="page compare-page">
      <header className="page-head">
        <p className="eyebrow">跨系列比较</p>
        <h1>三套系列对照</h1>
        <p className="lede">
          本页只读取各系列的当前有效标记；已失效成套的旧标记不参与统计，避免新旧混用。
        </p>
      </header>

      <div className="compare-table" role="table" aria-label="跨系列标记比较">
        <div className="compare-row compare-head" role="row">
          <span role="columnheader">系列</span>
          <span role="columnheader">入选</span>
          <span role="columnheader">待复核</span>
          <span role="columnheader">排除</span>
          <span role="columnheader">未标记</span>
          <span role="columnheader">成套状态</span>
        </div>
        {rows.map(row => {
          const series = seriesById(row.seriesId)!
          const marked = row.tally.total - row.tally.unmarked
          return (
            <div className="compare-row" role="row" key={row.seriesId} data-series-id={row.seriesId}>
              <span role="cell" className="compare-series">
                <strong>{series.title}</strong>
                <span className="compare-category">{categoryLabel(series.category)}</span>
                <span className="compare-progress">
                  <span
                    className="compare-progress-bar"
                    style={{ width: `${row.tally.total ? (marked / row.tally.total) * 100 : 0}%` }}
                  />
                </span>
              </span>
              <span role="cell" className="num mark-selected" data-stat="selected">
                {row.tally.selected}
              </span>
              <span role="cell" className="num mark-pending" data-stat="pending">
                {row.tally.pending}
              </span>
              <span role="cell" className="num mark-excluded" data-stat="excluded">
                {row.tally.excluded}
              </span>
              <span role="cell" className="num" data-stat="unmarked">
                {row.tally.unmarked}
              </span>
              <span role="cell" className={`compare-status status-${row.setState}`}>
                {row.setState === 'valid' && row.currentVersion !== null
                  ? `v${row.currentVersion} 有效 · ${formatTime(row.lockedAt!)}`
                  : row.setState === 'invalidated'
                    ? `已失效（${row.invalidatedCount} 版留痕）`
                    : SET_STATE_LABELS[row.setState]}
              </span>
            </div>
          )
        })}
        <div className="compare-row compare-total" role="row">
          <span role="cell">
            <strong>合计 · {allSeries.length} 个系列</strong>
          </span>
          <span role="cell" className="num mark-selected">{totals.selected}</span>
          <span role="cell" className="num mark-pending">{totals.pending}</span>
          <span role="cell" className="num mark-excluded">{totals.excluded}</span>
          <span role="cell" className="num">{totals.unmarked}</span>
          <span role="cell" className="compare-status">共 {totals.total} 张</span>
        </div>
      </div>

      <p className="compare-note" role="note">
        说明：统计口径为「当前有效标记」。某套系列锁定后若改动了标记，该成套立即失效，
        本页随即按改动后的当前标记重新计数；旧版本快照仅保留在选片台的留痕中供查阅。
      </p>
    </main>
  )
}
