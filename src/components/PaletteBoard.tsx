import { usePaletteSession } from '../lib/palette-session.tsx'
import { copyText } from '../lib/browser.ts'
import type { Ramp, Swatch } from '../engine/index.ts'

/**
 * The palette itself, and the first thing on screen.
 *
 * Swatches carry their own label and hex in whichever of black or white the
 * engine judged more legible on them, so the grid reads as colour rather than
 * as a table of colour. Structural marks are reserved for real information: a
 * ring means the shade is the user's own colour, kept exactly, and a warning
 * mark means the shade falls short of the contrast its position implies.
 */
export function PaletteBoard({ onCopied }: { onCopied: (message: string) => void }) {
  const { palette } = usePaletteSession()

  // The spectrum reads as one progression, so it is presented as one list in
  // the order the engine walked the wheel: the colours that were typed first,
  // then round the circle from there. Greys sit apart because they are the
  // palette's foundation rather than a point on that circle.
  const families = palette.ramps.filter((r) => r.role !== 'neutral')
  const neutrals = palette.ramps.filter((r) => r.role === 'neutral')

  return (
    <div className="flex flex-col gap-8">
      <RampGroup ramps={families} onCopied={onCopied} />
      {neutrals.length > 0 && (
        <RampGroup ramps={neutrals} heading="Greys" onCopied={onCopied} />
      )}
    </div>
  )
}

function RampGroup({
  ramps,
  heading,
  onCopied,
}: {
  ramps: Ramp[]
  heading?: string
  onCopied: (message: string) => void
}) {
  if (ramps.length === 0) return null

  return (
    <section className="flex flex-col gap-4">
      {heading && (
        <h2 className="text-[13px] font-medium text-ink-muted border-b border-line pb-1.5">
          {heading}
        </h2>
      )}
      {ramps.map((ramp) => (
        <RampRow key={ramp.role} ramp={ramp} onCopied={onCopied} />
      ))}
    </section>
  )
}

function RampRow({ ramp, onCopied }: { ramp: Ramp; onCopied: (message: string) => void }) {
  const { select, selected } = usePaletteSession()
  const broken = ramp.report.brokenGuarantees.length > 0

  return (
    <div className="flex flex-col gap-1.5" data-ramp={ramp.name}>
      <div className="flex items-baseline gap-2.5 flex-wrap">
        <h3 className="text-[15px] font-medium">{ramp.name}</h3>

        {ramp.hue !== null && (
          <span className="tabular text-[11px] text-ink-faint">{ramp.hue.toFixed(0)}°</span>
        )}

        {ramp.seed && <YoursBadge />}
        {ramp.seed && <SeedNote ramp={ramp} />}

        {!ramp.report.usesSharedLadder && (
          <span className="text-[11px] text-ink-faint">own lightness scale</span>
        )}

        {broken && (
          <span className="text-[11px] text-warn inline-flex items-center gap-1">
            <WarningMark />
            {ramp.report.brokenGuarantees.map((b) => b.label).join(', ')} below usual contrast
          </span>
        )}
      </div>

      <div
        className="grid gap-px"
        style={{ gridTemplateColumns: `repeat(${ramp.swatches.length}, minmax(0, 1fr))` }}
      >
        {ramp.swatches.map((swatch) => (
          <SwatchButton
            key={swatch.index}
            ramp={ramp}
            swatch={swatch}
            isSelected={selected.ramp === ramp.role && selected.index === swatch.index}
            onSelect={async () => {
              select({ ramp: ramp.role, index: swatch.index })
              const ok = await copyText(swatch.hex)
              onCopied(ok ? `Copied ${swatch.hex}` : `Selected ${swatch.hex}`)
            }}
          />
        ))}
      </div>
    </div>
  )
}

/** Marks a family that came from a colour the user supplied. */
function YoursBadge() {
  return (
    <span className="border border-ink px-1 py-px text-[10px] font-medium leading-none">
      yours
    </span>
  )
}

function SeedNote({ ramp }: { ramp: Ramp }) {
  const seed = ramp.seed!

  if (seed.mode === 'exact') {
    return (
      <span className="text-[11px] text-ink-muted">
        <span className="tabular">{seed.input}</span> kept exactly at {seed.slotLabel}
      </span>
    )
  }

  const moved = seed.delta.magnitude !== 'none' && seed.delta.magnitude !== 'subtle'

  return (
    <span className="text-[11px] text-ink-muted">
      <span className="tabular">{seed.input}</span>
      {moved ? ` adjusted at ${seed.slotLabel}` : ` matched at ${seed.slotLabel}`}
    </span>
  )
}

/**
 * Labels are drawn in `onHexWcag` rather than the perceptually preferred
 * `onHex`. At 10px this is the right call: WCAG's caution about text on
 * mid-tones is warranted at that size, and it keeps the tool's own interface
 * conformant with the standard it reports against.
 */
function SwatchButton({
  ramp,
  swatch,
  isSelected,
  onSelect,
}: {
  ramp: Ramp
  swatch: Swatch
  isSelected: boolean
  onSelect: () => void
}) {
  const failed = swatch.guarantees.some((g) => !g.met)

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isSelected}
      aria-label={`${ramp.name} ${swatch.label}, ${swatch.hex}${
        swatch.isSeed ? ', your colour kept exactly' : ''
      }${failed ? ', below the usual contrast for this position' : ''}. Copies on click.`}
      className="group relative flex h-16 flex-col justify-between p-1 text-left transition-transform hover:z-10 hover:scale-[1.04] sm:h-20 sm:p-1.5"
      style={{ backgroundColor: swatch.hex, color: swatch.onHexWcag }}
    >
      <span className="tabular text-[10px] font-medium leading-none">{swatch.label}</span>

      <span className="flex items-center justify-between gap-0.5">
        <span className="tabular hidden text-[9.5px] leading-none sm:inline">
          {swatch.hex.slice(1)}
        </span>
        {failed && <WarningMark />}
      </span>

      {swatch.isSeed && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 border-2"
          style={{ borderColor: swatch.onHexWcag }}
        />
      )}

      {isSelected && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 outline-2 outline-offset-2 outline-ink"
        />
      )}
    </button>
  )
}

function WarningMark() {
  return (
    <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 shrink-0" aria-hidden="true">
      <path d="M6 1 11.2 10.5H0.8z" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M6 4.4v2.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="6" cy="8.7" r="0.7" fill="currentColor" />
    </svg>
  )
}
