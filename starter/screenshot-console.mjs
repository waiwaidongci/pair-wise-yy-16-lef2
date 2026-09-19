// 截图脚本：记录选片台与比较页的关键状态
import { chromium } from 'playwright'

const BASE = 'http://127.0.0.1:5173'
const OUT = process.env.OUT_DIR ?? '/tmp/shots'
import { mkdirSync } from 'node:fs'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()

// 桌面：校样墙 + 部分标记
let ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
let page = await ctx.newPage()
await page.goto(`${BASE}/review`, { waitUntil: 'networkidle' })
const cards = page.locator('.proof-card')
await cards.nth(0).getByRole('button', { name: '入选' }).click()
await cards.nth(1).getByRole('button', { name: '待复核' }).click()
await cards.nth(2).getByRole('button', { name: '排除' }).click()
await cards.nth(3).getByRole('button', { name: '入选' }).click()
await page.screenshot({ path: `${OUT}/review-wall-partial.png`, fullPage: true })

// 完成标记并锁定
await cards.nth(1).getByRole('button', { name: '排除' }).click()
await cards.nth(4).getByRole('button', { name: '入选' }).click()
await page.getByRole('button', { name: '锁定成套' }).click()
await page.screenshot({ path: `${OUT}/review-locked.png`, fullPage: true })

// 改动一张 → 失效 + 留痕展开
await cards.nth(0).getByRole('button', { name: '排除' }).click()
await page.locator('.version-row summary').first().click()
await page.screenshot({ path: `${OUT}/review-invalidated.png`, fullPage: true })

// 比较页
await page.goto(`${BASE}/compare`, { waitUntil: 'networkidle' })
await page.screenshot({ path: `${OUT}/compare.png`, fullPage: true })
await ctx.close()

// 移动端：逐张复核
ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
page = await ctx.newPage()
await page.goto(`${BASE}/review`, { waitUntil: 'networkidle' })
await page.screenshot({ path: `${OUT}/review-mobile-single.png`, fullPage: true })
await page.getByRole('button', { name: '校样墙' }).click()
await page.screenshot({ path: `${OUT}/review-mobile-wall.png`, fullPage: true })
await ctx.close()

await browser.close()
console.log('screenshots saved to', OUT)
