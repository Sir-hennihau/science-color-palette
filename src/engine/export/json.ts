/**
 * Plain JSON.
 *
 * The full palette, including every contrast measurement — the machine-readable
 * form of everything the tool worked out. `compact` trims it to names and hex
 * values for when all that is wanted is the colours.
 */

import type { Palette } from '../types.ts'
import { slug } from './shared.ts'

export interface JsonOptions {
  compact?: boolean
}

export function exportJson(palette: Palette, options: JsonOptions = {}): unknown {
  if (!options.compact) return palette

  const colors: Record<string, Record<string, string>> = {}

  for (const ramp of palette.ramps) {
    const shades: Record<string, string> = {}
    for (const swatch of ramp.swatches) {
      shades[String(swatch.label)] = swatch.hex
    }
    colors[slug(ramp.name)] = shades
  }

  return colors
}
