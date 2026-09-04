import { describe, expect, it } from 'vitest'

import { generatePalette } from '../palette.ts'
import { ALGORITHM_VERSION } from '../version.ts'
import type { PaletteConfig } from '../types.ts'

/**
 * Golden snapshots.
 *
 * These exist to catch output changing when nobody meant it to. A diff here is
 * not automatically a failure — but it does mean the algorithm moved, so the
 * new colours should be looked at and {@link ALGORITHM_VERSION} bumped before
 * the snapshot is re-recorded.
 */

const CASES: Array<{ name: string; config: PaletteConfig }> = [
  { name: 'blurple, harmonize', config: { seeds: [{ color: '#635bff' }] } },
  { name: 'blurple, exact', config: { seeds: [{ color: '#635bff', mode: 'exact' }] } },
  { name: 'pure yellow', config: { seeds: [{ color: '#ffff00' }] } },
  { name: 'pure blue', config: { seeds: [{ color: '#0000ff' }] } },
  { name: 'black, exact', config: { seeds: [{ color: '#000000', mode: 'exact' }] } },
  { name: 'white, exact', config: { seeds: [{ color: '#ffffff', mode: 'exact' }] } },
  { name: 'mid grey, exact', config: { seeds: [{ color: '#808080', mode: 'exact' }] } },
  { name: 'out of gamut input', config: { seeds: [{ color: 'oklch(0.85 0.35 145)' }] } },
  {
    name: 'two seeds',
    config: { seeds: [{ color: '#635bff' }, { color: '#f59e0b' }] },
  },
  {
    name: 'three families only',
    config: { seeds: [{ color: '#14b8a6' }], spectrum: { families: 3 } },
  },
  {
    name: 'sixteen families',
    config: { seeds: [{ color: '#3b82f6' }], spectrum: { families: 16 } },
  },
  {
    name: 'five steps, muted',
    config: {
      seeds: [{ color: '#14b8a6' }],
      ladder: { steps: 5 },
      chroma: { preset: 'muted' },
    },
  },
  {
    name: 'fifteen steps, vivid, drifted',
    config: {
      seeds: [{ color: '#e11d48' }],
      ladder: { steps: 15 },
      chroma: { preset: 'vivid' },
      hueDrift: -20,
    },
  },
]

/** Compact, reviewable form: the colours and the numbers that justify them. */
function summarize(config: PaletteConfig) {
  const palette = generatePalette(config)

  return {
    ramps: palette.ramps.map((ramp) => ({
      name: ramp.name,
      hue: ramp.hue === null ? null : Number(ramp.hue.toFixed(1)),
      hexes: ramp.swatches.map((s) => (s.isSeed ? `${s.hex} (seed)` : s.hex)),
      seed: ramp.seed
        ? {
            input: ramp.seed.input,
            mode: ramp.seed.mode,
            slot: ramp.seed.slotLabel,
            magnitude: ramp.seed.delta.magnitude,
          }
        : undefined,
      sharedLadder: ramp.report.usesSharedLadder,
      firstOnWhite: ramp.report.firstOnWhite,
      broken: ramp.report.brokenGuarantees.map((b) => `${b.label}: ${b.actual} < ${b.target}`),
    })),
    stepDistanceGuarantees: palette.sharedPairTable.map(
      (e) => `${e.distance}: ${e.minWcag.toFixed(2)}:1, Lc ${Math.round(e.minApcaLc)}`,
    ),
    roleHints: palette.roleHints.map((h) => `${h.role}: ${h.family}`),
    warnings: [...new Set(palette.warnings.map((w) => w.code))].sort(),
  }
}

describe('golden palettes', () => {
  it('records the algorithm version the snapshots belong to', () => {
    expect(ALGORITHM_VERSION).toMatchInlineSnapshot(`3`)
  })

  for (const { name, config } of CASES) {
    it(name, () => {
      expect(summarize(config)).toMatchSnapshot()
    })
  }
})
