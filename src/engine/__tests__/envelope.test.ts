import { describe, expect, it } from 'vitest'
import {
  useMode,
  modeLrgb,
  modeOklab,
  modeOklch,
  modeRgb,
  clampChroma,
  toGamut,
  formatHex,
} from 'culori/fn'

import { cMaxExact, cMaxTriangle, clearEnvelopeCache, findCusp } from '../color/envelope.ts'
import { inGamut, mapToGamut } from '../color/gamut.ts'
import { deltaEOK, oklchFromHex, oklchToRgb, quantize, rgb8ToHex } from '../color/space.ts'
import { CMAX_SEARCH_LIMIT } from '../constants.ts'

useMode(modeRgb)
useMode(modeLrgb)
useMode(modeOklab)
useMode(modeOklch)

const culoriMap = toGamut('rgb', 'oklch')

/** Ground truth for the cusp: a dense scan of the envelope. */
function bruteForceCusp(h: number): { l: number; c: number } {
  let best = { l: 0, c: -1 }
  for (let i = 0; i <= 2000; i++) {
    const l = i / 2000
    const c = cMaxExact(l, h, 'srgb')
    if (c > best.c) best = { l, c }
  }
  return best
}

describe('chroma envelope', () => {
  it('finds the true maximum, checked against a brute-force scan', () => {
    for (let h = 0; h < 360; h += 11) {
      const cusp = findCusp(h, 'srgb')
      const brute = bruteForceCusp(cusp.hue)
      expect(cusp.c, `hue ${h} cusp chroma`).toBeCloseTo(brute.c, 3)
      expect(cusp.l, `hue ${h} cusp lightness`).toBeCloseTo(brute.l, 2)
    }
  })

  it('lands on the pure primary for hues whose gamut edge runs straight', () => {
    // Red, green and yellow vertices sit on the constant-hue ray, so the cusp
    // coincides with the pure colour. Blue and magenta do not: OKLab's hue line
    // is straight where the sRGB boundary curves, so the ray leaves the gamut
    // just short of the vertex and the honest cusp is slightly less colourful.
    for (const [hex, name] of [
      ['#ffff00', 'yellow'],
      ['#ff0000', 'red'],
      ['#00ff00', 'green'],
    ] as const) {
      const pure = oklchFromHex(hex)
      const cusp = findCusp(pure.h, 'srgb')
      expect(cusp.l, `${name} cusp lightness`).toBeCloseTo(pure.l, 2)
      expect(cusp.c, `${name} cusp chroma`).toBeCloseTo(pure.c, 2)
    }

    const blue = oklchFromHex('#0000ff')
    const blueCusp = findCusp(blue.h, 'srgb')
    expect(blueCusp.c).toBeLessThan(blue.c)
    expect(blue.c - blueCusp.c).toBeLessThan(0.03)
  })

  it('confirms the asymmetry the whole design rests on', () => {
    // Yellow is only vivid when light, blue only when dark. No single lightness
    // ramp can hold chroma constant and respect both, which is exactly why
    // chroma is expressed as a fraction of this envelope rather than a number.
    const yellow = findCusp(oklchFromHex('#ffff00').h, 'srgb')
    const blue = findCusp(oklchFromHex('#0000ff').h, 'srgb')

    expect(yellow.l).toBeGreaterThan(0.9)
    expect(blue.l).toBeLessThan(0.55)

    // There is no dark vivid yellow.
    expect(cMaxExact(0.3, yellow.hue, 'srgb')).toBeLessThan(0.4 * yellow.c)

    // And no light vivid blue — even more starkly.
    expect(cMaxExact(0.9, blue.hue, 'srgb')).toBeLessThan(0.2 * blue.c)
  })

  it('returns a displayable cusp that is on the surface', () => {
    for (let h = 0; h < 360; h += 5) {
      const cusp = findCusp(h, 'srgb')
      expect(inGamut({ l: cusp.l, c: cusp.c, h: cusp.hue }, 'srgb'), `hue ${h} in gamut`).toBe(true)
      expect(
        inGamut({ l: cusp.l, c: cusp.c + 2e-3, h: cusp.hue }, 'srgb'),
        `hue ${h} just outside`,
      ).toBe(false)
    }
  })

  it('agrees with culori on the maximum chroma at a given lightness', () => {
    for (let h = 0; h < 360; h += 15) {
      for (const l of [0.2, 0.5, 0.8]) {
        const ours = cMaxExact(l, h, 'srgb')
        // clampChroma finds the largest displayable chroma for a fixed L and H.
        const theirs = clampChroma({ mode: 'oklch', l, c: CMAX_SEARCH_LIMIT, h }, 'oklch')
        expect(ours, `hue ${h} lightness ${l}`).toBeCloseTo(theirs.c ?? 0, 3)
      }
    }
  })

  it('bounds how far the triangular approximation can overstate the envelope', () => {
    // The triangle is two straight edges standing in for a curved boundary, so
    // it overstates chroma where the true surface bulges inward. It is only
    // ever used inside the solver's inner loop; this bound is the reason the
    // pipeline still finishes every swatch with an exact clamp.
    let worst = 0
    for (let h = 0; h < 360; h += 5) {
      const cusp = findCusp(h, 'srgb')
      for (let i = 1; i < 40; i++) {
        const l = i / 40
        worst = Math.max(worst, cMaxTriangle(l, cusp) - cMaxExact(l, h, 'srgb'))
      }
    }
    expect(worst).toBeLessThan(0.035)
  })

  it('never understates the envelope enough to waste usable chroma', () => {
    // Understating is harmless for correctness but would make ramps duller than
    // the display allows, so keep an eye on it too.
    let worst = 0
    for (let h = 0; h < 360; h += 5) {
      const cusp = findCusp(h, 'srgb')
      for (let i = 1; i < 40; i++) {
        const l = i / 40
        worst = Math.max(worst, cMaxExact(l, h, 'srgb') - cMaxTriangle(l, cusp))
      }
    }
    expect(worst).toBeLessThan(0.035)
  })

  it('collapses chroma at the lightness extremes', () => {
    const cusp = findCusp(250, 'srgb')
    expect(cMaxTriangle(0, cusp)).toBe(0)
    expect(cMaxTriangle(1, cusp)).toBe(0)
    expect(cMaxExact(0, 250, 'srgb')).toBe(0)
    expect(cMaxExact(1, 250, 'srgb')).toBe(0)
  })
})

describe('cusp cache', () => {
  it('is transparent: quantised hues resolve identically either way', () => {
    clearEnvelopeCache()
    const cold = findCusp(359.997, 'srgb')
    const warm = findCusp(359.997, 'srgb')
    expect(warm).toEqual(cold)

    // Hues inside one quantum share a bucket, and the cusp is computed at the
    // bucket's hue, so the result cannot depend on which one arrived first.
    expect(findCusp(200.001, 'srgb')).toEqual(findCusp(200.004, 'srgb'))
  })

  it('folds a hue that rounds up to 360 back to 0', () => {
    expect(findCusp(359.999, 'srgb').hue).toBe(0)
  })
})

describe('gamut mapping', () => {
  it('leaves displayable colours untouched', () => {
    const inside = oklchFromHex('#635bff')
    expect(mapToGamut(inside, 'srgb')).toEqual(inside)
  })

  it('brings out-of-gamut colours in by shedding chroma', () => {
    // CSS Color 4 reduces chroma at fixed lightness and hue, but accepts a
    // channel-clipped candidate once it is within one JND — and that fallback
    // does shift lightness slightly. So the guarantee is "in gamut, less
    // colourful, perceptually close", not "identical lightness".
    const wild = { l: 0.85, c: 0.35, h: 145 }
    const mapped = mapToGamut(wild, 'srgb')

    expect(inGamut(mapped, 'srgb')).toBe(true)
    expect(mapped.c).toBeLessThan(wild.c)
    expect(deltaEOK(wild, mapped)).toBeLessThan(0.1)
    expect(Math.abs(mapped.l - wild.l)).toBeLessThan(0.02)
  })

  it('agrees with culori CSS Color 4 mapping', () => {
    for (const probe of [
      { l: 0.85, c: 0.35, h: 145 },
      { l: 0.5, c: 0.4, h: 20 },
      { l: 0.3, c: 0.3, h: 250 },
      { l: 0.7, c: 0.25, h: 100 },
      { l: 0.95, c: 0.2, h: 300 },
    ]) {
      const ours = rgb8ToHex(quantize(oklchToRgb(mapToGamut(probe, 'srgb'))))
      const theirs = formatHex(culoriMap({ mode: 'oklch', ...probe }))
      expect(ours, `oklch(${probe.l} ${probe.c} ${probe.h})`).toBe(theirs)
    }
  })

  it('resolves the lightness extremes to white and black', () => {
    expect(mapToGamut({ l: 1.2, c: 0.3, h: 100 }, 'srgb')).toMatchObject({ l: 1, c: 0 })
    expect(mapToGamut({ l: -0.2, c: 0.3, h: 100 }, 'srgb')).toMatchObject({ l: 0, c: 0 })
  })
})

describe('gamut genericity', () => {
  it('finds a wider envelope for Display-P3 than for sRGB', () => {
    // The envelope math is parameterised by gamut rather than hard-wired to
    // sRGB, which is what keeps a wide-gamut mode a configuration change.
    let wider = 0
    for (let h = 0; h < 360; h += 15) {
      const srgb = findCusp(h, 'srgb')
      const p3 = findCusp(h, 'display-p3')
      expect(p3.c).toBeGreaterThan(srgb.c - 1e-6)
      if (p3.c > srgb.c + 1e-3) wider++
    }
    expect(wider).toBeGreaterThan(20)
  })

  it('keeps every sRGB colour inside Display-P3', () => {
    for (let h = 0; h < 360; h += 30) {
      for (const l of [0.3, 0.6, 0.9]) {
        const c = cMaxExact(l, h, 'srgb')
        expect(inGamut({ l, c, h }, 'display-p3')).toBe(true)
      }
    }
  })
})
