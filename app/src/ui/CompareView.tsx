import { photoById, seriesList } from '../data/photos'
import { seriesStats } from '../domain/selectors'
import { useCulling } from './store'

/**
 * 跨系列比较：只读取当前有效标记（state.marks）。
 * 历史锁定版本的快照不参与这里的任何统计，避免新旧标记混用。
 */
export function CompareView() {
  const { state } = useCulling()
  const stats = seriesList.map((s) => ({ series: s, stats: seriesStats(s, state.marks) }))

  return (
    <section className="view-compare">
      <p className="view-note">以下统计仅基于各系列的当前有效标记；历史锁定快照不参与比较。</p>
      <div className="compare-table-wrap">
        <table className="compare-table">
          <thead>
            <tr>
              <th>系列</th>
              <th>入选</th>
              <th>待复核</th>
              <th>排除</th>
              <th>未标记</th>
              <th>入选率</th>
            </tr>
          </thead>
          <tbody>
            {stats.map(({ series, stats: st }) => (
              <tr key={series.id}>
                <th scope="row">{series.title}</th>
                <td>{st.selected}</td>
                <td>{st.review}</td>
                <td>{st.excluded}</td>
                <td>{st.unmarked}</td>
                <td>
                  <div className="ratio-cell">
                    <div className="ratio-bar">
                      <div className="ratio-fill" style={{ width: `${Math.round(st.selectedRatio * 100)}%` }} />
                    </div>
                    <span>{Math.round(st.selectedRatio * 100)}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="compare-selected">
        {stats.map(({ series, stats: st }) => (
          <section key={series.id} className="compare-col">
            <h3>{series.title} · 当前入选 {st.selected} 张</h3>
            {st.selectedIds.length === 0 ? (
              <p className="empty-hint">暂无入选照片。</p>
            ) : (
              <ul>
                {st.selectedIds.map((id) => (
                  <li key={id}>{photoById.get(id)?.title ?? id}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </section>
  )
}
