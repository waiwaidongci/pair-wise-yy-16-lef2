// 端到端浏览器验证脚本 —— 覆盖：
//  A. 基础作品集约束（路由 / 筛选保持 / 灯箱限定范围 / CLS / 响应式 / 离线字体 / 表单）
//  B. 选片台新需求（校样墙片序、唯一标记与重复提交、锁定门槛、失效与留痕、
//     跨系列比较只读当前标记、刷新持久化、移动端逐张复核）
// 运行：先 `npm run dev -- --port 5173`，再 `node e2e-verify.mjs`

import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:5173'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const photoData = JSON.parse(readFileSync(path.join(__dirname, '../mock-data/photos.json'), 'utf8'))

let failures = 0
function check(name, cond, extra = '') {
  const ok = Boolean(cond)
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : extra ? ` —— ${extra}` : ''}`)
  if (!ok) failures += 1
}
function section(title) {
  console.log(`\n── ${title}`)
}

const browser = await chromium.launch()

async function newPage(viewport = { width: 1440, height: 1000 }) {
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  const consoleErrors = []
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', err => consoleErrors.push(String(err)))
  return { context, page, consoleErrors }
}

// ---------------------------------------------------------------------------
section('A1. 五个路由渲染 + 控制台无 error')
{
  const { context, page, consoleErrors } = await newPage()
  for (const route of ['/', '/work', '/work/highland-pastoral', '/about', '/contact', '/review', '/compare']) {
    await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' })
    check(`路由 ${route} 渲染出 <main>`, await page.locator('main').isVisible())
  }
  check('全程无 console error', consoleErrors.length === 0, consoleErrors.join(' | '))
  await context.close()
}

// ---------------------------------------------------------------------------
section('A2. 首页精选卡片打开的是同一个共享灯箱')
{
  const { context, page } = await newPage()
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.locator('.series-card').first().click()
  check('首页 .series-card 点击后灯箱打开', await page.locator('.lightbox[role="dialog"]').isVisible())
  const eyebrow = await page.locator('.lightbox-info .eyebrow').textContent()
  check('灯箱计数器为 1 / 5（凝视系列范围）', /1\s*\/\s*5/.test(eyebrow ?? ''), eyebrow)
  await page.getByRole('button', { name: '关闭' }).click()
  check('关闭后灯箱卸载', (await page.locator('.lightbox[role="dialog"]').count()) === 0)
  await context.close()
}

// ---------------------------------------------------------------------------
section('A3. /work 筛选保持（导航往返 + 刷新后仍保持）')
{
  const { context, page } = await newPage()
  await page.goto(`${BASE}/work`, { waitUntil: 'networkidle' })
  const filterLabels = await page.locator('.filters button').allTextContents()
  check('筛选项为 全部/肖像/风光/牧野', JSON.stringify(filterLabels) === JSON.stringify(['全部', '肖像', '风光', '牧野']), filterLabels.join(','))

  await page.getByRole('button', { name: '牧野' }).click()
  check('筛选后剩 4 张牧野照片', (await page.locator('.photo-button').count()) === 4)

  await page.getByRole('link', { name: /高原牧歌/ }).click()
  await page.waitForURL(/highland-pastoral/)
  await page.goBack()
  await page.waitForURL(/\/work$/)
  check('返回后「牧野」仍为选中态', await page.getByRole('button', { name: '牧野' }).getAttribute('aria-pressed') === 'true')
  check('返回后仍只有 4 张照片', (await page.locator('.photo-button').count()) === 4)

  await page.reload({ waitUntil: 'networkidle' })
  check('刷新后「牧野」筛选仍保持', await page.getByRole('button', { name: '牧野' }).getAttribute('aria-pressed') === 'true')
  check('刷新后仍只有 4 张照片', (await page.locator('.photo-button').count()) === 4)
  await context.close()
}

// ---------------------------------------------------------------------------
section('A4. 灯箱导航限定在当前筛选结果内循环')
{
  const { context, page } = await newPage()
  await page.goto(`${BASE}/work`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: '牧野' }).click()
  await page.locator('.photo-button').first().click()
  await page.locator('.lightbox[role="dialog"]').waitFor()

  const seen = []
  for (let i = 0; i < 5; i++) {
    seen.push((await page.locator('.lightbox-info h2').textContent())?.trim())
    await page.getByRole('button', { name: '下一张' }).click()
  }
  const pastoralTitles = photoData.photos.filter(p => p.category === 'pastoral').map(p => p.title)
  check('连续导航只出现牧野照片', seen.every(t => pastoralTitles.includes(t)), seen.join(','))
  check('4 次「下一张」后循环回起点', seen[4] === seen[0], JSON.stringify(seen))
  check('前 4 张互不重复', new Set(seen.slice(0, 4)).size === 4)
  const counter = await page.locator('.lightbox-info .eyebrow').textContent()
  check('计数器为 x / 4 而非 x / 14', /\/\s*4/.test(counter ?? ''), counter)
  await context.close()
}

// ---------------------------------------------------------------------------
section('A5. 图片加载前已按数据宽高预留比例（CLS）')
{
  const { context, page } = await newPage()
  await page.route('**/*.jpg', async route => {
    await new Promise(r => setTimeout(r, 600))
    await route.continue()
  })
  await page.goto(`${BASE}/work`, { waitUntil: 'domcontentloaded' })
  const first = photoData.photos[0]
  const box = await page.locator('.photo-button .ratio-box').first().boundingBox()
  const ratio = box.width / box.height
  const expected = first.width / first.height
  check('加载前 .ratio-box 宽高比与数据一致（误差<1%）', Math.abs(ratio - expected) / expected < 0.01, `实际 ${ratio.toFixed(4)} 期望 ${expected.toFixed(4)}`)
  const before = await page.locator('.photo-button').nth(1).boundingBox()
  await page.waitForLoadState('networkidle')
  const after = await page.locator('.photo-button').nth(1).boundingBox()
  check('图片加载完成后相邻卡片位置不移动（<1px）', Math.abs(before.y - after.y) < 1, `${before.y} → ${after.y}`)
  await context.close()
}

// ---------------------------------------------------------------------------
section('A6. 系列详情页共享数据模型（顺序/标题/引言）')
{
  const { context, page } = await newPage()
  await page.goto(`${BASE}/work/highland-pastoral`, { waitUntil: 'networkidle' })
  const expected = photoData.photos.filter(p => p.seriesId === 'highland-pastoral').sort((a, b) => a.order - b.order)
  const titles = await page.locator('.story article h2').allTextContents()
  check('渲染标题顺序与 order 派生一致', JSON.stringify(titles) === JSON.stringify(expected.map(p => p.title)), titles.join(','))
  const quote = await page.locator('.pull-quote').textContent()
  check('系列 summary 以引言样式呈现', quote?.includes('高原牧歌') || quote?.includes('共生关系'), quote)
  await page.locator('.story .photo-button').first().click()
  check('系列页照片打开的仍是共享灯箱', await page.locator('.lightbox[role="dialog"]').isVisible())
  await context.close()
}

// ---------------------------------------------------------------------------
section('A7. 移动端：单列网格 + 灯箱说明底部条')
{
  const { context, page } = await newPage({ width: 390, height: 844 })
  await page.goto(`${BASE}/work`, { waitUntil: 'networkidle' })
  const first = await page.locator('.photo-button').first().boundingBox()
  const second = await page.locator('.photo-button').nth(1).boundingBox()
  check('网格切换为单列（第 2 张在第 1 张下方）', second.y > first.y + first.height - 2, `y: ${first.y} → ${second.y}`)
  check('汉堡菜单可见', await page.locator('.menu').isVisible())
  await page.locator('.photo-button').first().click()
  await page.locator('.lightbox[role="dialog"]').waitFor()
  const img = await page.locator('.lightbox-image').boundingBox()
  const info = await page.locator('.lightbox-info').boundingBox()
  check('灯箱说明位于图片下方（底部条）', info.y >= img.y + img.height - 2, `img 底 ${img.y + img.height} vs info 顶 ${info.y}`)
  await context.close()
}

// ---------------------------------------------------------------------------
section('A8. 离线字体：无外部字体 CDN 请求')
{
  const { context, page } = await newPage()
  const urls = []
  page.on('request', req => urls.push(req.url()))
  for (const route of ['/', '/work', '/review', '/compare', '/about', '/contact']) {
    await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' })
  }
  const external = urls.filter(u => /fonts\.googleapis\.com|fonts\.gstatic\.com/.test(u))
  check('无任何 Google Fonts 请求', external.length === 0, external.join(','))
  const localFonts = new Set(urls.filter(u => u.includes('/fonts/') && u.endsWith('.woff2')))
  check('本地 woff2 字体 ≥ 2 个被加载', localFonts.size >= 2, [...localFonts].join(','))
  await context.close()
}

// ---------------------------------------------------------------------------
section('A9. 联系表单：校验、禁用与成功态')
{
  const { context, page } = await newPage()
  await page.goto(`${BASE}/contact`, { waitUntil: 'networkidle' })
  const submit = page.getByRole('button', { name: '发送消息' })
  check('初始提交按钮禁用', await submit.isDisabled())
  await page.getByLabel('邮箱').fill('bad')
  await page.getByLabel('邮箱').blur()
  check('非法邮箱显示行内错误', await page.getByText('请输入有效的邮箱地址').isVisible())
  await page.getByLabel('姓名').fill('访客')
  await page.getByLabel('邮箱').fill('hello@example.com')
  await page.getByLabel('留言').fill('想了解一项完整的摄影合作计划，谢谢。')
  check('填写合法后提交按钮启用', await submit.isEnabled())
  await submit.click()
  await page.getByText('谢谢你的来信').waitFor({ timeout: 3000 }).catch(() => {})
  check('提交后出现成功态', await page.getByText('谢谢你的来信').isVisible())
  await context.close()
}

// ---------------------------------------------------------------------------
section('B1. 校样墙按片序展示 + 唯一标记 + 重复提交沿用首次结果')
{
  const { context, page } = await newPage()
  await page.goto(`${BASE}/review`, { waitUntil: 'networkidle' })

  const ids = await page.locator('.proof-card').evaluateAll(cards => cards.map(c => c.getAttribute('data-photo-id')))
  const expectedIds = photoData.series.find(s => s.id === 'gaze').photoIds
  check('校样墙按片序展示凝视系列 5 张', JSON.stringify(ids) === JSON.stringify(expectedIds), ids?.join(','))

  const firstCard = page.locator('.proof-card').first()
  await firstCard.getByRole('button', { name: '入选' }).click()
  const markedAt1 = await firstCard.getAttribute('data-marked-at')
  check('首次标记后 data-mark=selected', (await firstCard.getAttribute('data-mark')) === 'selected')
  check('markedAt 已记录', Boolean(markedAt1))

  await page.waitForTimeout(80)
  await firstCard.getByRole('button', { name: '入选' }).click() // 重复提交
  const markedAt2 = await firstCard.getAttribute('data-marked-at')
  check('重复提交沿用首次结果（markedAt 不变）', markedAt1 === markedAt2, `${markedAt1} → ${markedAt2}`)

  await firstCard.getByRole('button', { name: '排除' }).click()
  check('改标后仍只有一份标记（data-mark=excluded）', (await firstCard.getAttribute('data-mark')) === 'excluded')
  const pressed = await firstCard.locator('.mark-btn[aria-pressed="true"]').count()
  check('同一时刻只有一个标记按钮处于选中态', pressed === 1, `pressed=${pressed}`)
  await context.close()
}

// ---------------------------------------------------------------------------
section('B2. 锁定门槛：未覆盖全部照片或存在待复核时不可锁定')
{
  const { context, page } = await newPage()
  await page.goto(`${BASE}/review`, { waitUntil: 'networkidle' })
  const lockBtn = page.getByRole('button', { name: '锁定成套' })
  check('未标记时锁定按钮禁用', await lockBtn.isDisabled())
  check('提示说明缺口', await page.locator('.lock-hint').isVisible())

  // 标记 4 张，其中 1 张待复核，1 张不标
  const cards = page.locator('.proof-card')
  await cards.nth(0).getByRole('button', { name: '入选' }).click()
  await cards.nth(1).getByRole('button', { name: '待复核' }).click()
  await cards.nth(2).getByRole('button', { name: '排除' }).click()
  await cards.nth(3).getByRole('button', { name: '入选' }).click()
  check('仍有未标记 + 待复核时锁定按钮禁用', await lockBtn.isDisabled())
  const hint = await page.locator('.lock-hint').textContent()
  check('提示包含未标记与待复核数量', /1 张未标记/.test(hint) && /1 张待复核/.test(hint), hint)

  await cards.nth(1).getByRole('button', { name: '排除' }).click() // 待复核 → 排除
  check('仍有未标记时锁定按钮禁用', await lockBtn.isDisabled())
  await cards.nth(4).getByRole('button', { name: '入选' }).click()
  check('全部覆盖且无待复核后锁定按钮启用', await lockBtn.isEnabled())
  await context.close()
}

// ---------------------------------------------------------------------------
section('B3. 锁定 → 改动失效 → 旧版可查 → 重新锁定 → 刷新一致')
{
  const { context, page } = await newPage()
  await page.goto(`${BASE}/review`, { waitUntil: 'networkidle' })
  const cards = page.locator('.proof-card')
  const marks = ['入选', '排除', '入选', '入选', '排除']
  for (let i = 0; i < 5; i++) await cards.nth(i).getByRole('button', { name: marks[i] }).click()

  await page.getByRole('button', { name: '锁定成套' }).click()
  check('锁定后横幅显示 v1 有效', await page.locator('.set-banner.set-valid').isVisible())
  check('留痕中出现 v1 有效版本', (await page.locator('.version-row').count()) === 1)

  // 锁定后改动一张 → 立即失效
  await cards.nth(0).getByRole('button', { name: '排除' }).click()
  check('改动标记后横幅立即变为已失效', await page.locator('.set-banner.set-invalid').isVisible())
  const v1row = page.locator('.version-row').first()
  check('v1 状态为已失效', (await v1row.locator('.version-status').textContent())?.includes('已失效'))

  // 旧版仍可查：展开 v1 快照，portrait-01 仍是锁定时的「入选」
  await v1row.locator('summary').click()
  const snapshotRow = v1row.locator('.version-snapshot li', { hasText: 'portrait-01' })
  check('旧版快照保留锁定时标记（portrait-01=入选）', (await snapshotRow.locator('.snapshot-mark').textContent()) === '入选')
  const liveMark = await cards.nth(0).getAttribute('data-mark')
  check('当前标记已是改动后的 excluded', liveMark === 'excluded')

  // 刷新：筛选/片序/锁定状态一致
  await page.locator('.order-select select').selectOption('selected-first')
  await page.locator('.mark-filters button', { hasText: '排除' }).click()
  await page.reload({ waitUntil: 'networkidle' })
  check('刷新后失效横幅仍在', await page.locator('.set-banner.set-invalid').isVisible())
  check('刷新后标记筛选保持（排除）', await page.locator('.mark-filters button', { hasText: '排除' }).getAttribute('aria-pressed') === 'true')
  check('刷新后片序保持（入选优先）', (await page.locator('.order-select select').inputValue()) === 'selected-first')
  check('刷新后留痕版本仍在', (await page.locator('.version-row').count()) === 1)
  const idsAfterReload = await page.locator('.proof-card').evaluateAll(cs => cs.map(c => c.getAttribute('data-photo-id')))
  check('刷新后筛选生效（只剩 3 张排除）', idsAfterReload.length === 3, idsAfterReload?.join(','))

  // 重新锁定 → v2
  await page.locator('.mark-filters button', { hasText: '全部' }).click()
  await page.getByRole('button', { name: '锁定成套' }).click()
  check('重新锁定后横幅显示 v2 有效', (await page.locator('.set-banner.set-valid').textContent())?.includes('v2'))
  check('留痕共 2 个版本（旧版保留）', (await page.locator('.version-row').count()) === 2)
  const statuses = await page.locator('.version-row .version-status').allTextContents()
  check('v2 有效 + v1 已失效并存', statuses.some(s => s.includes('有效')) && statuses.some(s => s.includes('已失效')), statuses.join(','))
  await context.close()
}

// ---------------------------------------------------------------------------
section('B4. 跨系列比较只读取当前有效标记')
{
  const { context, page } = await newPage()
  // 先构造：凝视全部标记并锁定，然后改动一张使其失效
  await page.goto(`${BASE}/review`, { waitUntil: 'networkidle' })
  const cards = page.locator('.proof-card')
  const marks = ['入选', '入选', '排除', '入选', '排除']
  for (let i = 0; i < 5; i++) await cards.nth(i).getByRole('button', { name: marks[i] }).click()
  await page.getByRole('button', { name: '锁定成套' }).click()
  // 锁定后改动：portrait-01 入选 → 排除（live: 入选2 排除3；快照: 入选3 排除2）
  await cards.nth(0).getByRole('button', { name: '排除' }).click()

  await page.goto(`${BASE}/compare`, { waitUntil: 'networkidle' })
  const gazeRow = page.locator('.compare-row[data-series-id="gaze"]')
  const stat = async name => Number(await gazeRow.locator(`[data-stat="${name}"]`).textContent())
  check('比较页按当前标记统计：入选=2（非快照的 3）', (await stat('selected')) === 2, String(await stat('selected')))
  check('比较页按当前标记统计：排除=3（非快照的 2）', (await stat('excluded')) === 3)
  check('比较页：待复核=0、未标记=0', (await stat('pending')) === 0 && (await stat('unmarked')) === 0)
  check('凝视成套状态显示已失效', (await gazeRow.locator('.compare-status').textContent())?.includes('已失效'))

  const wildRow = page.locator('.compare-row[data-series-id="wilderness"]')
  check('无人之境未开始（未标记=5）', (await wildRow.locator('[data-stat="unmarked"]').textContent()) === '5')
  check('无人之境状态为未锁定', (await wildRow.locator('.compare-status').textContent())?.includes('未锁定'))
  check('页面注明只读当前有效标记', await page.locator('.compare-note').isVisible())
  await context.close()
}

// ---------------------------------------------------------------------------
section('B5. 移动端逐张复核')
{
  const { context, page } = await newPage({ width: 390, height: 844 })
  await page.goto(`${BASE}/review`, { waitUntil: 'networkidle' })
  check('窄屏首次访问默认进入逐张复核', await page.locator('.single-review').isVisible())

  const eyebrowBefore = await page.locator('.single-panel .eyebrow').textContent()
  check('逐张复核显示位置指示（1 / 5）', /1\s*\/\s*5/.test(eyebrowBefore ?? ''), eyebrowBefore)

  await page.getByRole('button', { name: '标为入选并继续' }).click()
  const eyebrowAfter = await page.locator('.single-panel .eyebrow').textContent()
  check('打标后自动前进到下一张（2 / 5）', /2\s*\/\s*5/.test(eyebrowAfter ?? ''), eyebrowAfter)

  await page.getByRole('button', { name: '下一张' }).click()
  const eyebrowThird = await page.locator('.single-panel .eyebrow').textContent()
  check('可手动翻页（3 / 5）', /3\s*\/\s*5/.test(eyebrowThird ?? ''), eyebrowThird)

  await page.getByRole('button', { name: '校样墙' }).click()
  check('可切回校样墙（移动端单列）', await page.locator('.proof-wall').isVisible())
  const first = await page.locator('.proof-card').first().boundingBox()
  const second = await page.locator('.proof-card').nth(1).boundingBox()
  check('校样墙移动端单列排列', second.y > first.y + first.height - 2)

  await page.reload({ waitUntil: 'networkidle' })
  check('刷新后复核模式保持（校样墙）', await page.locator('.proof-wall').isVisible())
  await context.close()
}

// ---------------------------------------------------------------------------
await browser.close()
console.log(`\n${failures === 0 ? '全部检查通过 ✅' : `有 ${failures} 项检查失败 ❌`}`)
process.exit(failures === 0 ? 0 : 1)
