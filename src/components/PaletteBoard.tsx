import { WarningMark } from './StatusMarks.tsx'
import { usePaletteSession } from '../lib/palette-session.tsx'
import { copyText } from '../lib/browser.ts'
import { WCAG_THRESHOLDS, type Ramp, type ResolvedLadder, type Swatch } from '../engine/index.ts'

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
      <ContractLegend ladder={palette.resolved.ladder} />
      <RampGroup ramps={families} onCopied={onCopied} />
      {neutrals.length > 0 && (
        <RampGroup ramps={neutrals} heading="Greys" onCopied={onCopied} />
      )}
    </div>
  )
}

/**
 * Which columns carry a promise, marked on the board itself.
 *
 * The most useful thing this tool knows is "which shade is safe for body text",
 * and it used to be a table two screens further down. Because every ramp climbs
 * the same scale, the answer is a *column* rather than a colour — so one legend
 * above the board marks it for every family at once, and the shade numbers stop
 * being arbitrary the moment you see which three are load-bearing.
 *
 * Driven from the ladder's own contracts, so a step count where none of them
 * land on a shade correctly shows nothing rather than a comfortable fiction.
 */
function ContractLegend({ ladder }: { ladder: ResolvedLadder }) {
  const contracts = new Map(ladder.contracts.map((contract) => [contract.index, contract]))
  if (contracts.size === 0) return null

  const sentence = ladder.contracts
    .map((contract) => `${ladder.labels[contract.index]} ${useFor(contract.target)}`)
    .join(' · ')

  return (
    <div>
      {/* Narrow screens cannot fit a caption under a column, so the same fact
          is stated as a sentence — and it carries the accessible name at every
          width, since a grid of loose words reads poorly aloud. */}
      <p className="border-b border-line pb-2 text-[12px] text-ink-muted sm:sr-only">
        <span className="text-ink">Guaranteed on white and on shade {ladder.labels[0]}:</span>{' '}
        <span className="tabular">{sentence}</span>
      </p>

      <div
        aria-hidden="true"
        className="hidden grid-cols-[repeat(var(--steps),minmax(0,1fr))] gap-px border-b border-line pb-1.5 sm:grid"
        style={{ ['--steps' as string]: ladder.steps }}
      >
        {/* Only the marked columns carry anything. Every swatch prints its own
            shade number a few pixels below, so repeating all eleven here would
            be a ruler nobody needs beside a ruler they already have. */}
        {ladder.labels.map((label, index) => {
          const contract = contracts.get(index)
          if (!contract) return <div key={label} />

          return (
            <div key={label} className="flex flex-col gap-1">
              <span className="tabular text-[10px] font-medium leading-none">{label}</span>
              <span className="h-0.5 w-full bg-ink" />
              <span className="text-[10px] leading-tight text-ink-muted">
                {useFor(contract.target)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** What a contract ratio is good for, in the fewest words that stay true. */
function useFor(target: number): string {
  if (target >= WCAG_THRESHOLDS.aaa) return 'body AAA'
  if (target >= WCAG_THRESHOLDS.aa) return 'body text'
  return 'large text'
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

