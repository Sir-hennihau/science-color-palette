import { useEffect, useRef, useState } from 'react'
import { HexColorPicker } from 'react-colorful'

import { usePaletteSession } from '../lib/palette-session.tsx'
import { pickScreenColor, supportsEyeDropper } from '../lib/browser.ts'
import {
  MAX_FAMILIES,
  MAX_HUE_DRIFT,
  MAX_SEEDS,
  MAX_STEPS,
  MIN_FAMILIES,
  MIN_STEPS,
  parseColor,
  wcagContrastHex,
} from '../engine/index.ts'

/**
 * Every input, in one band across the top.
 *
 * The colours come first and get the most room, because they are the only thing
 * a person has to supply; the rest are adjustments to what the colours already
 * produced. Keeping them all above the palette means nothing that shapes the
 * result is hidden below the fold or off to one side.
 */
export function Controls() {
  const { config, seeds, commit, preview, addSeed } = usePaletteSession()

  return (
    <div className="flex flex-col gap-y-4 border-b border-line px-4 py-3.5 lg:flex-row lg:items-start lg:gap-x-6 lg:px-5">
      <Group label="Your colours" lead="Start here:" className="lg:w-[19rem] lg:shrink-0">
        <div className="flex flex-col gap-1.5">
          {seeds.map((seed, index) => (
            <SeedControl key={index} index={index} hex={seed.hex} mode={seed.mode} />
          ))}
          {seeds.length < MAX_SEEDS && (
            <button
              type="button"
              onClick={addSeed}
              className="mt-0.5 flex h-8 items-center justify-center gap-1.5 border border-line-strong text-[12px] font-medium hover:bg-sunken"
            >
              <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" aria-hidden="true">
                <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.6" />
              </svg>
              Add a colour
            </button>
          )}
        </div>
      </Group>

      <div className="flex flex-1 flex-wrap gap-x-6 gap-y-4">
        <Group label="Families" value={String(config.families)} className="min-w-[8.5rem] flex-1">
          <input
            type="range"
            min={MIN_FAMILIES}
            max={MAX_FAMILIES}
            step={1}
            value={config.families}
            aria-label="Number of colour families"
            aria-valuetext={`${config.families} families`}
            onChange={(e) => preview({ families: Number(e.target.value) })}
            onPointerUp={() => commit()}
            onKeyUp={() => commit()}
          />
          <Hint>Colours spread around the wheel from yours.</Hint>
        </Group>

        <Group label="Shades" value={String(config.steps)} className="min-w-[8.5rem] flex-1">
          <input
            type="range"
            min={MIN_STEPS}
            max={MAX_STEPS}
            step={1}
            value={config.steps}
            aria-label="Number of shades per family"
            aria-valuetext={`${config.steps} shades`}
            onChange={(e) => preview({ steps: Number(e.target.value) })}
            onPointerUp={() => commit()}
            onKeyUp={() => commit()}
          />
          <Hint>Steps per family, on one shared lightness scale.</Hint>
        </Group>

        <Group label="Colourfulness" className="min-w-[11rem] flex-1">
          <Segmented
            label="Colourfulness"
            value={config.chroma}
            onChange={(chroma) => commit({ chroma: chroma as typeof config.chroma })}
            options={[
              { value: 'muted', label: 'Muted' },
              { value: 'natural', label: 'Natural' },
              { value: 'vivid', label: 'Vivid' },
            ]}
          />
          <Hint>A share of what each hue can actually reach.</Hint>
        </Group>

        <Group
          label="Hue drift"
          value={`${config.drift > 0 ? '+' : ''}${config.drift}°`}
          className="min-w-[8.5rem] flex-1"
        >
          <input
            type="range"
            min={-MAX_HUE_DRIFT}
            max={MAX_HUE_DRIFT}
            step={1}
            value={config.drift}
            aria-label="Hue drift across each ramp, in degrees"
            aria-valuetext={`${config.drift} degrees`}
            onChange={(e) => preview({ drift: Number(e.target.value) })}
            onPointerUp={() => commit()}
            onKeyUp={() => commit()}
          />
          <Hint>Turns dark yellows brown rather than olive.</Hint>
        </Group>

        <Group
          label="Grey tint"
          value={config.tint === 0 ? 'none' : `${Math.round(config.tint * 100)}%`}
          className="min-w-[8.5rem] flex-1"
        >
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={config.tint}
            aria-label="How far greys lean toward your first colour"
            aria-valuetext={
              config.tint === 0 ? 'pure grey' : `${Math.round(config.tint * 100)} percent`
            }
            onChange={(e) => preview({ tint: Number(e.target.value) })}
            onPointerUp={() => commit()}
            onKeyUp={() => commit()}
          />
          <Hint>How far greys lean toward your first colour.</Hint>
        </Group>
      </div>
    </div>
  )
}

function Group({
  label,
  value,
  lead,
  className = '',
  children,
}: {
  label: string
  value?: string
  /** A cue before the heading, for the one group that is where to begin. */
  lead?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <section className={`flex flex-col gap-1.5 ${className}`}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[12px] font-medium">
          {lead && <span className="font-semibold">{lead} </span>}
          {label}
        </h2>
        {value && <span className="tabular text-[11.5px] text-ink-muted">{value}</span>}
      </div>
      {children}
    </section>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] leading-snug text-ink-muted">{children}</p>
}

/**
 * Black or white on a colour the palette has not calculated a swatch for yet,
 * by the same rule `Swatch.onHexWcag` follows — whichever scores the higher
 * WCAG ratio, so the label stays demonstrably legible.
 */
function inkFor(hex: string): string {
  return wcagContrastHex(hex, '#ffffff') >= wcagContrastHex(hex, '#000000')
    ? '#ffffff'
    : '#000000'
}

function Segmented({
  options,
  value,
  onChange,
  label,
}: {
  options: Array<{ value: string; label: string }>
  value: string
  onChange: (value: string) => void
  label: string
}) {
  return (
    <div role="group" aria-label={label} className="flex border border-line">
      {options.map((option, index) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={[
            'flex-1 py-1 text-[11.5px]',
            index > 0 ? 'border-l border-line' : '',
            value === option.value
              ? 'bg-inverse-bg text-inverse-ink'
              : 'text-ink-muted hover:text-ink',
          ].join(' ')}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/**
 * One colour.
 *
 * The two modes are the heart of the tool, so the choice sits right beside the
 * value rather than behind a menu, and what it currently costs is stated under
 * the colour it applies to.
 */
function SeedControl({
  index,
  hex,
  mode,
}: {
  index: number
  hex: string
  mode: 'exact' | 'harmonize'
}) {
  const { updateSeed, removeSeed, seeds, palette } = usePaletteSession()
  const [text, setText] = useState(hex)
  const [isOpen, setIsOpen] = useState(false)
  const [canPick, setCanPick] = useState(false)
  const popover = useRef<HTMLDivElement>(null)

  // Feature detection has to wait for the client; the shell is prebuilt.
  useEffect(() => setCanPick(supportsEyeDropper()), [])

  // Follow the committed value unless the field is being edited.
  useEffect(() => setText(hex), [hex])

  useEffect(() => {
    if (!isOpen) return

    const onPointerDown = (event: PointerEvent) => {
      if (!popover.current?.contains(event.target as Node)) setIsOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [isOpen])

  const family = palette.ramps.find((r) => r.seed?.input === hex)
  const delta = family?.seed?.delta
  const parsed = parseColor(text)

  // The shade of this seed's family to fill the primary action with.
  //
  // Not the shade the seed itself landed on: a light colour like #ffff00 sits
  // near the top of the ramp, and a pale button is exactly what this control
  // was suffering from before. Instead take the first shade the palette can
  // *prove* clears 4.5:1 against the surface behind it, which is the same
  // "usable as a primary" question the tool already answers per ramp. Both
  // themes are resolved here and chosen between in CSS, so this keeps working
  // with the pre-paint theme script and needs no theme state of its own.
  const shadeAt = (label: number | null | undefined) =>
    label == null ? undefined : family?.swatches.find((sw) => sw.label === label)
  const fallback =
    shadeAt(family?.seed?.slotLabel) ??
    family?.swatches[Math.floor((family?.swatches.length ?? 0) / 2)]
  const onLight = shadeAt(family?.report.firstOnWhite.aa) ?? fallback
  const onDark = shadeAt(family?.report.firstOnBlack.aa) ?? fallback

  const cta = {
    '--cta-bg': onLight?.hex ?? hex,
    '--cta-ink': onLight?.onHexWcag ?? inkFor(onLight?.hex ?? hex),
    '--cta-bg-dark': onDark?.hex ?? hex,
    '--cta-ink-dark': onDark?.onHexWcag ?? inkFor(onDark?.hex ?? hex),
  } as React.CSSProperties

  const commitText = () => {
    if (parsed) updateSeed(index, { hex: parsed.hex })
    else setText(hex)
  }

  return (
    <div className="relative flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setIsOpen((open) => !open)}
          aria-expanded={isOpen}
          aria-label={`Choose colour ${index + 1} visually, currently ${hex}`}
          className="flex h-9 min-w-0 flex-1 items-center gap-2 border border-line-strong bg-[var(--cta-bg)] px-2.5 text-[12px] font-medium text-[var(--cta-ink)] dark:bg-[var(--cta-bg-dark)] dark:text-[var(--cta-ink-dark)]"
          style={cta}
        >
          <svg viewBox="0 0 14 14" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
            <circle cx="7" cy="7" r="5.2" fill="none" stroke="currentColor" strokeWidth="1.2" />
            <circle cx="7" cy="7" r="1.7" fill="currentColor" />
          </svg>
          <span>Pick a colour</span>
          {family && <span className="ml-auto truncate">{family.name}</span>}
        </button>

        {seeds.length > 1 && (
          <button
            type="button"
            aria-label={`Remove colour ${index + 1}`}
            onClick={() => removeSeed(index)}
            className="shrink-0 px-0.5 text-ink-faint hover:text-ink"
          >
            <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" aria-hidden="true">
              <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </button>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commitText}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitText()
            if (e.key === 'Escape') setText(hex)
          }}
          aria-label={`Colour ${index + 1} value`}
          aria-invalid={!parsed}
          spellCheck={false}
          className={[
            'tabular w-[6.5rem] shrink-0 border bg-bg px-1.5 py-0.5 text-[12px]',
            parsed ? 'border-line' : 'border-fail',
          ].join(' ')}
        />

        <div role="group" aria-label={`How to treat colour ${index + 1}`} className="flex border border-line">
          {(['harmonize', 'exact'] as const).map((option, i) => (
            <button
              key={option}
              type="button"
              aria-pressed={mode === option}
              onClick={() => updateSeed(index, { mode: option })}
              className={[
                'px-1.5 py-0.5 text-[11px]',
                i > 0 ? 'border-l border-line' : '',
                mode === option
                  ? 'bg-inverse-bg text-inverse-ink'
                  : 'text-ink-muted hover:text-ink',
              ].join(' ')}
            >
              {option === 'harmonize' ? 'Adjust' : 'Exact'}
            </button>
          ))}
        </div>

        {canPick && (
          <button
            type="button"
            aria-label={`Pick colour ${index + 1} from the screen`}
            onClick={async () => {
              const picked = await pickScreenColor()
              if (picked) updateSeed(index, { hex: picked })
            }}
            className="flex shrink-0 items-center gap-1 border border-line-strong px-1.5 py-0.5 text-[11px] hover:bg-sunken"
          >
            <svg viewBox="0 0 14 14" className="h-3 w-3 shrink-0" aria-hidden="true">
              <path
                d="M8.8 1.9l3.3 3.3M10.4 3.5L5.2 8.7l-.8 2.6 2.6-.8 5.2-5.2zM4.4 11.3l-1.7 1.7"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </svg>
            From screen
          </button>
        )}
      </div>

      {mode === 'exact' ? (
        <p className="text-[10.5px] leading-snug text-ink-muted">
          Ships unchanged; the ramp bends around it. Contrast promises can slip, and any that do
          are marked.
        </p>
      ) : (
        <p className="text-[10.5px] leading-snug text-ink-muted">
          Nudged onto the shared lightness scale so contrast is guaranteed
          {delta && delta.magnitude !== 'none' ? `, currently a ${delta.magnitude} step` : ''}.
        </p>
      )}

      {isOpen && (
        <div
          ref={popover}
          className="absolute left-0 top-[4.6rem] z-30 w-56 border border-line-strong bg-bg p-2 shadow-lg"
        >
          {/* react-colorful streams changes on every pointer move and has no
              release callback, so the wrapper commits when the pointer lifts.
              Without this every drag would fill the history stack. */}
          <div
            onPointerUp={() => updateSeed(index, {})}
            onLostPointerCapture={() => updateSeed(index, {})}
          >
            <HexColorPicker
              color={hex}
              onChange={(next) => updateSeed(index, { hex: next }, { preview: true })}
              style={{ width: '100%', height: 130 }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
