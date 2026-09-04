import { useMemo } from 'react'

import { usePaletteSession } from '../lib/palette-session.tsx'
import { getEnvelope, oklchToRgb, quantize, rgb8ToHex, type Ramp } from '../engine/index.ts'

/**
 * The chroma envelope, drawn.
 *
 * This is the argument the whole tool rests on, and it is much easier to see
 * than to explain. For one hue, the shaded region is every colour a screen can
 * actually show: lightness across, colourfulness up. Its peak — the cusp — sits
 * high for yellow and low for blue, which is why there is no such thing as a
 * dark vivid yellow, and why a ramp built by scaling numbers evenly falls apart.
 *
 * The line through it is where this palette's shades actually landed.
 */
export function EnvelopePanel() {
  const { palette } = usePaletteSession()
  // Neutrals are excluded: their chroma is capped by design, so the plot would
  // just restate the primary's envelope with a flat line through it.
  const chromatic = palette.ramps.filter((ramp) => ramp.hue !== null && ramp.role !== 'neutral')

  if (chromatic.length === 0) {
    return (
      <p className="max-w-[62ch] text-[12.5px] text-ink-muted">
        Your palette is greyscale, so there is no hue to plot. Add a colour with some
        colourfulness to see the limits it works within.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="text-[14px] font-medium">What each hue can physically do</h3>
        <p className="mt-1 max-w-[68ch] text-[12.5px] text-ink-muted">
          The shaded shape is every colour your screen can show at that hue — lightness left to
          right, colourfulness bottom to top. Its peak is the most vivid that hue gets, and it
          moves: high for yellows, low for blues. Dots are this palette's shades.
        </p>
      </div>

      <div className="grid gap-6 [grid-template-columns:repeat(auto-fill,minmax(15rem,1fr))]">
        {chromatic.map((ramp) => (
          <EnvelopePlot key={ramp.role} ramp={ramp} />
        ))}
      </div>
    </div>
  )
}

const WIDTH = 260
const HEIGHT = 150
const PAD_LEFT = 26
const PAD_BOTTOM = 20
const PAD_TOP = 10
const PAD_RIGHT = 6

/** Chroma at the top of every plot, so hues are comparable at a glance. */
const CHROMA_CEILING = 0.33

function EnvelopePlot({ ramp }: { ramp: Ramp }) {
  const hue = ramp.hue!

  const { outline, cusp, ticks } = useMemo(() => {
    const envelope = getEnvelope(hue, 'srgb')

    const x = (l: number) => PAD_LEFT + l * (WIDTH - PAD_LEFT - PAD_RIGHT)
    const y = (c: number) =>
      HEIGHT - PAD_BOTTOM - (c / CHROMA_CEILING) * (HEIGHT - PAD_BOTTOM - PAD_TOP)

    const points = envelope.sampleL.map((l, i) => `${x(l).toFixed(1)},${y(envelope.sampleC[i]).toFixed(1)}`)

    // Close the shape along the achromatic axis.
    const path = `M ${points.join(' L ')} L ${x(1).toFixed(1)},${y(0).toFixed(1)} L ${x(0).toFixed(1)},${y(0).toFixed(1)} Z`

    // A handful of solid colours sampled along the envelope, so the shape is
    // filled with the hue it describes rather than an abstract tint.
    const bands: Array<{ x: number; y: number; w: number; h: number; hex: string }> = []
    const bandCount = 26
    for (let i = 0; i < bandCount; i++) {
      const l = (i + 0.5) / bandCount
      const cMax = Math.min(CHROMA_CEILING, sampleAt(envelope.sampleL, envelope.sampleC, l))
      if (cMax <= 0) continue
      bands.push({
        x: x(i / bandCount),
        y: y(cMax),
        w: (WIDTH - PAD_LEFT - PAD_RIGHT) / bandCount + 0.6,
        h: y(0) - y(cMax),
        hex: rgb8ToHex(quantize(oklchToRgb({ l, c: cMax * 0.72, h: hue }))),
      })
    }

    return {
      outline: { path, bands },
      cusp: { x: x(envelope.cusp.l), y: y(Math.min(envelope.cusp.c, CHROMA_CEILING)) },
      ticks: [0, 0.5, 1].map((l) => ({ x: x(l), label: `${Math.round(l * 100)}` })),
    }
  }, [hue])

  const x = (l: number) => PAD_LEFT + l * (WIDTH - PAD_LEFT - PAD_RIGHT)
  const y = (c: number) =>
    HEIGHT - PAD_BOTTOM - (c / CHROMA_CEILING) * (HEIGHT - PAD_BOTTOM - PAD_TOP)

  const rampPath = ramp.swatches
    .map((s, i) => `${i === 0 ? 'M' : 'L'} ${x(s.oklch.l).toFixed(1)},${y(s.oklch.c).toFixed(1)}`)
    .join(' ')

  const clipId = `envelope-${ramp.role.replace(/[^a-z0-9]/gi, '')}`

  return (
    <figure className="flex flex-col gap-1.5">
      <figcaption className="flex items-baseline gap-2">
        <span className="text-[12.5px] font-medium">{ramp.name}</span>
        <span className="tabular text-[11px] text-ink-faint">{hue.toFixed(0)}°</span>
      </figcaption>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full border border-line bg-surface"
        role="img"
        aria-label={
          `Chroma envelope for ${ramp.name} at hue ${hue.toFixed(0)} degrees. ` +
          `Its most vivid shade sits at ${Math.round((cusp.x - PAD_LEFT) / (WIDTH - PAD_LEFT - PAD_RIGHT) * 100)} percent lightness. ` +
          `The palette's ${ramp.swatches.length} shades are plotted inside it.`
        }
      >
        <defs>
          <clipPath id={clipId}>
            <path d={outline.path} />
          </clipPath>
        </defs>

        {/* The gamut, filled with the hue it belongs to. */}
        <g clipPath={`url(#${clipId})`}>
          {outline.bands.map((band, i) => (
            <rect key={i} x={band.x} y={band.y} width={band.w} height={band.h} fill={band.hex} />
          ))}
        </g>

        <path d={outline.path} fill="none" stroke="var(--app-line-strong)" strokeWidth="1" />

        {/* The cusp: the most colourful this hue gets, and where. */}
        <line
          x1={cusp.x}
          y1={cusp.y}
          x2={cusp.x}
          y2={HEIGHT - PAD_BOTTOM}
          stroke="var(--app-ink-faint)"
          strokeWidth="0.75"
          strokeDasharray="2 2"
        />
        <circle cx={cusp.x} cy={cusp.y} r="2.5" fill="none" stroke="var(--app-ink)" strokeWidth="1.2" />

        {/* Where this palette's shades actually landed. */}
        <path
          d={rampPath}
          fill="none"
          stroke="var(--app-ink)"
          strokeWidth="1.25"
          strokeLinejoin="round"
        />
        {ramp.swatches.map((s) => (
          <circle
            key={s.index}
            cx={x(s.oklch.l)}
            cy={y(s.oklch.c)}
            r={s.isSeed ? 3.4 : 2.4}
            fill={s.hex}
            stroke="var(--app-ink)"
            strokeWidth={s.isSeed ? 1.4 : 0.9}
          />
        ))}

        {/* Axes, labelled only where a number helps. */}
        <line
          x1={PAD_LEFT}
          y1={HEIGHT - PAD_BOTTOM}
          x2={WIDTH - PAD_RIGHT}
          y2={HEIGHT - PAD_BOTTOM}
          stroke="var(--app-line-strong)"
          strokeWidth="1"
        />
        {ticks.map((tick) => (
          <text
            key={tick.label}
            x={tick.x}
            y={HEIGHT - PAD_BOTTOM + 11}
            textAnchor="middle"
            className="tabular"
            fill="var(--app-ink-muted)"
            fontSize="8"
          >
            {tick.label}
          </text>
        ))}
        <text
          x={PAD_LEFT - 5}
          y={PAD_TOP + 4}
          textAnchor="end"
          fill="var(--app-ink-muted)"
          fontSize="8"
        >
          vivid
        </text>
        <text
          x={PAD_LEFT - 5}
          y={HEIGHT - PAD_BOTTOM}
          textAnchor="end"
          fill="var(--app-ink-muted)"
          fontSize="8"
        >
          grey
        </text>
      </svg>

      <p className="text-[11px] text-ink-muted">
        Most vivid at {Math.round(cuspLightness(hue) * 100)}% lightness
        {describeCusp(cuspLightness(hue))}
      </p>
    </figure>
  )
}

function cuspLightness(hue: number): number {
  return getEnvelope(hue, 'srgb').cusp.l
}

function describeCusp(l: number): string {
  if (l > 0.8) return ' — this hue is only vivid when light, so its dark shades must be muted.'
  if (l < 0.55) return ' — this hue is only vivid when dark, so its light shades must be pale.'
  return ' — near the middle, so this hue holds its colour across the ramp.'
}

/** Linear read of a sampled envelope, for filling the plot. */
function sampleAt(sampleL: readonly number[], sampleC: readonly number[], l: number): number {
  if (l <= 0 || l >= 1) return 0

  let i = 0
  while (i < sampleL.length - 2 && sampleL[i + 1] < l) i++

  const span = sampleL[i + 1] - sampleL[i]
  if (span <= 0) return sampleC[i]

  const f = (l - sampleL[i]) / span
  return sampleC[i] + f * (sampleC[i + 1] - sampleC[i])
}
