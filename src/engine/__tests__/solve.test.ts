import { describe, expect, it } from 'vitest'

import { cMaxAt, cMaxExact, getEnvelope } from '../color/envelope.ts'
import { inGamut } from '../color/gamut.ts'
import {
  achromaticL,
  oklchToRgb,
  quantize,
  rgb8ToHex,
  yFromHex,
  yFromOklch,
} from '../color/space.ts'
import { wcagContrastHex } from '../contrast/wcag.ts'
import { chromaCurve, resolveChromaPoints } from '../curves/chroma.ts'
import { buildLadder } from '../ladder.ts'
import { chromaFractionOf, solveStep } from '../solve.ts'
import type { ChromaPreset } from '../types.ts'

const HUES = Array.from({ length: 36 }, (_, i) => i * 10)
const PRESETS: ChromaPreset[] = ['vivid', 'natural', 'muted']

function hexFor(l: number, c: number, h: number): string {
  return rgb8ToHex(quantize(oklchToRgb({ l, c, h })))
}

/**
 * How much relative luminance one 8-bit channel step is worth at `y`.
 *
 * Differentiating the sRGB transfer curve: `dY/dv = (2.4 / 1.055) * Y^(1.4/2.4)`
 * per unit, so one 255th of that per code value. Rounding noise scales sharply
 * with brightness, which is why comparisons against shipped hex need a
 * luminance-dependent tolerance.
 */
function luminanceQuantum(y: number): number {
  return ((2.4 / 1.055) * Math.pow(Math.max(y, 1e-6), 1.4 / 2.4)) / 255
}

describe('solving a step', () => {
  it('hits the luminance target exactly, for every hue and preset', () => {
    const ladder = buildLadder()
    let worst = 0

    for (const preset of PRESETS) {
      const curve = chromaCurve(resolveChromaPoints({ preset }))
      for (const hue of HUES) {
        for (let i = 0; i < ladder.steps; i++) {
          const solved = solveStep({
            yTarget: ladder.yTargets[i],
            hue,
            fraction: curve.at(ladder.t[i]),
            gamut: 'srgb',
          })
          worst = Math.max(worst, Math.abs(yFromOklch(solved) - ladder.yTargets[i]))
        }
      }
    }

    expect(worst).toBeLessThan(1e-9)
  })

  it('produces only displayable colours', () => {
    const ladder = buildLadder()

    for (const preset of PRESETS) {
      const curve = chromaCurve(resolveChromaPoints({ preset }))
      for (const hue of HUES) {
        for (let i = 0; i < ladder.steps; i++) {
          const solved = solveStep({
            yTarget: ladder.yTargets[i],
            hue,
            fraction: curve.at(ladder.t[i]),
            gamut: 'srgb',
          })
          expect(
            inGamut(solved, 'srgb'),
            `${preset} hue ${hue} step ${i} -> oklch(${solved.l} ${solved.c} ${solved.h})`,
          ).toBe(true)
        }
      }
    }
  })

  it('keeps the contrast promise on the shipped hex, for every hue', () => {
    // The point of the whole design: shade 600 of *any* hue reads on white.
    // Measured on the quantised output, not on the float solve.
    const ladder = buildLadder()

    for (const preset of PRESETS) {
      const curve = chromaCurve(resolveChromaPoints({ preset }))
      for (const hue of HUES) {
        for (const contract of ladder.contracts) {
          const solved = solveStep({
            yTarget: ladder.yTargets[contract.index],
            hue,
            fraction: curve.at(ladder.t[contract.index]),
            gamut: 'srgb',
          })
          const hex = hexFor(solved.l, solved.c, solved.h)
          const ratio = wcagContrastHex(hex, '#ffffff')

          expect(
            ratio,
            `${preset} hue ${hue} shade ${ladder.labels[contract.index]} (${hex}) ` +
              `should reach ${contract.target}:1 on white`,
          ).toBeGreaterThanOrEqual(contract.target)
        }
      }
    }
  })

  it('gives every hue the same luminance at the same step', () => {
    // Equal luminance per step is what makes one shared contrast table valid
    // across the whole palette. The float solve is exact; the only thing that
    // can separate two hues is rounding to 8 bits, so that is the bound used
    // here rather than a flat number. Near white a single channel step moves
    // luminance by nearly 0.01, which is why a flat tolerance would be wrong.
    const ladder = buildLadder()
    const curve = chromaCurve(resolveChromaPoints({ preset: 'natural' }))

    for (let i = 0; i < ladder.steps; i++) {
      const solved = HUES.map((hue) =>
        solveStep({
          yTarget: ladder.yTargets[i],
          hue,
          fraction: curve.at(ladder.t[i]),
          gamut: 'srgb',
        }),
      )

      const floatSpread =
        Math.max(...solved.map(yFromOklch)) - Math.min(...solved.map(yFromOklch))
      expect(floatSpread, `step ${i} float luminance spread`).toBeLessThan(1e-9)

      const shipped = solved.map((s) => yFromHex(hexFor(s.l, s.c, s.h)))
      const spread = Math.max(...shipped) - Math.min(...shipped)
      expect(spread, `step ${i} shipped luminance spread across hues`).toBeLessThan(
        2 * luminanceQuantum(ladder.yTargets[i]),
      )
    }
  })

  it('uses the requested share of the available chroma', () => {
    const ladder = buildLadder()

    for (const fraction of [0.25, 0.5, 0.8]) {
      for (const hue of [30, 110, 200, 264, 320]) {
        for (const i of [2, 5, 8]) {
          const solved = solveStep({
            yTarget: ladder.yTargets[i],
            hue,
            fraction,
            gamut: 'srgb',
          })
          const available = cMaxAt(solved.l, getEnvelope(hue, 'srgb'))
          expect(solved.c / available, `hue ${hue} step ${i}`).toBeCloseTo(fraction, 6)
        }
      }
    }
  })

  it('respects an absolute chroma ceiling', () => {
    const ladder = buildLadder()
    for (let i = 0; i < ladder.steps; i++) {
      const solved = solveStep({
        yTarget: ladder.yTargets[i],
        hue: 250,
        fraction: 0.8,
        ceiling: 0.012,
        gamut: 'srgb',
      })
      expect(solved.c).toBeLessThanOrEqual(0.012 + 1e-9)
      expect(yFromOklch(solved)).toBeCloseTo(ladder.yTargets[i], 9)
    }
  })
})

describe('the shape the envelope forces on a ramp', () => {
  it('peaks a yellow ramp light and a blue ramp dark', () => {
    // Same curve, same fractions, opposite outcomes — the envelope does this,
    // not any hue-specific special case in the code.
    const ladder = buildLadder()
    const curve = chromaCurve(resolveChromaPoints({ preset: 'vivid' }))

    const chromaAlong = (hue: number) =>
      ladder.t.map((t, i) => {
        const solved = solveStep({
          yTarget: ladder.yTargets[i],
          hue,
          fraction: curve.at(t),
          gamut: 'srgb',
        })
        return solved.c
      })

    const yellow = chromaAlong(110)
    const blue = chromaAlong(264)

    const argmax = (xs: number[]) => xs.indexOf(Math.max(...xs))

    // Yellow's most colourful shade sits above the middle of the ramp (lighter),
    // blue's at or below it (darker).
    expect(argmax(yellow)).toBeLessThan(argmax(blue))

    // And a dark yellow simply cannot be colourful.
    expect(yellow[yellow.length - 2]).toBeLessThan(blue[blue.length - 2])
  })

  it('cannot be talked into a dark vivid yellow', () => {
    const ladder = buildLadder()
    // Ask for everything the hue has at the darkest useful step.
    const solved = solveStep({
      yTarget: ladder.yTargets[9],
      hue: 110,
      fraction: 1,
      gamut: 'srgb',
    })
    expect(solved.c).toBeLessThan(0.09)
    expect(inGamut(solved, 'srgb')).toBe(true)
  })
})

describe('neutral steps', () => {
  it('short-circuits to the exact achromatic lightness', () => {
    const ladder = buildLadder()
    for (let i = 0; i < ladder.steps; i++) {
      for (const request of [
        { hue: null as number | null, fraction: 0.8 },
        { hue: 250 as number | null, fraction: 0 },
        { hue: 250 as number | null, fraction: 0.8, ceiling: 0 },
      ]) {
        const solved = solveStep({
          yTarget: ladder.yTargets[i],
          gamut: 'srgb',
          ...request,
        })
        expect(solved.c).toBe(0)
        expect(solved.l).toBeCloseTo(achromaticL(ladder.yTargets[i]), 12)
        expect(yFromOklch(solved)).toBeCloseTo(ladder.yTargets[i], 12)
      }
    }
  })

  it('resolves the luminance extremes without searching', () => {
    expect(solveStep({ yTarget: 0, hue: 200, fraction: 1, gamut: 'srgb' })).toMatchObject({
      l: 0,
      c: 0,
    })
    expect(solveStep({ yTarget: 1, hue: 200, fraction: 1, gamut: 'srgb' })).toMatchObject({
      l: 1,
      c: 0,
    })
  })
})

describe('reading a colour back as a chroma fraction', () => {
  it('round-trips through the solver', () => {
    const ladder = buildLadder()
    for (const hue of [30, 110, 200, 264, 320]) {
      for (const fraction of [0.2, 0.55, 0.9]) {
        const solved = solveStep({
          yTarget: ladder.yTargets[6],
          hue,
          fraction,
          gamut: 'srgb',
        })
        expect(chromaFractionOf(solved, 'srgb'), `hue ${hue}`).toBeCloseTo(fraction, 5)
      }
    }
  })

  it('reports zero for a grey', () => {
    expect(chromaFractionOf({ l: 0.5, c: 0, h: 0 }, 'srgb')).toBe(0)
  })

  it('can exceed one for a colour right on the gamut surface', () => {
    // The sampled envelope errs low, so a surface colour reads slightly over
    // 100%. Left unclamped on purpose: an exact seed's chroma must survive.
    const hue = 264
    const l = 0.5
    const surface = cMaxExact(l, hue, 'srgb')
    expect(chromaFractionOf({ l, c: surface, h: hue }, 'srgb')).toBeGreaterThan(0.99)
  })
})
