// End-to-end checks against a running dev server.
// Verifies the behaviours screenshots cannot: URL round-tripping, that a drag
// yields exactly one history entry, copy, export, and accessibility.
import { chromium } from 'playwright'

const base = process.env.APP_URL ?? 'http://localhost:3002'
const results = []

function check(name, ok, detail = '') {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  permissions: ['clipboard-read', 'clipboard-write'],
})
const page = await context.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })

const swatches = () => page.locator('main button[aria-label*="#"]')

/**
 * Wait until the app is actually interactive, not merely painted.
 *
 * The app sets data-ready once its mount effects have run. Without waiting for
 * it, a drag can land on a control that exists but is not yet listening — which
 * is how a real race in the commit path first showed up here.
 */
async function ready() {
  await page.locator('[data-ready="true"]').waitFor({ timeout: 20000 })
}

async function open(url) {
  await page.goto(base + url, { waitUntil: 'networkidle' })
  await ready()
}

// --- defaults ---------------------------------------------------------------
await open('/')
check('untouched palette leaves the address clean', new URL(page.url()).search === '',
  page.url())
const firstFamily = async () => {
  const label = await swatches().first().getAttribute('aria-label')
  return label.split(' ')[0]
}
const familyShades = async () =>
  page.locator(`main button[aria-label^="${await firstFamily()} "]`).count()

check('default palette has ten families plus greys',
  await page.locator('[data-ramp]').count() === 11,
  `${await page.locator('[data-ramp]').count()} ramps`)
check('default ramp has eleven shades', (await familyShades()) === 11)
check('families are named after colours, not jobs', await (async () => {
  const names = await page.locator('[data-ramp] h3').allInnerTexts()
  return !names.some((n) => ['danger', 'warning', 'success', 'info', 'primary'].includes(n.trim()))
})(), (await page.locator('[data-ramp] h3').allInnerTexts()).join(','))

// --- deep link --------------------------------------------------------------
await open('/?steps=13&chroma=vivid')
check('a deep link rebuilds the palette', (await familyShades()) === 13)
check('the deep-linked control shows its value',
  await page.getByRole('button', { name: 'Vivid' }).getAttribute('aria-pressed') === 'true')

// --- typing a colour --------------------------------------------------------
await open('/')
const hexField = page.getByLabel('Colour 1 value')
await hexField.fill('#14b8a6')
await hexField.press('Enter')
await page.waitForTimeout(350)
check('typing a colour reaches the address', page.url().includes('14b8a6'), page.url())
check('typing a colour regenerates the ramp',
  (await swatches().first().getAttribute('aria-label'))?.includes(' 50,'),
  await swatches().first().getAttribute('aria-label'))
check('the seeded family is marked as yours',
  (await page.getByText('yours', { exact: true }).count()) >= 1)

// --- one history entry per gesture -----------------------------------------
await open('/')
const before = page.url()
const slider = page.getByLabel('Number of shades per family')
const startValue = await slider.inputValue()
const box = await slider.boundingBox()

// Press in the middle, wander, and finish at the far left so the end value is
// unambiguously different from where it started.
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
await page.mouse.down()
for (const x of [box.width * 0.7, box.width * 0.3, box.width * 0.55, 6]) {
  await page.mouse.move(box.x + x, box.y + box.height / 2)
  await page.waitForTimeout(50)
}
await page.mouse.up()
await page.waitForTimeout(400)

const endValue = await slider.inputValue()
check('a drag moves the control', endValue !== startValue, `${startValue} -> ${endValue}`)
check('a drag reaches the address', page.url().includes(`steps=${endValue}`), page.url())
check('the palette follows the drag', (await familyShades()) === Number(endValue))

await page.goBack({ waitUntil: 'networkidle' })
await ready()
check('one back press undoes the whole drag — many moves, one history entry',
  page.url() === before, `${page.url()} vs ${before}`)
check('undo restores the control', await slider.inputValue() === startValue)

// Keyboard is the other route to the same commit.
await slider.focus()
await page.keyboard.press('ArrowLeft')
await page.waitForTimeout(500)
check('the keyboard commits too', page.url().includes('steps='), page.url())

// --- the families control ---------------------------------------------------
await open('/?families=4')
check('the family count is honoured', await page.locator('[data-ramp]').count() === 5,
  `${await page.locator('[data-ramp]').count()} ramps`)
await open('/?families=16')
check('sixteen families still renders', await page.locator('[data-ramp]').count() === 17)

// Crowding geometry is unit-tested; here it is enough that advice surfaces.

// --- role hints, offered rather than imposed --------------------------------
await open('/')
check('conventional roles are suggested, not assigned',
  (await page.getByText('If you need conventional roles').count()) === 1)

// --- all inputs are above the palette ---------------------------------------
const controlsBox = await page.getByLabel('Number of colour families').boundingBox()
const boardBox = await page.locator('[data-ramp]').first().boundingBox()
check('every input sits above the palette',
  controlsBox.y + controlsBox.height <= boardBox.y,
  `controls end ${Math.round(controlsBox.y + controlsBox.height)}, board starts ${Math.round(boardBox.y)}`)

// --- exact mode -------------------------------------------------------------
await open('/?seeds=%5B%22635bff.x%22%5D')
check('exact mode keeps the colour verbatim',
  await page.locator('main button[aria-label*="kept exactly"]').count() === 1)
check('exact mode is reflected in the control',
  await page.getByRole('button', { name: 'Exact', exact: true }).getAttribute('aria-pressed') === 'true')

// --- a broken promise is surfaced ------------------------------------------
await open('/?seeds=%5B%22808080.x%22%5D')
check('a shade short of its contrast is flagged in the palette',
  await page.locator('main button[aria-label*="below the usual contrast"]').count() > 0)
check('and explained in prose',
  (await page.getByText('Worth knowing').count()) > 0)

// --- export -----------------------------------------------------------------
await open('/')
await page.getByRole('button', { name: 'Export' }).click()
await page.waitForTimeout(250)
const css = await page.locator('pre').innerText()
check('CSS export contains custom properties', /--color-[a-z-]+-600:/.test(css))
check('CSS export gates OKLCH behind @supports', css.includes('@supports (color: oklch'))
await page.getByRole('button', { name: 'Design tokens' }).click()
await page.waitForTimeout(250)
const tokens = await page.locator('pre').innerText()
let tokensParse = false
try { JSON.parse(tokens); tokensParse = true } catch {}
check('design tokens export is valid JSON', tokensParse)

// --- clipboard --------------------------------------------------------------
await page.getByRole('button', { name: 'Copy', exact: true }).click()
await page.waitForTimeout(300)
check('copy reports success', (await page.getByText(/^Copied /).count()) > 0)

// --- the envelope plot ------------------------------------------------------
await open('/?seeds=%5B%22ffff00.h%22%5D')
await page.getByRole('button', { name: 'Limits of each hue' }).click()
await page.waitForTimeout(300)
const plotLabel = await page.locator('svg[role="img"]').first().getAttribute('aria-label')
check('envelope plots are described for screen readers',
  Boolean(plotLabel?.includes('most vivid')), plotLabel ?? '')
check('yellow is reported as only vivid when light',
  (await page.getByText(/only vivid\s+when light/).count()) > 0)

// --- keyboard ---------------------------------------------------------------
await open('/')
await page.keyboard.press('Tab')
const firstFocus = await page.evaluate(() => document.activeElement?.getAttribute('aria-label')
  ?? document.activeElement?.textContent?.trim() ?? document.activeElement?.tagName)
check('tabbing reaches a control', Boolean(firstFocus), String(firstFocus))
const target = swatches().nth(5)
const targetHex = (await target.getAttribute('aria-label')).match(/#[0-9a-f]{6}/)[0]
await target.focus()
await page.keyboard.press('Enter')
await page.waitForTimeout(300)
check('a swatch copies from the keyboard',
  (await page.getByText(`Copied ${targetHex}`).count()) > 0, targetHex)

// --- accessibility ----------------------------------------------------------
for (const scheme of ['light', 'dark']) {
  await page.emulateMedia({ colorScheme: scheme })
  await open('/')
  await page.addScriptTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js' })
  const violations = await page.evaluate(async () => {
    const r = await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    })
    return r.violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => `${v.id} (${v.nodes.length})`)
  })
  check(`no serious accessibility violations in ${scheme} mode`, violations.length === 0,
    violations.join(', '))
}

check('no console or page errors throughout', errors.length === 0, errors.slice(0, 3).join(' | '))

await browser.close()

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length ? 1 : 0)
