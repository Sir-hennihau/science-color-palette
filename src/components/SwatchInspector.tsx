import { contractSurfaceName } from '../engine/index.ts'
import { usePaletteSession } from '../lib/palette-session.tsx'
import { copyText } from '../lib/browser.ts'
import { PairReadout, apcaDescription } from './ContrastPanel.tsx'

/**
 * Everything known about one shade.
 *
 * A panel rather than a popover: no focus trap to get wrong, and it stays open
 * while you click along a ramp comparing shades, which is how it actually gets
 * used.
 */
export function SwatchInspector({ onCopied }: { onCopied: (message: string) => void }) {
  const { palette, selected } = usePaletteSession()

  const ramp = palette.ramps.find((r) => r.role === selected.ramp) ?? palette.ramps[0]
  const swatch = ramp.swatches[selected.index] ?? ramp.swatches[0]

  return (
    <div className="flex flex-col">
      <div
        className="flex items-end p-4"
        style={{ backgroundColor: swatch.hex, color: swatch.onHex }}
      >
        <div>
          <div className="text-[13px] font-medium">
            {ramp.name} {swatch.label}
          </div>
          <button
            type="button"
            onClick={async () => {
              const ok = await copyText(swatch.hex)
              onCopied(ok ? `Copied ${swatch.hex}` : 'Could not reach the clipboard')
            }}
            className="tabular mt-0.5 text-[17px] font-medium tracking-tight underline decoration-1 underline-offset-2 opacity-90 hover:opacity-100"
            style={{ color: swatch.onHex }}
          >
            {swatch.hex}
          </button>
        </div>
      </div>

      <dl className="flex flex-col gap-0 px-4 py-3">
        <Row term="OKLCH">
          {(swatch.oklch.l * 100).toFixed(1)}% {swatch.oklch.c.toFixed(3)}{' '}
          {swatch.oklch.c === 0 ? '—' : `${swatch.oklch.h.toFixed(1)}°`}
        </Row>
        <Row term="RGB">
          {swatch.rgb.r} {swatch.rgb.g} {swatch.rgb.b}
        </Row>
        <Row term="Luminance">{swatch.wcag.y.toFixed(4)}</Row>
      </dl>

      <div className="px-4 pb-3">
        <h4 className="mb-1 text-[12px] font-medium">As text</h4>
        <ReadoutHeader />
        <PairReadout foreground={swatch.hex} background="#ffffff" label="on white" />
        <PairReadout foreground={swatch.hex} background="#000000" label="on black" />
        <PairReadout
          foreground={swatch.hex}
          background={ramp.swatches[0].hex}
          label={`on ${ramp.name} ${ramp.swatches[0].label}`}
        />
      </div>

      <div className="px-4 pb-3">
        <h4 className="mb-1 text-[12px] font-medium">As a background</h4>
        <ReadoutHeader />
        <PairReadout foreground="#000000" background={swatch.hex} label="black text" />
        <PairReadout foreground="#ffffff" background={swatch.hex} label="white text" />
        <p className="mt-1.5 text-[11px] text-ink-muted">
          Best with {swatch.onHex === '#000000' ? 'black' : 'white'} text, which is{' '}
          {apcaDescription(
            swatch.onHex === '#000000'
              ? swatch.apca.asBgWithBlackText
              : swatch.apca.asBgWithWhiteText,
          )}
          .
        </p>
      </div>

      {(swatch.isSeed || swatch.guarantees.length > 0 || swatch.gamutMapped) && (
        <div className="border-t border-line px-4 py-3 text-[11.5px] text-ink-muted">
          {swatch.isSeed && <p>This is your colour, unchanged.</p>}

          {swatch.guarantees.map((guarantee, i) => (
            <p key={i} className={guarantee.met ? '' : 'text-warn'}>
              {guarantee.met ? 'Meets' : 'Falls short of'} the {guarantee.target}:1 this position
              guarantees on {contractSurfaceName(guarantee.kind, ramp.swatches[0].label)} —
              measured <span className="tabular">{guarantee.actual.toFixed(2)}:1</span>.
            </p>
          ))}

          {swatch.gamutMapped && <p>Brought inside what a standard screen can show.</p>}
        </div>
      )}
    </div>
  )
}

/** Names the two numeric columns once, so the rows need no repeated units. */
function ReadoutHeader() {
  return (
    <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-2 pb-0.5 text-[10.5px] text-ink-faint">
      <span />
      <span>WCAG</span>
      <span>Lc</span>
      <span />
    </div>
  )
}

function Row({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line/60 py-1">
      <dt className="text-[12px] text-ink-muted">{term}</dt>
      <dd className="tabular text-[12px]">{children}</dd>
    </div>
  )
}
