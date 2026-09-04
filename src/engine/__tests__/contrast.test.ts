import { describe, expect, it } from 'vitest'
import { useMode, modeLrgb, modeRgb, wcagContrast } from 'culori/fn'
// The reference APCA implementation is a dev-only oracle: its licence is
// bespoke and its releases are stale, so it never ships, but validating our
// implementation against it is exactly what it is good for.
import { APCAcontrast, sRGBtoY } from 'apca-w3'

import { apcaLc, apcaLevelFor, apcaYFromHex } from '../contrast/apca.ts'
import {
  WCAG_THRESHOLDS,
  wcagContrastHex,
  wcagRatioFromY,
  yForRatioOnBlack,
  yForRatioOnWhite,
} from '../contrast/wcag.ts'
import { hexToRgb8, rgb8ToHex, yFromHex } from '../color/space.ts'

useMode(modeRgb)
useMode(modeLrgb)

function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function randomHex(rand: () => number): string {
  return rgb8ToHex({
    r: Math.floor(rand() * 256),
    g: Math.floor(rand() * 256),
    b: Math.floor(rand() * 256),
  })
}

function oracleLc(text: string, bg: string): number {
  const t = hexToRgb8(text)
  const b = hexToRgb8(bg)
  return APCAcontrast(sRGBtoY([t.r, t.g, t.b]), sRGBtoY([b.r, b.g, b.b])) as number
}

describe('WCAG 2.x contrast', () => {
  it('reproduces the canonical reference values', () => {
    expect(wcagContrastHex('#ffffff', '#000000')).toBeCloseTo(21, 6)
    expect(wcagContrastHex('#000000', '#000000')).toBeCloseTo(1, 9)
    // The classic "smallest grey that passes AA on white" example.
    expect(wcagContrastHex('#767676', '#ffffff')).toBeCloseTo(4.54, 2)
  })

  it('is symmetric', () => {
    const rand = mulberry32(11)
    for (let i = 0; i < 200; i++) {
      const a = randomHex(rand)
      const b = randomHex(rand)
      expect(wcagContrastHex(a, b)).toBeCloseTo(wcagContrastHex(b, a), 12)
    }
  })

  it('agrees with culori', () => {
    const rand = mulberry32(12)
    for (let i = 0; i < 300; i++) {
      const a = randomHex(rand)
      const b = randomHex(rand)
      expect(wcagContrastHex(a, b)).toBeCloseTo(wcagContrast(a, b), 9)
    }
  })

  it('inverts the ratio to a luminance target on white', () => {
    // These three numbers are the anchors the whole ladder is pinned to.
    expect(yForRatioOnWhite(3)).toBeCloseTo(0.3, 9)
    expect(yForRatioOnWhite(4.5)).toBeCloseTo(0.183333, 6)
    expect(yForRatioOnWhite(7)).toBeCloseTo(0.1, 9)
  })

  it('inverts the ratio to a luminance target on black', () => {
    expect(yForRatioOnBlack(3)).toBeCloseTo(0.1, 9)
    expect(yForRatioOnBlack(4.5)).toBeCloseTo(0.175, 9)
    expect(yForRatioOnBlack(21)).toBeCloseTo(1, 9)
  })

  it('round-trips every threshold back to its exact ratio', () => {
    for (const ratio of Object.values(WCAG_THRESHOLDS)) {
      expect(wcagRatioFromY(1, yForRatioOnWhite(ratio))).toBeCloseTo(ratio, 9)
      expect(wcagRatioFromY(0, yForRatioOnBlack(ratio))).toBeCloseTo(ratio, 9)
    }
  })

  it('notes that 7:1 on white is also 3:1 on black', () => {
    // A useful coincidence: one anchor serves both light and dark surfaces.
    expect(yForRatioOnWhite(7)).toBeCloseTo(yForRatioOnBlack(3), 9)
  })
})

describe('APCA', () => {
  it('matches the reference implementation across a random sweep', () => {
    const rand = mulberry32(13)
    let worst = 0
    for (let i = 0; i < 500; i++) {
      const text = randomHex(rand)
      const bg = randomHex(rand)
      worst = Math.max(worst, Math.abs(apcaLc(text, bg) - oracleLc(text, bg)))
    }
    expect(worst).toBeLessThan(0.01)
  })

  it('matches the reference at the extremes and near-equal pairs', () => {
    for (const [text, bg] of [
      ['#000000', '#ffffff'],
      ['#ffffff', '#000000'],
      ['#888888', '#ffffff'],
      ['#ffffff', '#888888'],
      ['#000000', '#aaaaaa'],
      ['#aaaaaa', '#000000'],
      ['#010101', '#000000'],
      ['#808080', '#808080'],
      ['#0b0b0b', '#000000'],
      ['#635bff', '#ffffff'],
    ] as const) {
      expect(apcaLc(text, bg), `${text} on ${bg}`).toBeCloseTo(oracleLc(text, bg), 8)
    }
  })

  it('agrees with the reference luminance formula', () => {
    const rand = mulberry32(14)
    for (let i = 0; i < 200; i++) {
      const hex = randomHex(rand)
      const c = hexToRgb8(hex)
      expect(apcaYFromHex(hex)).toBeCloseTo(sRGBtoY([c.r, c.g, c.b]) as number, 12)
    }
  })

  it('uses its own luminance, deliberately unlike WCAG', () => {
    // APCA applies a plain 2.4 power with slightly different coefficients. The
    // two must stay separate; conflating them would silently corrupt both.
    const hex = '#0a0a0a'
    expect(Math.abs(apcaYFromHex(hex) - yFromHex(hex))).toBeGreaterThan(1e-4)
  })

  it('signs the result by polarity', () => {
    expect(apcaLc('#000000', '#ffffff')).toBeGreaterThan(0)
    expect(apcaLc('#ffffff', '#000000')).toBeLessThan(0)
  })

  it('returns zero for indistinguishable pairs', () => {
    expect(apcaLc('#808080', '#808080')).toBe(0)
    expect(apcaLc('#808080', '#818181')).toBe(0)
  })

  it('classifies Lc into the conventional levels', () => {
    expect(apcaLevelFor(105)).toBe('bodyPreferred')
    expect(apcaLevelFor(-105)).toBe('bodyPreferred')
    expect(apcaLevelFor(76)).toBe('bodyMinimum')
    expect(apcaLevelFor(61)).toBe('fluentText')
    expect(apcaLevelFor(46)).toBe('largeText')
    expect(apcaLevelFor(31)).toBe('anyText')
    expect(apcaLevelFor(16)).toBe('nonText')
    expect(apcaLevelFor(5)).toBeNull()
  })

  it('rates black on white as usable body text', () => {
    expect(apcaLevelFor(apcaLc('#000000', '#ffffff'))).toBe('bodyPreferred')
  })
})
