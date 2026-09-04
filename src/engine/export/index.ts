/**
 * Export formats.
 */

import type { Palette } from '../types.ts'
import { exportCss, type CssOptions } from './css.ts'
import { exportCsv, type CsvOptions } from './csv.ts'
import { exportDtcg, type DtcgOptions } from './dtcg.ts'
import { exportJson, type JsonOptions } from './json.ts'
import { exportTailwindTheme, type TailwindOptions } from './tailwind.ts'

export { exportCss, exportCsv, exportDtcg, exportJson, exportTailwindTheme }
export type { CssOptions, CsvOptions, DtcgOptions, JsonOptions, TailwindOptions }

export type ExportFormat = 'css' | 'tailwind' | 'json' | 'dtcg' | 'csv'

export interface ExportDescriptor {
  format: ExportFormat
  /** Label for the UI tab. */
  title: string
  /** One line on what this is for. */
  description: string
  filename: string
  mimeType: string
  /** Syntax hint for a code block. */
  language: 'css' | 'json' | 'csv'
}

export const EXPORT_FORMATS: readonly ExportDescriptor[] = [
  {
    format: 'css',
    title: 'CSS variables',
    description: 'Custom properties for any stylesheet, with an OKLCH upgrade where supported.',
    filename: 'palette.css',
    mimeType: 'text/css',
    language: 'css',
  },
  {
    format: 'tailwind',
    title: 'Tailwind v4',
    description: 'A @theme block, so every colour utility follows from the palette.',
    filename: 'palette.tailwind.css',
    mimeType: 'text/css',
    language: 'css',
  },
  {
    format: 'json',
    title: 'JSON',
    description: 'Names and hex values, ready to read from a build script.',
    filename: 'palette.json',
    mimeType: 'application/json',
    language: 'json',
  },
  {
    format: 'dtcg',
    title: 'Design tokens',
    description: 'W3C format, carrying the contrast measurements alongside each colour.',
    filename: 'palette.tokens.json',
    mimeType: 'application/json',
    language: 'json',
  },
  {
    format: 'csv',
    title: 'CSV',
    description: 'One row per shade with every measurement, for a spreadsheet.',
    filename: 'palette.csv',
    mimeType: 'text/csv',
    language: 'csv',
  },
]

/** Render a palette in one of the supported formats. */
export function exportPalette(palette: Palette, format: ExportFormat): string {
  switch (format) {
    case 'css':
      return exportCss(palette)
    case 'tailwind':
      return exportTailwindTheme(palette)
    case 'json':
      return JSON.stringify(exportJson(palette, { compact: true }), null, 2) + '\n'
    case 'dtcg':
      return JSON.stringify(exportDtcg(palette), null, 2) + '\n'
    case 'csv':
      return exportCsv(palette)
  }
}
