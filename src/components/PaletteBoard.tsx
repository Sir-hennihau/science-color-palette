import { usePaletteSession } from '../lib/palette-session.tsx'
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
export function PaletteBoard() {
  const { palette } = usePaletteSession()

  const seedRamps = palette.ramps.filter((r) => r.seed)
  const accentRamps = palette.ramps.filter((r) => r.role.startsWith('accent-'))
  const neutralRamps = palette.ramps.filter((r) => r.role === 'neutral')
  const semanticRamps = palette.ramps.filter((r) =>
    ['success', 'warning', 'danger', 'info'].includes(r.role),
  )

  return (
    <div className="flex flex-col gap-9">
      <RampGroup ramps={seedRamps} />
      {accentRamps.length > 0 && <RampGroup ramps={accentRamps} heading="Harmony" />}
      {neutralRamps.length > 0 && <RampGroup ramps={neutralRamps} heading="Neutrals" />}
      {semanticRamps.length > 0 && <RampGroup ramps={semanticRamps} heading="Semantic" />}
    </div>
  )
}

function RampGroup({ ramps, heading }: { ramps: Ramp[]; heading?: string }) {
  if (ramps.length === 0) return null

  return (
    <section className="flex flex-col gap-4">
      {heading && (
        <h2 className="text-[13px] font-medium text-ink-muted border-b border-line pb-1.5">
          {heading}
        </h2>
      )}
      {ramps.map((ramp) => (
        <RampRow key={ramp.role} ramp={ramp} />
      ))}
    </section>
  )
}

function RampRow({ ramp }: { ramp: Ramp }) {
  const { select, selected } = usePaletteSession()
  const broken = ramp.report.brokenGuarantees.length > 0

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline gap-2.5 flex-wrap">
        <h3 className="text-[15px] font-medium">{ramp.name}</h3>

        {ramp.hue !== null && (
          <span className="tabular text-[11px] text-ink-faint">{ramp.hue.toFixed(0)}°</span>
        )}

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
            onSelect={() => select({ ramp: ramp.role, index: swatch.index })}
          />
        ))}
      </div>
    </div>
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
      }${failed ? ', below the usual contrast for this position' : ''}`}
      className="group relative flex h-16 flex-col justify-between p-1 text-left transition-transform hover:z-10 hover:scale-[1.04] sm:h-20 sm:p-1.5"
      style={{ backgroundColor: swatch.hex, color: swatch.onHex }}
    >
      <span className="tabular text-[10px] font-medium leading-none opacity-80">
        {swatch.label}
      </span>

      <span className="flex items-center justify-between gap-0.5">
        <span className="tabular hidden text-[9.5px] leading-none opacity-70 sm:inline">
          {swatch.hex.slice(1)}
        </span>
        {failed && <WarningMark />}
      </span>

      {swatch.isSeed && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 border-2"
          style={{ borderColor: swatch.onHex }}
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
