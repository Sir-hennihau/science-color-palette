// Drives the running dev server to capture the app and report console errors.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const base = process.env.APP_URL ?? 'http://localhost:3002'
const outDir = process.env.OUT_DIR ?? '/tmp/scp-shots'
mkdirSync(outDir, { recursive: true })

const shots = [
  { name: 'light', url: '/', theme: 'light', width: 1440, height: 1000 },
  { name: 'dark', url: '/', theme: 'dark', width: 1440, height: 1000 },
  { name: 'envelope', url: '/?seeds=%5B%22ffff00.h%22%5D', theme: 'light', width: 1440, height: 1000, panel: 'Limits of each hue' },
  { name: 'exact', url: '/?seeds=%5B%22635bff.x%22%5D', theme: 'light', width: 1440, height: 1000 },
  { name: 'mobile', url: '/', theme: 'light', width: 420, height: 900 },
]

const browser = await chromium.launch()
let failures = 0

for (const shot of shots) {
  const context = await browser.newContext({
    viewport: { width: shot.width, height: shot.height },
    colorScheme: shot.theme,
  })
  const page = await context.newPage()
  const problems = []
  page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text()) })
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))

  await page.goto(base + shot.url, { waitUntil: 'networkidle' })
  if (shot.panel) {
    await page.getByRole('button', { name: shot.panel }).click()
    await page.waitForTimeout(300)
  }
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${outDir}/${shot.name}.png`, fullPage: shot.name !== 'mobile' })

  const swatches = await page.locator('main button[aria-label*="#"]').count()
  console.log(`${shot.name}: ${swatches} swatches, ${problems.length} console errors`)
  for (const p of problems.slice(0, 6)) console.log(`   ! ${p}`)
  if (problems.length) failures++
  await context.close()
}

await browser.close()
console.log(failures ? `\n${failures} view(s) had console errors` : '\nno console errors')
