import { describe, expect, it } from 'vitest'
import {
  useMode,
  modeLrgb,
  modeOklch,
  modeRgb,
  converter,
  formatHex,
  wcagLuminance,
  differenceEuclidean,
} from 'culori/fn'

import {
  achromaticL,
  deltaEOK,
  hueDelta,
  hueDistance,
  hueMidpoint,
  isAchromatic,
  lstarFromY,
  normalizeHue,
  oklchFromHex,
  oklchToRgb,
  parseColor,
  quantize,
  rgb8ToHex,
  yFromHex,
  yFromLstar,
  yFromOklch,
} from '../color/space.ts'

useMode(modeRgb)
useMode(modeLrgb)
const toOklch = useMode(modeOklch)
const toRgb = converter('rgb')
const dEOK = differenceEuclidean('oklab')

/** Deterministic PRNG so oracle sweeps are reproducible. */
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

describe('OKLCH conversion', () => {
  it('agrees with culori across a random sweep', () => {
    const rand = mulberry32(1)
    let maxL = 0
    let maxC = 0
    let maxH = 0

    for (let i = 0; i < 500; i++) {
      const hex = randomHex(rand)
      const ours = oklchFromHex(hex)
      const theirs = toOklch(hex)!

      maxL = Math.max(maxL, Math.abs(ours.l - theirs.l))
      maxC = Math.max(maxC, Math.abs(ours.c - (theirs.c ?? 0)))
      if ((theirs.c ?? 0) > 0.01 && theirs.h !== undefined) {
        maxH = Math.max(maxH, hueDistance(ours.h, theirs.h))
      }
    }

    expect(maxL).toBeLessThan(1e-6)
    expect(maxC).toBeLessThan(1e-6)
    expect(maxH).toBeLessThan(1e-3)
  })

  it('round-trips hex through OKLCH without drift', () => {
    const rand = mulberry32(2)
    for (let i = 0; i < 500; i++) {
      const hex = randomHex(rand)
      expect(rgb8ToHex(quantize(oklchToRgb(oklchFromHex(hex))))).toBe(hex)
    }
  })

  it('treats greys as achromatic', () => {
    // The OKLab matrix rows sum to one only to within float precision, so a
    // grey lands a hair off the achromatic axis rather than exactly on it. This
    // residue is why hue is gated behind a chroma threshold instead of `c === 0`.
    for (const hex of ['#000000', '#ffffff', '#808080', '#3c3c3c']) {
      const lch = oklchFromHex(hex)
      expect(lch.c).toBeLessThan(1e-6)
      expect(isAchromatic(lch)).toBe(true)
    }
  })

  it('places lightness of white at 1 and black at 0', () => {
    expect(oklchFromHex('#ffffff').l).toBeCloseTo(1, 6)
    expect(oklchFromHex('#000000').l).toBeCloseTo(0, 9)
  })
})

describe('relative luminance', () => {
  it('agrees with culori', () => {
    const rand = mulberry32(3)
    for (let i = 0; i < 300; i++) {
      const hex = randomHex(rand)
      expect(yFromHex(hex)).toBeCloseTo(wcagLuminance(hex), 9)
    }
  })

  it('anchors white and black', () => {
    expect(yFromHex('#ffffff')).toBeCloseTo(1, 12)
    expect(yFromHex('#000000')).toBeCloseTo(0, 12)
  })

  it('matches the achromatic OKLCH lightness identity L = cbrt(Y)', () => {
    // Every row of the OKLab matrices sums to one, so a grey's lightness is the
    // cube root of its luminance. The solver's fast path depends on this.
    for (const hex of ['#111111', '#555555', '#808080', '#cccccc']) {
      const y = yFromHex(hex)
      expect(oklchFromHex(hex).l).toBeCloseTo(achromaticL(y), 6)
      expect(yFromOklch({ l: achromaticL(y), c: 0, h: 0 })).toBeCloseTo(y, 9)
    }
  })
})

describe('CIELAB lightness bijection', () => {
  it('round-trips Y -> L* -> Y', () => {
    for (const y of [0, 1e-5, 0.005, 0.008856, 0.01, 0.1, 0.18333, 0.3, 0.5, 0.9442, 1]) {
      expect(yFromLstar(lstarFromY(y))).toBeCloseTo(y, 10)
    }
  })

  it('reproduces the published contrast anchor lightnesses', () => {
    // These are why "tone/grade 50" means 4.5:1 on white in USWDS and HCT.
    expect(lstarFromY(0.3)).toBeCloseTo(61.65, 1)
    expect(lstarFromY(0.18333)).toBeCloseTo(49.9, 1)
    expect(lstarFromY(0.1)).toBeCloseTo(37.84, 1)
  })

  it('is monotone increasing', () => {
    let prev = -1
    for (let i = 0; i <= 1000; i++) {
      const l = lstarFromY(i / 1000)
      expect(l).toBeGreaterThan(prev)
      prev = l
    }
  })
})

describe('deltaEOK', () => {
  it('agrees with culori euclidean OKLab distance', () => {
    const rand = mulberry32(4)
    for (let i = 0; i < 200; i++) {
      const a = randomHex(rand)
      const b = randomHex(rand)
      expect(deltaEOK(oklchFromHex(a), oklchFromHex(b))).toBeCloseTo(dEOK(a, b), 6)
    }
  })

  it('is zero for identical colours', () => {
    expect(deltaEOK(oklchFromHex('#635bff'), oklchFromHex('#635bff'))).toBe(0)
  })
})

describe('hue arithmetic', () => {
  it('normalises into [0, 360)', () => {
    expect(normalizeHue(0)).toBe(0)
    expect(normalizeHue(360)).toBe(0)
    expect(normalizeHue(-10)).toBe(350)
    expect(normalizeHue(730)).toBe(10)
  })

  it('takes the short way around zero', () => {
    expect(hueDelta(350, 20)).toBe(30)
    expect(hueDelta(20, 350)).toBe(-30)
    expect(hueDistance(350, 20)).toBe(30)
    expect(hueMidpoint(350, 20)).toBe(5)
  })

  it('bounds the signed delta to (-180, 180]', () => {
    for (let a = 0; a < 360; a += 7) {
      for (let b = 0; b < 360; b += 11) {
        const d = hueDelta(a, b)
        expect(d).toBeGreaterThan(-180.0001)
        expect(d).toBeLessThanOrEqual(180)
        expect(normalizeHue(a + d)).toBeCloseTo(normalizeHue(b), 9)
      }
    }
  })
})

describe('parseColor', () => {
  it('accepts the formats a user might paste', () => {
    expect(parseColor('#635BFF')?.hex).toBe('#635bff')
    expect(parseColor('  #635bff ')?.hex).toBe('#635bff')
    expect(parseColor('rebeccapurple')?.hex).toBe('#663399')
    expect(parseColor('rgb(99 91 255)')?.hex).toBe('#635bff')
    expect(parseColor('#f00')?.hex).toBe('#ff0000')
  })

  it('rejects nonsense', () => {
    expect(parseColor('not-a-color')).toBeNull()
    expect(parseColor('')).toBeNull()
    expect(parseColor('#12345')).toBeNull()
  })

  it('flags inputs that had to be clipped into sRGB', () => {
    const wide = parseColor('oklch(0.85 0.35 145)')
    expect(wide).not.toBeNull()
    expect(wide!.clipped).toBe(true)

    const inside = parseColor('#635bff')
    expect(inside!.clipped).toBe(false)
  })

  it('agrees with culori on parsed results', () => {
    for (const input of ['#635bff', 'rebeccapurple', 'hsl(240 100% 50%)', 'lab(50% 40 30)']) {
      expect(parseColor(input)!.hex).toBe(formatHex(toRgb(input)!))
    }
  })
})
