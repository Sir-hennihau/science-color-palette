import { describe, expect, it } from 'vitest'

import { generatePalette } from '../palette.ts'
import { clearEnvelopeCache } from '../color/envelope.ts'
import { exportPalette } from '../export/index.ts'
import type { PaletteConfig } from '../types.ts'

/**
 * The interactive budget.
 *
 * A palette is regenerated on every slider movement, so a warm generation has
 * to stay well inside a frame. Sampling each hue's chroma envelope is the
 * expensive part and is cached across regenerations, which is why the first
 * generation costs more than every one after it.
 *
 * Budgets are deliberately loose — this exists to catch an order-of-magnitude
 * regression, not to police a few percent on a noisy machine.
 */

const CONFIG: PaletteConfig = {
  seeds: [{ color: '#635bff' }, { color: '#f59e0b' }],
}

/** Median milliseconds per call, which shrugs off scheduling noise. */
function medianMs(runs: number, fn: () => void): number {
  const samples: number[] = []
  for (let i = 0; i < runs; i++) {
    const start = performance.now()
    fn()
    samples.push(performance.now() - start)
  }
  samples.sort((a, b) => a - b)
  return samples[Math.floor(samples.length / 2)]
}

describe('generation speed', () => {
  it('regenerates well inside a frame once hues are cached', () => {
    generatePalette(CONFIG)
    const median = medianMs(30, () => generatePalette(CONFIG))
    expect(median, `median ${median.toFixed(2)}ms`).toBeLessThan(16)
  })

  it('stays responsive even on a cold cache', () => {
    const median = medianMs(10, () => {
      clearEnvelopeCache()
      generatePalette(CONFIG)
    })
    expect(median, `median ${median.toFixed(2)}ms`).toBeLessThan(250)
  })

  it('handles the largest palette it offers', () => {
    const big: PaletteConfig = {
      seeds: [
        { color: '#635bff' },
        { color: '#f59e0b' },
        { color: '#10b981' },
        { color: '#ef4444' },
        { color: '#8b5cf6' },
      ],
      ladder: { steps: 15 },
      spectrum: { families: 16 },
    }

    generatePalette(big)
    const median = medianMs(20, () => generatePalette(big))
    expect(median, `median ${median.toFixed(2)}ms`).toBeLessThan(50)
  })

  it('exports without a stall', () => {
    const palette = generatePalette(CONFIG)
    for (const format of ['css', 'tailwind', 'json', 'dtcg'] as const) {
      const median = medianMs(20, () => exportPalette(palette, format))
      expect(median, `${format} median ${median.toFixed(2)}ms`).toBeLessThan(30)
    }
  })
})
