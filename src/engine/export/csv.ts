/**
 * CSV.
 *
 * One row per swatch, for a spreadsheet rather than a build step: the whole
 * palette flattened so it can be sorted, filtered and charted. Every column is
 * a measurement the tool already made, so nothing here recomputes colour — it
 * only formats.
 *
 * `compact` drops the measurements and keeps the three columns needed to
 * identify a colour, which is the form to paste into a document.
 */

import type { Palette, Swatch } from '../types.ts'
import { slug } from './shared.ts'

export interface CsvOptions {
  /** Only family, shade and hex. */
  compact?: boolean
}

const FULL_COLUMNS = [
  'family',
  'shade',
  'hex',
  'is_seed',
  'oklch_l',
  'oklch_c',
  'oklch_h',
  'red',
  'green',
  'blue',
  'luminance',
  'contrast_on_white',
  'contrast_on_black',
  'text_colour',
  'apca_with_black_text',
  'apca_with_white_text',
] as const

const COMPACT_COLUMNS = ['family', 'shade', 'hex'] as const

export function exportCsv(palette: Palette, options: CsvOptions = {}): string {
  const columns = options.compact ? COMPACT_COLUMNS : FULL_COLUMNS
  const rows = [columns.join(',')]

  for (const ramp of palette.ramps) {
    const family = slug(ramp.name)
    for (const swatch of ramp.swatches) {
      rows.push(
        (options.compact ? compactRow(family, swatch) : fullRow(family, swatch))
          .map(cell)
          .join(','),
      )
    }
  }

  return rows.join('\n') + '\n'
}

function compactRow(family: string, swatch: Swatch): Array<string | number> {
  return [family, swatch.label, swatch.hex]
}

function fullRow(family: string, swatch: Swatch): Array<string | number> {
  return [
    family,
    swatch.label,
    swatch.hex,
    // Spreadsheets read a bare word more readily than true/false.
    swatch.isSeed ? 'yes' : 'no',
    round(swatch.oklch.l, 4),
    round(swatch.oklch.c, 4),
    // Hue carries no meaning without chroma, so a grey leaves the cell empty
    // rather than claiming an angle it does not have.
    swatch.oklch.c === 0 ? '' : round(swatch.oklch.h, 2),
    swatch.rgb.r,
    swatch.rgb.g,
    swatch.rgb.b,
    round(swatch.wcag.y, 4),
    round(swatch.wcag.onWhite, 2),
    round(swatch.wcag.onBlack, 2),
    // The demonstrable choice rather than the perceptual one: a spreadsheet is
    // where someone goes to evidence a decision.
    swatch.onHexWcag,
    round(swatch.apca.asBgWithBlackText, 1),
    round(swatch.apca.asBgWithWhiteText, 1),
  ]
}

/**
 * Quote a value only when it would otherwise break the row.
 *
 * Family names are slugged and every other column is a number or a hex, so in
 * practice nothing needs quoting — but a name is user-supplied by way of the
 * seed overrides, and a stray comma silently shifting every later column is
 * the classic way a CSV export goes wrong.
 */
function cell(value: string | number): string {
  const text = String(value)
  if (!/[",\r\n]/.test(text)) return text
  return `"${text.replace(/"/g, '""')}"`
}

function round(value: number, places: number): number {
  const factor = 10 ** places
  // Adding zero turns a rounded -0 back into 0, which is how JSON writes it and
  // therefore what the rest of the engine's output already promises.
  return Math.round(value * factor) / factor + 0
}
