import { describe, expect, it } from 'vitest'

import { generatePalette } from '../palette.ts'
import { EXPORT_FORMATS, exportPalette } from '../export/index.ts'
import { exportCss } from '../export/css.ts'
import { exportCsv } from '../export/csv.ts'
import { exportDtcg } from '../export/dtcg.ts'
import { exportJson } from '../export/json.ts'
import { exportTailwindTheme } from '../export/tailwind.ts'
import { parseColor } from '../color/space.ts'

const palette = generatePalette({
  seeds: [{ color: '#635bff', mode: 'exact' }, { color: '#f59e0b' }],
})

describe('CSS export', () => {
  it('emits a custom property per swatch', () => {
    const css = exportCss(palette)
    for (const ramp of palette.ramps) {
      for (const swatch of ramp.swatches) {
        expect(css).toContain(`--color-${ramp.name}-${swatch.label}:`)
      }
    }
  })

  it('gates the OKLCH upgrade behind @supports rather than shadowing', () => {
    // Declaring a custom property twice does not fall back: an old browser
    // keeps the oklch() value it cannot use and every var() referencing it
    // fails. The @supports block is what actually degrades safely.
    const css = exportCss(palette)
    expect(css).toContain('@supports (color: oklch(50% 0 0))')

    const beforeSupports = css.slice(0, css.indexOf('@supports'))
    expect(beforeSupports).not.toContain('oklch(')
    expect(beforeSupports).toMatch(/--color-[a-z-]+-600: #[0-9a-f]{6};/)
  })

  it('emits a single format on request', () => {
    expect(exportCss(palette, { mode: 'hex' })).not.toContain('@supports')
    expect(exportCss(palette, { mode: 'oklch' })).not.toContain('@supports')
    expect(exportCss(palette, { mode: 'oklch' })).toContain('oklch(')
  })

  it('honours the selector and prefix', () => {
    const css = exportCss(palette, { selector: '.theme-dark', prefix: 'brand' })
    expect(css).toContain('.theme-dark {')
    expect(css).toContain(`--brand-${palette.ramps[0].name}-600:`)
  })

  it('states the step-distance guarantees up front', () => {
    const css = exportCss(palette)
    expect(css).toMatch(/steps apart or more: at least 4\.5:1/)
  })

  it('marks the shade the user pinned', () => {
    expect(exportCss(palette)).toContain('your colour, unchanged')
  })

  it('notes when a ramp left the shared scale', () => {
    expect(exportCss(palette)).toContain('own lightness scale')
  })

  it('produces values a CSS colour parser accepts', () => {
    const css = exportCss(palette, { mode: 'oklch' })
    const values = [...css.matchAll(/: (oklch\([^)]*\));/g)].map((m) => m[1])

    expect(values.length).toBeGreaterThan(50)
    for (const value of values) {
      expect(parseColor(value), value).not.toBeNull()
    }
  })

  it('round-trips OKLCH values back to the same colour', () => {
    const css = exportCss(palette, { mode: 'oklch' })
    const pairs = [...css.matchAll(/--color-(\S+)-(\d+): (oklch\([^)]*\));/g)]

    for (const [, name, label, value] of pairs.slice(0, 40)) {
      const ramp = palette.ramps.find((r) => r.name === name)!
      const swatch = ramp.swatches.find((s) => s.label === Number(label))!
      // Rounding in the printed value may move the result by one code value.
      const parsed = parseColor(value)!
      const distance = channelDistance(parsed.hex, swatch.hex)
      expect(distance, `${name}-${label}: ${value} vs ${swatch.hex}`).toBeLessThanOrEqual(1)
    }
  })
})

function channelDistance(a: string, b: string): number {
  let worst = 0
  for (let i = 1; i < 7; i += 2) {
    worst = Math.max(
      worst,
      Math.abs(parseInt(a.slice(i, i + 2), 16) - parseInt(b.slice(i, i + 2), 16)),
    )
  }
  return worst
}

describe('Tailwind export', () => {
  it('emits a theme block in the colour namespace', () => {
    const css = exportTailwindTheme(palette)
    expect(css).toContain('@theme {')
    expect(css).toContain(`--color-${palette.ramps[0].name}-600:`)
    expect(css).toContain('oklch(')
  })

  it('can emit hex instead', () => {
    const css = exportTailwindTheme(palette, { mode: 'hex' })
    expect(css).not.toContain('oklch(')
    expect(css).toMatch(/--color-[a-z-]+-600: #[0-9a-f]{6};/)
  })
})

describe('JSON export', () => {
  it('returns the whole palette by default', () => {
    expect(exportJson(palette)).toBe(palette)
  })

  it('reduces to names and hex values when compact', () => {
    const compact = exportJson(palette, { compact: true }) as Record<
      string,
      Record<string, string>
    >
    const first = Object.keys(compact)[0]
    expect(compact[first]['600']).toMatch(/^#[0-9a-f]{6}$/)
    expect(Object.keys(compact[first])).toHaveLength(11)
    expect(Object.keys(compact)).toContain('neutral')
  })
})

describe('design token export', () => {
  it('nests tokens by ramp and shade', () => {
    const tokens = exportDtcg(palette) as any
    const first = palette.ramps[0].name
    expect(tokens.color[first].$type).toBe('color')
    expect(tokens.color[first]['600'].$value.hex).toMatch(/^#[0-9a-f]{6}$/)
    expect(tokens.color[first]['600'].$value.colorSpace).toBe('srgb')
    expect(tokens.color[first]['600'].$value.components).toHaveLength(3)
  })

  it('carries the contrast measurements alongside each colour', () => {
    const tokens = exportDtcg(palette) as any
    const family = Object.keys(tokens.color)[1]
    const ext = tokens.color[family]['600'].$extensions['dev.sciencecolorpalette']

    expect(ext.oklch).toHaveLength(3)
    expect(ext.wcag.onWhite).toBeGreaterThan(4.5)
    expect(ext.relativeLuminance).toBeGreaterThan(0)
    expect(['#000000', '#ffffff']).toContain(ext.onColor)
    expect(ext.guarantees[0].met).toBe(true)
  })

  it('can emit the legacy hex string form', () => {
    const tokens = exportDtcg(palette, { legacyHexValue: true }) as any
    expect(tokens.color[palette.ramps[0].name]['600'].$value).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('explains a ramp that broke its contrast promise', () => {
    const grey = generatePalette({ seeds: [{ color: '#808080', mode: 'exact' }] })
    const tokens = exportDtcg(grey) as any
    const seeded = grey.ramps.find((r) => r.seed)!
    expect(tokens.color[seeded.name].$description).toMatch(/below the usual contrast/)
  })

  it('is serialisable', () => {
    expect(() => JSON.stringify(exportDtcg(palette))).not.toThrow()
  })
})

describe('CSV export', () => {
  const rows = () => exportCsv(palette).trimEnd().split('\n')

  it('emits a header and one row per swatch', () => {
    const swatches = palette.ramps.reduce((n, ramp) => n + ramp.swatches.length, 0)
    expect(rows()).toHaveLength(swatches + 1)
  })

  it('gives every row the same number of columns as the header', () => {
    const all = rows()
    const width = all[0].split(',').length
    for (const row of all.slice(1)) {
      expect(row.split(',').length, row).toBe(width)
    }
  })

  it('carries the measurements, not just the colours', () => {
    const [header] = rows()
    for (const column of ['hex', 'luminance', 'contrast_on_white', 'apca_with_black_text']) {
      expect(header).toContain(column)
    }
  })

  it('reports the same hex the palette shipped', () => {
    const seeded = palette.ramps.find((r) => r.seed)!
    const swatch = seeded.swatches[0]
    const row = rows().find((r) => r.startsWith(`${seeded.name},${swatch.label},`))
    expect(row).toBeDefined()
    expect(row).toContain(swatch.hex)
  })

  it('leaves the hue cell empty for a pure grey rather than inventing an angle', () => {
    // The default neutrals are tinted, so they do carry a hue. Only an
    // untinted ramp has no angle to report, which is the case worth pinning.
    const untinted = generatePalette({
      seeds: [{ color: '#635bff' }],
      neutrals: { tintStrength: 0 },
    })
    const grey = untinted.ramps.find((r) => r.swatches.every((sw) => sw.oklch.c === 0))
    expect(grey, 'expected an achromatic ramp at zero tint').toBeDefined()

    const lines = exportCsv(untinted).trimEnd().split('\n')
    const hue = lines[0].split(',').indexOf('oklch_h')
    const greyRows = lines.filter((r) => r.startsWith(`${grey!.name},`))
    expect(greyRows.length).toBeGreaterThan(0)
    for (const row of greyRows) {
      expect(row.split(',')[hue], row).toBe('')
    }
  })

  it('keeps the columns aligned when a ramp name contains a comma', () => {
    // Slugging is what actually disarms the comma; the quoting in the exporter
    // is the belt to that pair of braces. Either way the row must not shift.
    const awkward = generatePalette({ seeds: [{ color: '#635bff', name: 'Brand, primary' }] })
    const lines = exportCsv(awkward).trimEnd().split('\n')
    const width = lines[0].split(',').length
    for (const row of lines.slice(1)) {
      expect(row.split(',').length, row).toBe(width)
    }
    expect(lines.some((r) => r.startsWith('brand-primary,'))).toBe(true)
  })

  it('compact keeps only what identifies a colour', () => {
    const compact = exportCsv(palette, { compact: true })
    expect(compact.split('\n')[0]).toBe('family,shade,hex')
    expect(compact).not.toContain('luminance')
  })
})

describe('the export registry', () => {
  it('renders every advertised format to a non-empty string', () => {
    for (const descriptor of EXPORT_FORMATS) {
      const output = exportPalette(palette, descriptor.format)
      expect(output.length, descriptor.format).toBeGreaterThan(100)
      expect(output.endsWith('\n'), descriptor.format).toBe(true)
    }
  })

  it('emits valid JSON for the JSON formats', () => {
    for (const format of ['json', 'dtcg'] as const) {
      expect(() => JSON.parse(exportPalette(palette, format)), format).not.toThrow()
    }
  })

  it('gives every format a distinct filename', () => {
    const filenames = EXPORT_FORMATS.map((d) => d.filename)
    expect(new Set(filenames).size).toBe(filenames.length)
  })
})

describe('token naming', () => {
  it('makes safe identifiers from awkward ramp names', () => {
    const named = generatePalette({
      seeds: [{ color: '#635bff', name: 'Brand Primary!' }],
    })
    const css = exportCss(named)

    expect(css).toContain('--color-brand-primary-600:')
    // No stray characters that would break a declaration.
    for (const name of [...css.matchAll(/--([a-z0-9-]+):/g)].map((m) => m[1])) {
      expect(name).toMatch(/^[a-z0-9-]+$/)
    }
  })
})
