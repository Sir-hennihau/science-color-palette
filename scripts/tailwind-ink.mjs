/**
 * Measures Tailwind Ink's output, for the comparison on the About page.
 *
 * Tailwind Ink (https://tailwind.ink, MIT, by David Marman) ships its two
 * trained networks as plain inference functions, so they can be run directly
 * here — no browser, no framework. We download them on first run and cache
 * them; nothing is vendored into this repo.
 *
 * The tool's own procedure, from its README: the picked colour goes to
 * nextModel to get the palette's ten hue families, and each of those goes to
 * shadesModel to get a 50-900 ramp. We repeat that over a sweep of seeds and
 * measure the result the same way the engine measures its own.
 *
 *   node scripts/tailwind-ink.mjs
 */
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'

const RAW = 'https://raw.githubusercontent.com/dmarman/dmarman.github.io/master/src'
const CACHE = process.env.TAILWIND_INK_CACHE ?? '/tmp/tailwind-ink-models'
const FILES = ['models/shadesModel.js', 'models/nextModel.js']

mkdirSync(CACHE, { recursive: true })
for (const file of FILES) {
  const local = join(CACHE, file.split('/').pop())
  if (existsSync(local)) continue
  const res = await fetch(`${RAW}/${file}`)
  if (!res.ok) throw new Error(`could not fetch ${file}: ${res.status}`)
  writeFileSync(local, await res.text())
  console.log(`fetched ${file}`)
}

const require = createRequire(import.meta.url)
const shadesModel = require(join(CACHE, 'shadesModel.js'))
const nextModel = require(join(CACHE, 'nextModel.js'))

// -- colour maths ------------------------------------------------------------
// Deliberately restated rather than imported: the engine speaks TypeScript with
// .ts extensions, and a comparison is worth more when it does not share code
// with the thing being compared. The sanity check below pins it to the engine.

const toByte = (v) => Math.max(0, Math.min(255, Math.round(v * 255)))
const toHex = (r, g, b) =>
  '#' + [r, g, b].map((c) => toByte(c).toString(16).padStart(2, '0')).join('')
const toUnit = (hex) => {
  const n = parseInt(hex.slice(1), 16)
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 }
}

const decode = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const luminance = (hex) => {
  const { r, g, b } = toUnit(hex)
  return 0.2126 * decode(r) + 0.7152 * decode(g) + 0.0722 * decode(b)
}
const lstar = (y) => (y <= 216 / 24389 ? (y * 24389) / 27 : 116 * Math.cbrt(y) - 16)
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

// The About page already quotes 20.3 for this gap, measured by the engine. If
// this script reproduces it, its arithmetic agrees with the engine's.
const sanity = lstar(luminance('#eab308')) - lstar(luminance('#3b82f6'))
if (Math.abs(sanity - 20.3) > 0.05) throw new Error(`maths disagrees with the engine: ${sanity}`)

// -- running the models ------------------------------------------------------
const SHADE_KEYS = ['0.5', '1', '2', '3', '4', '5', '6', '7', '8', '9']
const INDEX = { 500: 5, 600: 6, 700: 7 }
const TARGET = { 500: 3, 600: 4.5, 700: 7 }

let outOfRange = 0
let channels = 0

/** One family's 50-900 ramp, as Tailwind Ink would render it. */
function ramp(hex) {
  const out = shadesModel(toUnit(hex))
  return SHADE_KEYS.map((k) => {
    for (const ch of ['r', 'g', 'b']) {
      channels++
      const v = out[ch + k]
      if (v < 0 || v > 1) outOfRange++
    }
    return toHex(out['r' + k], out['g' + k], out['b' + k])
  })
}

/** The ten hue families the tool derives from one picked colour. */
function families(hex) {
  const out = nextModel(toUnit(hex))
  return Array.from({ length: 10 }, (_, i) => toHex(out['r' + i], out['g' + i], out['b' + i]))
}

// -- the sweep ---------------------------------------------------------------
const hslHex = (h, s, l) => {
  const a = s * Math.min(l, 1 - l)
  const f = (n) => {
    const k = (n + h / 30) % 12
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
  }
  return toHex(f(0), f(8), f(4))
}

const seeds = []
for (let h = 0; h < 360; h += 6) {
  for (const [s, l] of [[0.85, 0.55], [0.55, 0.45], [0.95, 0.65]]) seeds.push(hslHex(h, s, l))
}

const worst = { 500: { ratio: Infinity }, 600: { ratio: Infinity }, 700: { ratio: Infinity } }
const missed = { 500: 0, 600: 0, 700: 0 }
const missedOnWhite = { 500: 0, 600: 0, 700: 0 }
let ramps = 0
let inversions = 0
let widestSpread = { lstar: 0 }
let seedDistanceSum = 0
let seedExactMatches = 0

const channelsOf = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))

for (const seed of seeds) {
  const palette = families(seed).map(ramp)

  for (const shade of [500, 600, 700]) {
    for (const family of palette) {
      ramps++
      const colour = family[INDEX[shade]]
      const onFifty = contrast(colour, family[0])
      if (onFifty < worst[shade].ratio) {
        worst[shade] = { ratio: onFifty, colour, on: family[0], seed }
      }
      if (onFifty < TARGET[shade]) missed[shade]++
      if (contrast(colour, '#ffffff') < TARGET[shade]) missedOnWhite[shade]++
    }
  }

  const lightnesses = palette.map((family) => lstar(luminance(family[INDEX[500]])))
  const spread = Math.max(...lightnesses) - Math.min(...lightnesses)
  if (spread > widestSpread.lstar) widestSpread = { lstar: spread, seed }

  for (const family of palette) {
    const ys = family.map(luminance)
    for (let i = 1; i < ys.length; i++) if (ys[i] >= ys[i - 1]) inversions++
  }

  const target = channelsOf(seed)
  let nearest = Infinity
  for (const family of palette) {
    for (const colour of family) {
      const c = channelsOf(colour)
      const d = Math.hypot(c[0] - target[0], c[1] - target[1], c[2] - target[2])
      if (d < nearest) nearest = d
    }
  }
  if (nearest === 0) seedExactMatches++
  seedDistanceSum += nearest
}

const perShade = ramps / 3

// -- report ------------------------------------------------------------------
const r2 = (n) => n.toFixed(2)
console.log()
console.log(`${seeds.length} seeds around the hue circle, ${perShade} ramps, ${perShade * 10} swatches`)
console.log()
for (const shade of [500, 600, 700]) {
  const w = worst[shade]
  console.log(
    `shade ${shade}, needs ${TARGET[shade]}:1 — worst ${r2(w.ratio)}:1 ` +
      `(${w.colour} on ${w.on}, seed ${w.seed})`,
  )
  console.log(
    `            ${missed[shade]} of ${perShade} ramps miss it on their own 50, ` +
      `${missedOnWhite[shade]} miss it even on white`,
  )
}
console.log()
console.log(`widest L* spread at shade 500 within one palette: ${widestSpread.lstar.toFixed(1)} (seed ${widestSpread.seed})`)
console.log(`ramps that fail to darken monotonically: ${inversions}`)
console.log(`channel values the models put outside 0-1: ${outOfRange} of ${channels}`)
console.log(`palettes containing the seed exactly: ${seedExactMatches} of ${seeds.length}`)
console.log(`mean RGB distance from the seed to the nearest colour in its own palette: ${(seedDistanceSum / seeds.length).toFixed(1)}`)
console.log()
