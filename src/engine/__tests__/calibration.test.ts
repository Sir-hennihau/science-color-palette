import { describe, expect, it } from 'vitest'

import { cMaxAt, getEnvelope } from '../color/envelope.ts'
import { lstarFromY, oklchFromHex, yFromHex } from '../color/space.ts'
import { wcagContrastHex } from '../contrast/wcag.ts'
import { generatePalette } from '../palette.ts'

/**
 * Tailwind v3 default ramps: among the most carefully hand-tuned palettes in
 * wide use, and the reference the chroma curves were calibrated against.
 *
 * They are a guide for *colourfulness*, deliberately not for lightness — see
 * the last test in this file for why.
 */
const REFERENCE: Record<string, string[]> = {
  blue: ['#eff6ff', '#dbeafe', '#bfdbfe', '#93c5fd', '#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8', '#1e40af', '#1e3a8a'],
  red: ['#fef2f2', '#fee2e2', '#fecaca', '#fca5a5', '#f87171', '#ef4444', '#dc2626', '#b91c1c', '#991b1b', '#7f1d1d'],
  yellow: ['#fefce8', '#fef9c3', '#fef08a', '#fde047', '#facc15', '#eab308', '#ca8a04', '#a16207', '#854d0e', '#713f12'],
  emerald: ['#ecfdf5', '#d1fae5', '#a7f3d0', '#6ee7b7', '#34d399', '#10b981', '#059669', '#047857', '#065f46', '#064e3b'],
  violet: ['#f5f3ff', '#ede9fe', '#ddd6fe', '#c4b5fd', '#a78bfa', '#8b5cf6', '#7c3aed', '#6d28d9', '#5b21b6', '#4c1d95'],
}

function chromaFraction(hex: string): number {
  const lch = oklchFromHex(hex)
  const available = cMaxAt(lch.l, getEnvelope(lch.h, 'srgb'))
  return available > 1e-9 ? lch.c / available : 0
}

function primaryOf(color: string, steps = 10) {
  return generatePalette({ seeds: [{ color }], ladder: { steps } }).ramps[0]
}

describe('how colourful hand-tuned ramps actually are', () => {
  it('confirms they ride most of the available chroma through the middle', () => {
    // The finding the presets are calibrated on, and it is counter-intuitive:
    // professional ramps are far bolder than a naive "ease the saturation"
    // curve would produce, sitting near the gamut surface for most of their run.
    for (const [name, hexes] of Object.entries(REFERENCE)) {
      for (let i = 3; i <= 7; i++) {
        expect(chromaFraction(hexes[i]), `${name} step ${i}`).toBeGreaterThan(0.7)
      }
    }
  })

  it('confirms their lightest shades are held to a small absolute chroma', () => {
    // And this is why the light end needs an absolute ceiling rather than a
    // share of the envelope: every hue lands in the same narrow band, which a
    // single fraction could never produce.
    for (const [name, hexes] of Object.entries(REFERENCE)) {
      expect(oklchFromHex(hexes[0]).c, `${name} lightest`).toBeLessThan(0.03)
      expect(oklchFromHex(hexes[1]).c, `${name} second`).toBeLessThan(0.08)
    }
  })

  it('confirms a share of the envelope could not do that job', () => {
    // At the lightest step the hues disagree wildly about how much chroma is
    // available, so matching the reference would need a different fraction per
    // hue — 0.77 for yellow against 1.0 for blue.
    const fractions = Object.values(REFERENCE).map((hexes) => chromaFraction(hexes[0]))
    expect(Math.max(...fractions) - Math.min(...fractions)).toBeGreaterThan(0.25)
  })
})

describe('our calibration against that reference', () => {
  it('keeps the lightest shades in the reference band, for every hue', () => {
    for (const color of ['#3b82f6', '#ef4444', '#eab308', '#10b981', '#8b5cf6', '#ffff00']) {
      const ramp = primaryOf(color)
      expect(ramp.swatches[0].oklch.c, `${color} lightest`).toBeLessThan(0.035)
      expect(ramp.swatches[1].oklch.c, `${color} second`).toBeLessThan(0.085)
    }
  })

  it('is as bold as the reference through the middle', () => {
    for (const color of ['#3b82f6', '#ef4444', '#eab308', '#10b981', '#8b5cf6']) {
      const ramp = primaryOf(color)
      for (let i = 3; i <= 7; i++) {
        expect(chromaFraction(ramp.swatches[i].hex), `${color} step ${i}`).toBeGreaterThan(0.7)
      }
    }
  })

  it('gets duller and bolder on request', () => {
    const mid = (preset: 'vivid' | 'natural' | 'muted') =>
      generatePalette({
        seeds: [{ color: '#3b82f6' }],
        chroma: { preset },
      }).ramps[0].swatches[5].oklch.c

    expect(mid('muted')).toBeLessThan(mid('natural'))
    expect(mid('natural')).toBeLessThan(mid('vivid'))
  })

  it('drifts hue across the ramp when asked, the way curated palettes do', () => {
    // Tailwind's yellow rotates about 44 degrees from lightest to darkest,
    // which is what makes its dark shades read as brown rather than olive.
    const drifted = generatePalette({
      seeds: [{ color: '#eab308' }],
      hueDrift: -44,
      ladder: { steps: 10 },
    }).ramps[0]

    const first = drifted.swatches[0].oklch.h
    const last = drifted.swatches[9].oklch.h

    expect(first - last).toBeGreaterThan(30)
    // Lightest shades lean green, darkest lean orange — the reference's pattern.
    expect(last).toBeLessThan(75)
    expect(first).toBeGreaterThan(100)
  })
})

describe('where we deliberately part company with the reference', () => {
  it('does not copy its lightness, because its lightness is inconsistent', () => {
    // Tailwind yellow-500 sits at L* 75.9 while its blue-500 is at L* 55.6, so
    // the same shade number means very different things per hue. This is the
    // problem the shared ladder exists to solve, so matching it would be a
    // regression, not a fix.
    const yellowL = lstarFromY(yFromHex(REFERENCE.yellow[5]))
    const blueL = lstarFromY(yFromHex(REFERENCE.blue[5]))
    expect(yellowL - blueL).toBeGreaterThan(15)

    // The practical consequence: their yellow-500 is not usable for text on
    // white, though its shade number suggests it is interchangeable with blue's.
    expect(wcagContrastHex(REFERENCE.yellow[5], '#ffffff')).toBeLessThan(3)
    expect(wcagContrastHex(REFERENCE.blue[5], '#ffffff')).toBeGreaterThan(3)
  })

  it('keeps every hue interchangeable at the same shade number', () => {
    for (const color of ['#eab308', '#3b82f6', '#ef4444', '#10b981', '#ffff00']) {
      const ramp = generatePalette({ seeds: [{ color }] }).ramps[0]
      const shade500 = ramp.swatches.find((s) => s.label === 500)!
      expect(
        wcagContrastHex(shade500.hex, '#ffffff'),
        `${color} shade 500 (${shade500.hex})`,
      ).toBeGreaterThanOrEqual(3)
    }
  })
})
