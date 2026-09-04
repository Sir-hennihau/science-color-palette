import { describe, expect, it } from 'vitest'
import fc from 'fast-check'

import { generatePalette } from '../palette.ts'
import { inGamut } from '../color/gamut.ts'
import { apcaLc } from '../contrast/apca.ts'
import { wcagContrastHex } from '../contrast/wcag.ts'
import { exportPalette, EXPORT_FORMATS } from '../export/index.ts'
import { MAX_HUE_DRIFT } from '../curves/hue.ts'
import { MAX_STEPS, MIN_STEPS } from '../ladder.ts'
import type { ChromaPreset, PaletteConfig, SeedMode } from '../types.ts'

/**
 * Invariants that must hold for *any* input, checked against generated configs.
 *
 * Hand-picked cases catch the failures you thought of; these catch the ones you
 * did not. Runs are seeded so a failure is reproducible.
 */

const RUNS = 250
const SEED = 20260904

const hexArb = fc
  .tuple(fc.integer({ min: 0, max: 255 }), fc.integer({ min: 0, max: 255 }), fc.integer({ min: 0, max: 255 }))
  .map(([r, g, b]) => `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`)

const configArb: fc.Arbitrary<PaletteConfig> = fc.record({
  seeds: fc.array(
    fc.record({
      color: hexArb,
      mode: fc.constantFrom<SeedMode>('exact', 'harmonize'),
    }),
    { minLength: 1, maxLength: 3 },
  ),
  ladder: fc.record({ steps: fc.integer({ min: MIN_STEPS, max: MAX_STEPS }) }),
  chroma: fc.record({ preset: fc.constantFrom<ChromaPreset>('vivid', 'natural', 'muted') }),
  hueDrift: fc.integer({ min: -MAX_HUE_DRIFT, max: MAX_HUE_DRIFT }),
  neutrals: fc.record({ tintStrength: fc.float({ min: 0, max: 1, noNaN: true }) }),
  harmony: fc.record({ auto: fc.boolean() }),
})

function check(name: string, predicate: (config: PaletteConfig) => void): void {
  it(name, () => {
    fc.assert(
      fc.property(configArb, (config) => {
        predicate(config)
      }),
      { numRuns: RUNS, seed: SEED },
    )
  })
}

describe('invariants for any palette', () => {
  check('never throws on a well-formed config', (config) => {
    expect(() => generatePalette(config)).not.toThrow()
  })

  check('every colour is displayable', (config) => {
    for (const ramp of generatePalette(config).ramps) {
      for (const swatch of ramp.swatches) {
        expect(swatch.hex).toMatch(/^#[0-9a-f]{6}$/)
        expect(inGamut(swatch.oklch, 'srgb')).toBe(true)
      }
    }
  })

  check('every ramp runs strictly light to dark', (config) => {
    for (const ramp of generatePalette(config).ramps) {
      for (let i = 1; i < ramp.swatches.length; i++) {
        expect(ramp.swatches[i].wcag.y).toBeLessThan(ramp.swatches[i - 1].wcag.y)
      }
    }
  })

  check('a shared-ladder ramp always keeps its contrast promises', (config) => {
    for (const ramp of generatePalette(config).ramps) {
      if (!ramp.report.usesSharedLadder) continue
      expect(ramp.report.brokenGuarantees).toEqual([])
    }
  })

  check('a broken promise is always reported, never silent', (config) => {
    // Exact mode may cost a guarantee. What it may never do is fail one without
    // saying so.
    for (const ramp of generatePalette(config).ramps) {
      for (const swatch of ramp.swatches) {
        for (const guarantee of swatch.guarantees) {
          if (guarantee.met) continue
          expect(
            ramp.report.brokenGuarantees.some(
              (b) => b.label === swatch.label && b.kind === guarantee.kind,
            ),
          ).toBe(true)
          expect(ramp.report.warnings.some((w) => w.code === 'GUARANTEE_NOT_MET')).toBe(true)
        }
      }
    }
  })

  check('a measured guarantee agrees with an independent measurement', (config) => {
    for (const ramp of generatePalette(config).ramps) {
      for (const swatch of ramp.swatches) {
        for (const guarantee of swatch.guarantees) {
          const background = guarantee.kind === 'ratioOnWhite' ? '#ffffff' : '#000000'
          expect(guarantee.actual).toBeCloseTo(wcagContrastHex(swatch.hex, background), 3)
        }
      }
    }
  })

  check('an exact seed survives verbatim', (config) => {
    const palette = generatePalette(config)

    for (const [index, seed] of config.seeds.entries()) {
      if (seed.mode !== 'exact') continue
      const ramp = palette.ramps[index]
      const seeded = ramp.swatches.filter((s) => s.isSeed)
      expect(seeded).toHaveLength(1)
      expect(seeded[0].hex).toBe(seed.color.toLowerCase())
    }
  })

  check('a harmonized ramp never pins a swatch', (config) => {
    const palette = generatePalette(config)

    for (const [index, seed] of config.seeds.entries()) {
      if (seed.mode !== 'harmonize') continue
      expect(palette.ramps[index].swatches.some((s) => s.isSeed)).toBe(false)
    }
  })

  check('the palette-wide table is a true lower bound', (config) => {
    const palette = generatePalette(config)

    for (const ramp of palette.ramps) {
      if (!ramp.report.usesSharedLadder) continue
      palette.sharedPairTable.forEach((entry, i) => {
        expect(entry.minWcag).toBeLessThanOrEqual(ramp.report.pairTable[i].minWcag + 1e-9)
      })
    }
  })

  check('wider step separations never contrast less', (config) => {
    for (const ramp of generatePalette(config).ramps) {
      const table = ramp.report.pairTable
      for (let i = 1; i < table.length; i++) {
        expect(table[i].minWcag).toBeGreaterThanOrEqual(table[i - 1].minWcag - 1e-9)
      }
    }
  })

  check('label text on a swatch is the perceptually better choice', (config) => {
    for (const ramp of generatePalette(config).ramps) {
      for (const swatch of ramp.swatches) {
        const black = Math.abs(apcaLc('#000000', swatch.hex))
        const white = Math.abs(apcaLc('#ffffff', swatch.hex))
        expect(swatch.onHex).toBe(black >= white ? '#000000' : '#ffffff')

        // And it is comfortably readable at the size a swatch label is drawn.
        expect(Math.max(black, white)).toBeGreaterThan(45)
      }
    }
  })

  check('a WCAG-led choice of label colour would always clear 4.5:1', (config) => {
    // APCA and WCAG sometimes disagree about which of black or white reads
    // better, and the engine follows APCA. Anyone who has to follow WCAG can
    // pick the other way from the same swatch and still be safe, because the
    // worst case is the crossover luminance where both score about 4.58:1.
    for (const ramp of generatePalette(config).ramps) {
      for (const swatch of ramp.swatches) {
        const best = Math.max(
          wcagContrastHex('#000000', swatch.hex),
          wcagContrastHex('#ffffff', swatch.hex),
        )
        expect(best).toBeGreaterThan(4.5)
      }
    }
  })

  check('shade labels are unique and ordered', (config) => {
    for (const ramp of generatePalette(config).ramps) {
      const labels = ramp.swatches.map((s) => s.label)
      expect(new Set(labels).size).toBe(labels.length)
      for (let i = 1; i < labels.length; i++) {
        expect(labels[i]).toBeGreaterThan(labels[i - 1])
      }
    }
  })

  check('hues stay in range and greys stay grey', (config) => {
    for (const ramp of generatePalette(config).ramps) {
      if (ramp.hue !== null) {
        expect(ramp.hue).toBeGreaterThanOrEqual(0)
        expect(ramp.hue).toBeLessThan(360)
      }
      for (const swatch of ramp.swatches) {
        expect(swatch.oklch.h).toBeGreaterThanOrEqual(0)
        expect(swatch.oklch.h).toBeLessThan(360)
        expect(swatch.oklch.c).toBeGreaterThanOrEqual(0)
        if (ramp.hue === null) expect(swatch.oklch.c).toBe(0)
      }
    }
  })

  check('output is finite and JSON-safe', (config) => {
    const palette = generatePalette(config)

    const walk = (value: unknown): void => {
      if (typeof value === 'number') {
        expect(Number.isFinite(value)).toBe(true)
      } else if (Array.isArray(value)) {
        value.forEach(walk)
      } else if (value && typeof value === 'object') {
        Object.values(value).forEach(walk)
      }
    }

    walk(palette)
    expect(JSON.parse(JSON.stringify(palette))).toEqual(palette)
  })

  check('generation is deterministic', (config) => {
    expect(JSON.stringify(generatePalette(config))).toBe(
      JSON.stringify(generatePalette(config)),
    )
  })

  check('every export format renders', (config) => {
    const palette = generatePalette(config)
    for (const descriptor of EXPORT_FORMATS) {
      const output = exportPalette(palette, descriptor.format)
      expect(output.length).toBeGreaterThan(50)
      if (descriptor.language === 'json') {
        expect(() => JSON.parse(output)).not.toThrow()
      }
    }
  })
})
