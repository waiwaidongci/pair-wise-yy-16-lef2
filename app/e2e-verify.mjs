/**
 * 浏览器实测脚本：验证「离线选片与成套留痕台」的关键行为。
 * 运行前需已执行 npm run build。用法：node e2e-verify.mjs
 */
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'

const PORT = 4173
const BASE = `http://127.0.0.1:${PORT}`
const STATE_KEY = 'culling-trail:v1:state'

let passed = 0
let failed = 0
function check(name, cond) {
  if (cond) {
    passed += 1
    console.log(`  ✓ ${name}`)
  } else {
    failed += 1
    console.error(`  ✗ ${name}`)
  }
}

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--host', '127.0.0.1'], {
  cwd: new URL('.', import.meta.url).pathname,
  stdio: 'pipe',
})
await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('preview server start timeout')), 20000)
  server.stdout.on('data', (d) => {
    if (String(d).includes('Local:')) {
      clearTimeout(timer)
      resolve()
    }
  })
  server.on('exit', () => reject(new Error('preview server exited early')))
})

const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }})
  const externalFontReqs = []
  page.on('request', (req) => {
    const url = req.url()
    if (/fonts\.(googleapis|gstatic)\.com/.test(url)) externalFontReqs.push(url)
  })

  // ---------- 1. 校样墙按片序展示 ----------
  console.log('\n[1] 校样墙片序')
  await page.goto(BASE, { waitUntil: 'networkidle' })
  const ids = await page.$$eval('.proof-card', (els) => els.map((e) => e.dataset.photoId))
  const expected = [
    'portrait-01', 'portrait-02', 'portrait-03', 'portrait-04', 'portrait-05',
    'landscape-01', 'landscape-02', 'landscape-03', 'landscape-04', 'landscape-05',
    'pastoral-01', 'pastoral-02', 'pastoral-03', 'pastoral-04',
  ]
  check('14 张照片按片序排列', JSON.stringify(ids) === JSON.stringify(expected))

  // ---------- 2. 标记唯一 + 重复提交沿用首次结果 ----------
  console.log('\n[2] 标记与重复提交')
  const card = page.locator('.proof-card[data-photo-id="portrait-01"]')
  await card.locator('.mark-btn-selected').click()
  const readState = () => page.evaluate((k) => JSON.parse(localStorage.getItem(k)), STATE_KEY)
  let st = await readState()
  check('首次标记已持久化', st.marks['portrait-01']?.mark === 'selected')
  const firstAt = st.marks['portrait-01'].at
  await page.waitForTimeout(50)
  await card.locator('.mark-btn-selected').click()
  st = await readState()
  check('重复提交沿用首次结果（时间戳不变）', st.marks['portrait-01'].at === firstAt)
  await card.locator('.mark-btn-excluded').click()
  st = await readState()
  check('改标后只保留最新一份标记', st.marks['portrait-01'].mark === 'excluded' && Object.keys(st.marks).length === 1)
  await card.locator('.mark-btn-selected').click() // 恢复为入选，供后续锁定

  // ---------- 3. 锁定前置条件 ----------
  console.log('\n[3] 锁定前置条件')
  const gazeLockBtn = page.locator('.series-block', { has: page.locator('h2', { hasText: '凝视' }) }).locator('.lock-btn')
  check('未覆盖全部照片时锁定按钮禁用', await gazeLockBtn.isDisabled())
  const gazeIds = ['portrait-02', 'portrait-03', 'portrait-04', 'portrait-05']
  for (const id of gazeIds) {
    await page.locator(`.proof-card[data-photo-id="${id}"] .mark-btn-selected`).click()
  }
  await page.locator('.proof-card[data-photo-id="portrait-05"] .mark-btn-review').click()
  check('存在待复核时锁定按钮仍禁用', await gazeLockBtn.isDisabled())
  await page.locator('.proof-card[data-photo-id="portrait-05"] .mark-btn-excluded').click()
  check('全覆盖且无待复核后锁定按钮可用', await gazeLockBtn.isEnabled())

  // ---------- 4. 锁定 → 改动 → 立即失效，旧版可查 ----------
  console.log('\n[4] 锁定、失效与留痕')
  await gazeLockBtn.click()
  const gazeBlock = page.locator('.series-block', { has: page.locator('h2', { hasText: '凝视' }) })
  check('锁定后显示有效成套', (await gazeBlock.locator('.badge-lock-active').textContent())?.includes('v1'))
  await page.locator('.proof-card[data-photo-id="portrait-03"] .mark-btn-excluded').click()
  check('改动标记后成套立即失效', await gazeBlock.locator('.badge-lock-invalid').isVisible())
  st = await readState()
  check('旧版记录仍保留且快照未被改写', st.locks.length === 1 && st.locks[0].status === 'invalidated' && st.locks[0].snapshot['portrait-03'] === 'selected')

  await page.locator('.tab', { hasText: '成套留痕' }).click()
  await page.locator('.version-head').first().click()
  const diverged = await page.locator('.version-detail li.is-diverged').count()
  check('留痕明细标出与当前不一致的照片', diverged === 1)

  // ---------- 5. 跨系列比较只读当前有效标记 ----------
  console.log('\n[5] 跨系列比较')
  await page.locator('.tab', { hasText: '跨系列比较' }).click()
  const gazeRow = page.locator('.compare-table tbody tr', { hasText: '凝视' })
  const cells = await gazeRow.locator('td').allTextContents()
  // 当前：selected x3 (01,02,04), excluded x2 (03,05) —— 快照里的 portrait-03=selected 不得混入
  check('入选统计为当前值 3 而非快照值 4', cells[0].trim() === '3')
  check('排除统计为当前值 2', cells[2].trim() === '2')

  // ---------- 6. 刷新后筛选 / 片序 / 锁定状态一致 ----------
  console.log('\n[6] 刷新一致性')
  await page.locator('.tab', { hasText: '校样墙' }).click()
  await page.locator('.chip', { hasText: '凝视' }).first().click()
  await page.locator('.chip', { hasText: '按标记分组' }).click()
  await page.reload({ waitUntil: 'networkidle' })
  const idsAfter = await page.$$eval('.proof-card', (els) => els.map((e) => e.dataset.photoId))
  check('刷新后系列筛选保持（仅凝视 5 张）', idsAfter.length === 5 && idsAfter.every((id) => id.startsWith('portrait')))
  check('刷新后片序模式保持（按标记分组：排除排最后）', idsAfter[idsAfter.length - 1] === 'portrait-03' || idsAfter[idsAfter.length - 1] === 'portrait-05')
  check('刷新后锁定失效状态保持', await page.locator('.badge-lock-invalid').first().isVisible())
  st = await readState()
  check('刷新后留痕记录仍在', st.locks.length === 1 && st.locks[0].status === 'invalidated')

  // ---------- 7. 移动端逐张复核 ----------
  console.log('\n[7] 移动端逐张复核')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.locator('.tab', { hasText: '逐张复核' }).click()
  const cols = await page.evaluate(() => {
    const stage = document.querySelector('.review-stage')
    return getComputedStyle(stage).gridTemplateColumns.split(' ').length
  })
  check('移动端复核区为单列布局', cols === 1)
  await page.locator('.review-series-row .chip', { hasText: '高原牧歌' }).click()
  const posBefore = await page.locator('.review-position').textContent()
  await page.locator('.mark-buttons-lg .mark-btn-selected').click()
  const posAfter = await page.locator('.review-position').textContent()
  check('移动端标记后自动前进到下一张', posBefore?.includes('第 1 / 4') && posAfter?.includes('第 2 / 4'))
  await page.reload({ waitUntil: 'networkidle' })
  const posAfterReload = await page.locator('.review-position').textContent()
  check('刷新后复核位置保持', posAfterReload?.includes('第 2 / 4'))

  // ---------- 8. 无外部字体请求 ----------
  console.log('\n[8] 离线字体')
  check('无任何外部字体 CDN 请求', externalFontReqs.length === 0)
} finally {
  await browser.close()
  server.kill()
}

console.log(`\n结果：${passed} 通过，${failed} 失败`)
process.exit(failed === 0 ? 0 : 1)
