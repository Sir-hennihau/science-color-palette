import { describe, expect, it } from 'vitest'
import fc from 'fast-check'

import { generatePalette } from '../palette.ts'
import { inGamut } from '../color/gamut.ts'
import { apcaLc } from '../contrast/apca.ts'
import { wcagContrastHex } from '../contrast/wcag.ts'
import { exportPalette, EXPORT_FORMATS } from '../export/index.ts'
import { MAX_HUE_DRIFT } from '../curves/hue.ts'
import { MAX_STEPS, MIN_STEPS } from '../ladder.ts'
import { MAX_FAMILIES, MIN_FAMILIES } from '../spectrum.ts'
import type { ChromaPreset, Palette, PaletteConfig, SeedMode } from '../types.ts'

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
  spectrum: fc.record({
    families: fc.integer({ min: MIN_FAMILIES, max: MAX_FAMILIES }),
  }),
  ladder: fc.record({ steps: fc.integer({ min: MIN_STEPS, max: MAX_STEPS }) }),
  chroma: fc.record({ preset: fc.constantFrom<ChromaPreset>('vivid', 'natural', 'muted') }),
  hueDrift: fc.integer({ min: -MAX_HUE_DRIFT, max: MAX_HUE_DRIFT }),
  neutrals: fc.record({ tintStrength: fc.float({ min: 0, max: 1, noNaN: true }) }),
})

/**
 * Every check runs over the same generated configs, and generation is
 * deterministic, so the palettes are computed once and shared. Without this the
 * suite generates the same few hundred palettes once per invariant.
 */
const cache = new Map<string, Palette>()

function paletteFor(config: PaletteConfig): Palette {
  const key = JSON.stringify(config)
  let palette = cache.get(key)
  if (!palette) {
    palette = generatePalette(config)
    cache.set(key, palette)
  }
  return palette
}

/**
 * Generous timeout: the first check pays for sampling the chroma envelope of
 * every random hue in the run, which is real work and worth doing.
 */
const TIMEOUT_MS = 60_000

function check(name: string, predicate: (config: PaletteConfig) => void): void {
  it(
    name,
    () => {
      fc.assert(
        fc.property(configArb, (config) => {
          predicate(config)
        }),
        { numRuns: RUNS, seed: SEED },
      )
    },
    TIMEOUT_MS,
  )
}

describe('invariants for any palette', () => {
  check('never throws on a well-formed config', (config) => {
    expect(() => paletteFor(config)).not.toThrow()
  })

  check('every colour is displayable', (config) => {
    for (const ramp of paletteFor(config).ramps) {
      for (const swatch of ramp.swatches) {
        expect(swatch.hex).toMatch(/^#[0-9a-f]{6}$/)
        expect(inGamut(swatch.oklch, 'srgb')).toBe(true)
      }
    }
  })

  check('every ramp runs strictly light to dark', (config) => {
    for (const ramp of paletteFor(config).ramps) {
      for (let i = 1; i < ramp.swatches.length; i++) {
        expect(ramp.swatches[i].wcag.y).toBeLessThan(ramp.swatches[i - 1].wcag.y)
      }
    }
  })

  check('a shared-ladder ramp always keeps its contrast promises', (config) => {
    for (const ramp of paletteFor(config).ramps) {
      if (!ramp.report.usesSharedLadder) continue
      expect(ramp.report.brokenGuarantees).toEqual([])
    }
  })

  check('a broken promise is always reported, never silent', (config) => {
    // Exact mode may cost a guarantee. What it may never do is fail one without
    // saying so.
    for (const ramp of paletteFor(config).ramps) {
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
    for (const ramp of paletteFor(config).ramps) {
      for (const swatch of ramp.swatches) {
        for (const guarantee of swatch.guarantees) {
          // Spelled out rather than imported, so the check stays independent of
          // the code it is checking. A `ratioOnLightest` contract is measured
          // against this ramp's own shade 50.
          const background =
            guarantee.kind === 'ratioOnWhite'
              ? '#ffffff'
              : guarantee.kind === 'ratioOnBlack'
                ? '#000000'
                : ramp.swatches[0].hex
          expect(guarantee.actual).toBeCloseTo(wcagContrastHex(swatch.hex, background), 3)
        }
      }
    }
  })

  check('an exact seed survives verbatim', (config) => {
    const palette = paletteFor(config)

    for (const seed of config.seeds) {
      if (seed.mode !== 'exact') continue
      const hex = seed.color.toLowerCase()
      // Two seeds of nearly the same hue collapse into one family, so a seed
      // may legitimately have no family of its own.
      const ramp = palette.ramps.find((r) => r.seed?.input === hex)
      if (!ramp) continue
      const seeded = ramp.swatches.filter((s) => s.isSeed)
      expect(seeded).toHaveLength(1)
      expect(seeded[0].hex).toBe(hex)
    }
  })

  check('a harmonized ramp never pins a swatch', (config) => {
    const palette = paletteFor(config)

    for (const ramp of palette.ramps) {
      if (ramp.seed?.mode !== 'harmonize') continue
      expect(ramp.swatches.some((s) => s.isSeed)).toBe(false)
    }
  })

  check('family names are unique', (config) => {
    const names = paletteFor(config).ramps.map((r) => r.name)
    expect(new Set(names).size).toBe(names.length)
  })

  check('no family is named after a job', (config) => {
    for (const name of paletteFor(config).ramps.map((r) => r.name)) {
      expect(['danger', 'warning', 'success', 'info', 'primary']).not.toContain(name)
    }
  })

  check('every role hint names a family that exists', (config) => {
    const palette = paletteFor(config)
    const names = palette.ramps.map((r) => r.name)
    for (const hint of palette.roleHints) {
      expect(names).toContain(hint.family)
    }
  })

  check('the palette-wide table is a true lower bound', (config) => {
    const palette = paletteFor(config)

    for (const ramp of palette.ramps) {
      if (!ramp.report.usesSharedLadder) continue
      palette.sharedPairTable.forEach((entry, i) => {
        expect(entry.minWcag).toBeLessThanOrEqual(ramp.report.pairTable[i].minWcag + 1e-9)
      })
    }
  })

  check('wider step separations never contrast less', (config) => {
    for (const ramp of paletteFor(config).ramps) {
      const table = ramp.report.pairTable
      for (let i = 1; i < table.length; i++) {
        expect(table[i].minWcag).toBeGreaterThanOrEqual(table[i - 1].minWcag - 1e-9)
      }
    }
  })

  check('label text on a swatch is the perceptually better choice', (config) => {
    for (const ramp of paletteFor(config).ramps) {
      for (const swatch of ramp.swatches) {
        const black = Math.abs(apcaLc('#000000', swatch.hex))
        const white = Math.abs(apcaLc('#ffffff', swatch.hex))
        expect(swatch.onHex).toBe(black >= white ? '#000000' : '#ffffff')

        // And it is comfortably readable at the size a swatch label is drawn.
        expect(Math.max(black, white)).toBeGreaterThan(45)
      }
    }
  })

  check('the conformant label colour always clears 4.5:1', (config) => {
    // APCA and WCAG sometimes disagree about which of black or white reads
    // better. `onHex` follows APCA; `onHexWcag` is for when conformance has to
    // be provable, and it is always safe because the worst case is the
    // crossover luminance where both score about 4.58:1.
    for (const ramp of paletteFor(config).ramps) {
      for (const swatch of ramp.swatches) {
        const black = wcagContrastHex('#000000', swatch.hex)
        const white = wcagContrastHex('#ffffff', swatch.hex)

        expect(swatch.onHexWcag).toBe(black >= white ? '#000000' : '#ffffff')
        expect(wcagContrastHex(swatch.onHexWcag, swatch.hex)).toBeGreaterThan(4.5)
      }
    }
  })

  check('shade labels are unique and ordered', (config) => {
    for (const ramp of paletteFor(config).ramps) {
      const labels = ramp.swatches.map((s) => s.label)
      expect(new Set(labels).size).toBe(labels.length)
      for (let i = 1; i < labels.length; i++) {
        expect(labels[i]).toBeGreaterThan(labels[i - 1])
      }
    }
  })

  check('hues stay in range and greys stay grey', (config) => {
    for (const ramp of paletteFor(config).ramps) {
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
    const palette = paletteFor(config)

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
    const palette = paletteFor(config)
    for (const descriptor of EXPORT_FORMATS) {
      const output = exportPalette(palette, descriptor.format)
      expect(output.length).toBeGreaterThan(50)
      if (descriptor.language === 'json') {
        expect(() => JSON.parse(output)).not.toThrow()
      }
    }
  })
})
