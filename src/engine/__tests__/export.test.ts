import { describe, expect, it } from 'vitest'

import { generatePalette } from '../palette.ts'
import { EXPORT_FORMATS, exportPalette } from '../export/index.ts'
import { exportCss } from '../export/css.ts'
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
    expect(beforeSupports).toMatch(/--color-primary-600: #[0-9a-f]{6};/)
  })

  it('emits a single format on request', () => {
    expect(exportCss(palette, { mode: 'hex' })).not.toContain('@supports')
    expect(exportCss(palette, { mode: 'oklch' })).not.toContain('@supports')
    expect(exportCss(palette, { mode: 'oklch' })).toContain('oklch(')
  })

  it('honours the selector and prefix', () => {
    const css = exportCss(palette, { selector: '.theme-dark', prefix: 'brand' })
    expect(css).toContain('.theme-dark {')
    expect(css).toContain('--brand-primary-600:')
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
    expect(css).toContain('--color-primary-600:')
    expect(css).toContain('oklch(')
  })

  it('can emit hex instead', () => {
    const css = exportTailwindTheme(palette, { mode: 'hex' })
    expect(css).not.toContain('oklch(')
    expect(css).toMatch(/--color-primary-600: #[0-9a-f]{6};/)
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
    expect(Object.keys(compact)).toContain('primary')
    expect(compact.primary['600']).toMatch(/^#[0-9a-f]{6}$/)
    expect(Object.keys(compact.primary)).toHaveLength(11)
  })
})

describe('design token export', () => {
  it('nests tokens by ramp and shade', () => {
    const tokens = exportDtcg(palette) as any
    expect(tokens.color.primary.$type).toBe('color')
    expect(tokens.color.primary['600'].$value.hex).toMatch(/^#[0-9a-f]{6}$/)
    expect(tokens.color.primary['600'].$value.colorSpace).toBe('srgb')
    expect(tokens.color.primary['600'].$value.components).toHaveLength(3)
  })

  it('carries the contrast measurements alongside each colour', () => {
    const tokens = exportDtcg(palette) as any
    const ext = tokens.color.info['600'].$extensions['dev.sciencecolorpalette']

    expect(ext.oklch).toHaveLength(3)
    expect(ext.wcag.onWhite).toBeGreaterThan(4.5)
    expect(ext.relativeLuminance).toBeGreaterThan(0)
    expect(['#000000', '#ffffff']).toContain(ext.onColor)
    expect(ext.guarantees[0].met).toBe(true)
  })

  it('can emit the legacy hex string form', () => {
    const tokens = exportDtcg(palette, { legacyHexValue: true }) as any
    expect(tokens.color.primary['600'].$value).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('explains a ramp that broke its contrast promise', () => {
    const grey = generatePalette({ seeds: [{ color: '#808080', mode: 'exact' }] })
    const tokens = exportDtcg(grey) as any
    expect(tokens.color.primary.$description).toMatch(/below the usual contrast/)
  })

  it('is serialisable', () => {
    expect(() => JSON.stringify(exportDtcg(palette))).not.toThrow()
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
      harmony: { include: ['split-complementary'] },
    })
    const css = exportCss(named)

    expect(css).toContain('--color-brand-primary-600:')
    expect(css).toMatch(/--color-split-complementary-[12]-600:/)
    // No stray characters that would break a declaration.
    for (const name of [...css.matchAll(/--([a-z0-9-]+):/g)].map((m) => m[1])) {
      expect(name).toMatch(/^[a-z0-9-]+$/)
    }
  })
})
