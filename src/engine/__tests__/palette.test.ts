import { describe, expect, it } from 'vitest'

import { generatePalette } from '../palette.ts'
import { inGamut } from '../color/gamut.ts'
import { apcaLc } from '../contrast/apca.ts'
import { wcagContrastHex } from '../contrast/wcag.ts'
import { EngineError, type Palette } from '../types.ts'

const BLURPLE = '#635bff'

function rampNamed(palette: Palette, name: string) {
  const ramp = palette.ramps.find((r) => r.name === name)
  if (!ramp) throw new Error(`no ramp named ${name} in [${palette.ramps.map((r) => r.name)}]`)
  return ramp
}

/** The family anchored on the first seed, whatever colour name it received. */
function seedRamp(palette: Palette) {
  const ramp = palette.ramps.find((r) => r.seed)
  if (!ramp) throw new Error('no seeded ramp')
  return ramp
}

describe('generating a palette', () => {
  it('builds a full spectrum of named families from a single seed', () => {
    const palette = generatePalette({ seeds: [{ color: BLURPLE }] })

    // Ten families plus greys, named by colour rather than by job.
    expect(palette.ramps).toHaveLength(11)
    expect(palette.ramps.at(-1)!.name).toBe('neutral')
    expect(palette.ramps.every((r) => r.swatches.length === 11)).toBe(true)

    const names = palette.ramps.map((r) => r.name)
    expect(new Set(names).size).toBe(names.length)
    for (const banned of ['danger', 'warning', 'success', 'info', 'primary']) {
      expect(names).not.toContain(banned)
    }
  })

  it('starts the walk at the seed and continues round the wheel', () => {
    const palette = generatePalette({ seeds: [{ color: '#14b8a6' }] })
    const families = palette.ramps.filter((r) => r.role !== 'neutral')

    // The seed's own family comes first.
    expect(families[0].seed).toBeDefined()
    expect(families[0].name).toBe('teal')

    // And the rest ascend in hue from there, wrapping once.
    const offsets = families.map((r) => (r.hue! - families[0].hue! + 360) % 360)
    for (let i = 1; i < offsets.length; i++) {
      expect(offsets[i], `family ${i}`).toBeGreaterThan(offsets[i - 1])
    }
  })

  it('names families after the colours they actually are', () => {
    // A seed that is plainly blue should produce a family called blue, and the
    // spectrum around it should carry the other familiar names.
    const palette = generatePalette({ seeds: [{ color: '#3b82f6' }] })
    const names = palette.ramps.map((r) => r.name)

    expect(names).toContain('blue')
    expect(names.filter((n) => n.startsWith('hue-'))).toEqual([])
  })

  it('respects a dynamic family count', () => {
    for (const families of [3, 6, 10, 16]) {
      const palette = generatePalette({
        seeds: [{ color: BLURPLE }],
        spectrum: { families },
      })
      expect(palette.ramps.filter((r) => r.role !== 'neutral')).toHaveLength(families)
    }
  })

  it('anchors every seed in the spectrum', () => {
    const palette = generatePalette({
      seeds: [{ color: '#3b82f6' }, { color: '#f59e0b' }, { color: '#ec4899' }],
    })
    const seeded = palette.ramps.filter((r) => r.seed)
    expect(seeded).toHaveLength(3)
  })

  it('spreads the spectrum evenly from a lone seed', () => {
    const palette = generatePalette({
      seeds: [{ color: BLURPLE }],
      spectrum: { families: 8 },
    })
    const hues = palette.ramps.filter((r) => r.role !== 'neutral').map((r) => r.hue!)

    for (let i = 1; i < hues.length; i++) {
      const gap = (hues[i] - hues[i - 1] + 360) % 360
      expect(gap, `gap ${i}`).toBeCloseTo(45, 1)
    }
  })

  it('gives the wide arc more families when two seeds sit close together', () => {
    // Two nearby colours leave one narrow arc and one wide one; the wide one is
    // where there is actually room for distinguishable colours.
    const palette = generatePalette({
      seeds: [{ color: '#3b82f6' }, { color: '#6366f1' }],
      spectrum: { families: 10 },
    })
    const families = palette.ramps.filter((r) => r.role !== 'neutral')
    expect(families).toHaveLength(10)

    const seedHues = families.filter((r) => r.seed).map((r) => r.hue!).sort((a, b) => a - b)
    const inNarrowArc = families.filter(
      (r) => !r.seed && r.hue! > seedHues[0] && r.hue! < seedHues[1],
    )
    expect(inNarrowArc.length).toBeLessThan(3)
  })

  it('says when two families are too close to tell apart', () => {
    // Crowding comes from colours sitting close on the wheel, not from a high
    // family count on its own: ten families are 36 degrees apart, which is
    // plenty. Two seeds a little way apart is what squeezes a gap shut.
    const roomy = generatePalette({
      seeds: [{ color: BLURPLE }],
      spectrum: { families: 16 },
    })
    expect(roomy.warnings.map((w) => w.code)).not.toContain('SPECTRUM_CROWDED')

    const crowded = generatePalette({
      seeds: [{ color: '#3b82f6' }, { color: '#7c6df5' }],
      spectrum: { families: 16 },
    })
    expect(crowded.warnings.map((w) => w.code)).toContain('SPECTRUM_CROWDED')
  })

  it('merges two seeds that are the same colour', () => {
    // Two hues within ten degrees cannot anchor two distinct families, so one
    // family carries both rather than the palette gaining a duplicate row.
    const palette = generatePalette({
      seeds: [{ color: '#3b82f6' }, { color: '#3f85f7' }],
      spectrum: { families: 6 },
    })
    expect(palette.ramps.filter((r) => r.role !== 'neutral')).toHaveLength(6)
    expect(palette.ramps.filter((r) => r.seed)).toHaveLength(1)
  })

  it('suggests which family suits each conventional role', () => {
    const palette = generatePalette({ seeds: [{ color: BLURPLE }] })
    const roles = palette.roleHints.map((h) => h.role)

    expect(roles).toEqual(['danger', 'warning', 'success', 'info'])
    for (const hint of palette.roleHints) {
      expect(palette.ramps.map((r) => r.name)).toContain(hint.family)
    }
  })

  it('labels shades the familiar way', () => {
    const palette = generatePalette({ seeds: [{ color: BLURPLE }] })
    expect(seedRamp(palette).swatches.map((s) => s.label)).toEqual([
      50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950,
    ])
  })

  it('keeps every colour displayable', () => {
    const palette = generatePalette({ seeds: [{ color: BLURPLE }, { color: '#f59e0b' }] })

    for (const ramp of palette.ramps) {
      for (const swatch of ramp.swatches) {
        expect(inGamut(swatch.oklch, 'srgb'), `${ramp.name} ${swatch.label}`).toBe(true)
        expect(swatch.hex).toMatch(/^#[0-9a-f]{6}$/)
      }
    }
  })

  it('runs every ramp from light to dark', () => {
    const palette = generatePalette({ seeds: [{ color: BLURPLE }] })

    for (const ramp of palette.ramps) {
      for (let i = 1; i < ramp.swatches.length; i++) {
        expect(ramp.swatches[i].wcag.y, `${ramp.name} step ${i}`).toBeLessThan(
          ramp.swatches[i - 1].wcag.y,
        )
      }
    }
  })

  it('honours the contrast contracts on every shared-ladder ramp', () => {
    const palette = generatePalette({ seeds: [{ color: BLURPLE }, { color: '#f59e0b' }] })

    for (const ramp of palette.ramps) {
      if (!ramp.report.usesSharedLadder) continue
      expect(ramp.report.brokenGuarantees, `${ramp.name}`).toEqual([])

      for (const swatch of ramp.swatches) {
        for (const guarantee of swatch.guarantees) {
          expect(guarantee.met, `${ramp.name} ${swatch.label}`).toBe(true)
        }
      }
    }
  })

  it('gives shades 500, 600 and 700 the promised ratios in every hue', () => {
    const palette = generatePalette({
      seeds: [{ color: '#ffff00' }, { color: '#0000ff' }],
    })

    const expected: Record<number, number> = { 500: 3, 600: 4.5, 700: 7 }

    for (const ramp of palette.ramps) {
      if (!ramp.report.usesSharedLadder) continue
      for (const swatch of ramp.swatches) {
        const target = expected[swatch.label]
        if (target === undefined) continue
        expect(
          wcagContrastHex(swatch.hex, '#ffffff'),
          `${ramp.name} ${swatch.label} (${swatch.hex})`,
        ).toBeGreaterThanOrEqual(target)
      }
    }
  })

  it('gives every shared-ladder ramp the same luminance per step', () => {
    // This is what makes one contrast table valid for the whole palette.
    const palette = generatePalette({
      seeds: [{ color: BLURPLE }, { color: '#f59e0b' }],
    })

    const shared = palette.ramps.filter((r) => r.report.usesSharedLadder)
    expect(shared.length).toBeGreaterThan(3)

    for (let i = 0; i < 11; i++) {
      const luminances = shared.map((r) => r.swatches[i].wcag.y)
      expect(Math.max(...luminances) - Math.min(...luminances)).toBeLessThan(0.02)
    }

    // The palette-wide table is a genuine lower bound, not one ramp's numbers:
    // quantisation separates the hues slightly, so the worst case is taken.
    for (const ramp of shared) {
      for (let d = 0; d < palette.sharedPairTable.length; d++) {
        expect(
          palette.sharedPairTable[d].minWcag,
          `${ramp.name} distance ${d + 1}`,
        ).toBeLessThanOrEqual(ramp.report.pairTable[d].minWcag + 1e-9)
        expect(palette.sharedPairTable[d].minApcaLc).toBeLessThanOrEqual(
          ramp.report.pairTable[d].minApcaLc + 1e-9,
        )
      }
    }
  })

  it('reports worst-case contrast for each step separation', () => {
    const palette = generatePalette({ seeds: [{ color: BLURPLE }] })
    const table = palette.sharedPairTable

    expect(table).toHaveLength(10)
    expect(table[0].distance).toBe(1)

    // Wider separations are always at least as readable as narrower ones.
    for (let i = 1; i < table.length; i++) {
      expect(table[i].minWcag).toBeGreaterThan(table[i - 1].minWcag)
    }
  })

  it('states which shade first clears each level on white', () => {
    const palette = generatePalette({ seeds: [{ color: BLURPLE }] })
    const { firstOnWhite } = seedRamp(palette).report

    expect(firstOnWhite.aaLarge).toBe(500)
    expect(firstOnWhite.aa).toBe(600)
    expect(firstOnWhite.aaa).toBe(700)
  })

  it('respects a dynamic step count', () => {
    for (const steps of [5, 7, 11, 15]) {
      const palette = generatePalette({ seeds: [{ color: BLURPLE }], ladder: { steps } })
      expect(palette.ramps.every((r) => r.swatches.length === steps)).toBe(true)
    }
  })

  it('picks legible label text for every swatch', () => {
    // Judged by APCA, which is what the engine follows; see the property tests
    // for the case where WCAG would have chosen the harder-to-read option.
    const palette = generatePalette({ seeds: [{ color: BLURPLE }] })
    for (const ramp of palette.ramps) {
      for (const swatch of ramp.swatches) {
        expect(['#000000', '#ffffff']).toContain(swatch.onHex)
        expect(
          Math.abs(apcaLc(swatch.onHex, swatch.hex)),
          `${ramp.name} ${swatch.label}`,
        ).toBeGreaterThan(45)
      }
    }
  })
})

describe('seed modes', () => {
  it('keeps an exact seed byte for byte', () => {
    const palette = generatePalette({ seeds: [{ color: BLURPLE, mode: 'exact' }] })
    const primary = seedRamp(palette)

    const seeded = primary.swatches.filter((s) => s.isSeed)
    expect(seeded).toHaveLength(1)
    expect(seeded[0].hex).toBe(BLURPLE)
    expect(primary.seed?.mode).toBe('exact')
    expect(primary.seed?.slotLabel).toBe(seeded[0].label)
  })

  it('moves a harmonized seed onto the ladder and says how far', () => {
    const palette = generatePalette({ seeds: [{ color: BLURPLE, mode: 'harmonize' }] })
    const primary = seedRamp(palette)

    expect(primary.swatches.some((s) => s.isSeed)).toBe(false)
    expect(primary.seed?.mode).toBe('harmonize')
    expect(primary.seed?.delta.eok).toBeGreaterThan(0)
    expect(primary.report.usesSharedLadder).toBe(true)
  })

  it('marks an exact ramp as no longer sharing the ladder', () => {
    const palette = generatePalette({ seeds: [{ color: BLURPLE, mode: 'exact' }] })
    expect(seedRamp(palette).report.usesSharedLadder).toBe(false)
  })

  it('keeps an exact ramp monotone and displayable', () => {
    for (const color of ['#635bff', '#000000', '#ffffff', '#808080', '#ffff00', '#0a0a0a']) {
      const palette = generatePalette({ seeds: [{ color, mode: 'exact' }] })
      const primary = seedRamp(palette)

      expect(
        primary.swatches.some((s) => s.hex === color.toLowerCase()),
        color,
      ).toBe(true)
      for (let i = 1; i < primary.swatches.length; i++) {
        expect(primary.swatches[i].wcag.y, `${color} step ${i}`).toBeLessThan(
          primary.swatches[i - 1].wcag.y,
        )
      }
      for (const swatch of primary.swatches) {
        expect(inGamut(swatch.oklch, 'srgb')).toBe(true)
      }
    }
  })

  it('reports a broken promise rather than hiding it', () => {
    // Mid-grey lands on shade 600, where 4.5:1 on white is expected, but grey
    // that light only reaches about 3.9:1. Exact mode keeps the colour and says
    // what it cost.
    const palette = generatePalette({ seeds: [{ color: '#808080', mode: 'exact' }] })
    const primary = seedRamp(palette)

    const broken = primary.report.brokenGuarantees
    expect(broken.length).toBeGreaterThan(0)
    expect(broken[0].met).toBe(false)
    expect(broken[0].actual).toBeLessThan(broken[0].target)

    const warning = primary.report.warnings.find((w) => w.code === 'GUARANTEE_NOT_MET')
    expect(warning).toBeDefined()
    // And it points at a shade that does work.
    expect(warning!.message).toMatch(/Use \w+ \d+ instead/)
  })

  it('honours an explicit slot and rejects an impossible one', () => {
    const palette = generatePalette({
      seeds: [{ color: BLURPLE, mode: 'exact', slot: 400 }],
    })
    const seeded = seedRamp(palette).swatches.find((s) => s.isSeed)
    expect(seeded?.label).toBe(400)

    expect(() => generatePalette({ seeds: [{ color: BLURPLE, slot: 42 }] })).toThrow(
      /no shade 42/,
    )
  })

  it('rotates a blended seed toward the first but no further than 15 degrees', () => {
    const seedHue = (palette: Palette, hex: string) =>
      palette.ramps.find((r) => r.seed?.input === hex)!.hue!

    const blended = generatePalette({
      seeds: [{ color: BLURPLE }, { color: '#f59e0b', blendHue: true }],
    })
    const plain = generatePalette({
      seeds: [{ color: BLURPLE }, { color: '#f59e0b' }],
    })

    const rotation = Math.abs(seedHue(blended, '#f59e0b') - seedHue(plain, '#f59e0b'))
    expect(rotation).toBeGreaterThan(0)
    expect(rotation).toBeLessThanOrEqual(15.0001)
  })
})

describe('greyscale seeds', () => {
  it('stays grey instead of inventing a spectrum', () => {
    // A colour with no hue gives nothing to build a spectrum from, so the
    // honest answer is greys and a note saying why.
    const palette = generatePalette({ seeds: [{ color: '#808080' }] })

    expect(palette.ramps.map((r) => r.name)).toEqual(['grey', 'neutral'])
    for (const ramp of palette.ramps) {
      expect(ramp.hue).toBeNull()
      expect(ramp.swatches.every((s) => s.oklch.c === 0)).toBe(true)
    }
    expect(palette.warnings.map((w) => w.code)).toContain('NO_HUE')
    expect(palette.roleHints).toEqual([])
  })

  it('still ships a colourless seed that was marked exact', () => {
    // A grey cannot anchor a hue, but it is still a colour someone asked to
    // keep, so it has to appear somewhere in the palette.
    const palette = generatePalette({ seeds: [{ color: '#808080', mode: 'exact' }] })
    const grey = rampNamed(palette, 'grey')

    expect(grey.swatches.filter((s) => s.isSeed)).toHaveLength(1)
    expect(grey.swatches.find((s) => s.isSeed)!.hex).toBe('#808080')
  })

  it('names several colourless seeds apart', () => {
    const palette = generatePalette({
      seeds: [{ color: '#808080' }, { color: '#333333' }],
    })
    expect(palette.ramps.map((r) => r.name)).toEqual(['grey', 'grey-2', 'neutral'])
  })

  it('builds the spectrum from whichever colour does have a hue', () => {
    const palette = generatePalette({ seeds: [{ color: '#808080' }, { color: '#3b82f6' }] })
    expect(palette.ramps.filter((r) => r.role !== 'neutral').length).toBeGreaterThan(5)
    expect(palette.ramps.map((r) => r.name)).toContain('blue')
  })
})

describe('neutrals', () => {
  it('tints toward the primary, barely', () => {
    const palette = generatePalette({ seeds: [{ color: BLURPLE }] })
    const neutral = rampNamed(palette, 'neutral')

    const mid = neutral.swatches[5]
    expect(mid.oklch.c).toBeGreaterThan(0)
    expect(mid.oklch.c).toBeLessThan(0.02)
    expect(neutral.hue).toBeCloseTo(seedRamp(palette).hue!, 4)
  })

  it('goes fully grey at zero tint', () => {
    const palette = generatePalette({
      seeds: [{ color: BLURPLE }],
      neutrals: { tintStrength: 0 },
    })
    expect(rampNamed(palette, 'neutral').swatches.every((s) => s.oklch.c === 0)).toBe(true)
  })

  it('can be turned off', () => {
    const palette = generatePalette({
      seeds: [{ color: BLURPLE }],
      neutrals: { enabled: false },
    })
    expect(palette.ramps.some((r) => r.name === 'neutral')).toBe(false)
  })
})

describe('determinism', () => {
  it('produces identical output for identical input', () => {
    const config = {
      seeds: [{ color: BLURPLE, mode: 'exact' as const }, { color: '#f59e0b' }],
      ladder: { steps: 9 },
      chroma: { preset: 'vivid' as const },
    }

    expect(JSON.stringify(generatePalette(config))).toBe(
      JSON.stringify(generatePalette(config)),
    )
  })

  it('survives a JSON round trip', () => {
    const palette = generatePalette({ seeds: [{ color: BLURPLE }] })
    expect(JSON.parse(JSON.stringify(palette))).toEqual(palette)
  })

  it('contains no unrepresentable numbers', () => {
    const palette = generatePalette({
      seeds: [{ color: BLURPLE, mode: 'exact' }, { color: '#000000' }],
    })

    const walk = (value: unknown, path: string): void => {
      if (typeof value === 'number') {
        expect(Number.isFinite(value), `${path} = ${value}`).toBe(true)
      } else if (Array.isArray(value)) {
        value.forEach((v, i) => walk(v, `${path}[${i}]`))
      } else if (value && typeof value === 'object') {
        for (const [k, v] of Object.entries(value)) walk(v, `${path}.${k}`)
      }
    }

    walk(palette, 'palette')
  })
})

describe('input validation', () => {
  it('rejects an empty or oversized seed list', () => {
    expect(() => generatePalette({ seeds: [] })).toThrow(EngineError)
    expect(() =>
      generatePalette({ seeds: Array.from({ length: 6 }, () => ({ color: BLURPLE })) }),
    ).toThrow(/at most 5/)
  })

  it('rejects an unreadable colour with a useful message', () => {
    expect(() => generatePalette({ seeds: [{ color: 'chartreuseish' }] })).toThrow(
      /Try a hex value/,
    )
  })

  it('reports a seed that had to be clipped into range', () => {
    const palette = generatePalette({ seeds: [{ color: 'oklch(0.85 0.35 145)' }] })
    expect(palette.warnings.map((w) => w.code)).toContain('SEED_CLIPPED')
  })
})
