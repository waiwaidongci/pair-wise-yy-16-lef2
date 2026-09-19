const TIMELINE = [
  { year: '2013', text: '开始系统学习摄影，最初只拍身边的朋友与街角。' },
  { year: '2016', text: '第一次上高原，在海拔四千米的地方重新理解了光。' },
  { year: '2019', text: '《凝视》系列成形：一批只拍眼神与皮肤纹理的黑白特写。' },
  { year: '2022', text: '深入牧区驻留数月，开始记录牧场、牛群与人的共生日常。' },
  { year: '2025', text: '整理高原系列《无人之境》与《高原牧歌》，并建立这套离线选片流程。' },
]

export function About() {
  return (
    <main className="page">
      <header className="page-head">
        <p className="eyebrow">关于</p>
        <h1>光影之后的人</h1>
      </header>

      <div className="about-grid">
        <section className="about-bio">
          <p>
            我是一名独立摄影师，长期拍摄两类题材：黑白人像特写，以及高原地区的自然风光与牧场生活。
            前者关乎距离——镜头离人多近，人才肯把防备放下来；后者关乎时间——山脊与雾气从不催促任何人。
          </p>
          <p>
            这个网站既是作品集，也是我的工作台：每一组系列在发布前，都会经过一轮完整的
            选片、复核与成套锁定，留下的每一次改动都有迹可查。
          </p>
        </section>

        <section className="timeline" aria-label="经历时间线">
          {TIMELINE.map(item => (
            <div key={item.year} className="timeline-item">
              <span className="timeline-year">{item.year}</span>
              <p>{item.text}</p>
            </div>
          ))}
        </section>
      </div>
    </main>
  )
}
