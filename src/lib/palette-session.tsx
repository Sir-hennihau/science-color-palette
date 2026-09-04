/**
 * Shared palette state.
 *
 * Two levels of state, and the split matters. The URL holds committed
 * configuration; a local draft holds whatever is happening during a continuous
 * gesture. Dragging a colour picker fires on every pointer move, and pushing
 * each of those into history would make the back button useless — so a drag
 * previews locally and commits once on release. The result is one history entry
 * per deliberate change, which is what makes back work as undo.
 */

import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useNavigate } from '@tanstack/react-router'

import { generatePalette, hueDistance, type Palette } from '../engine/index.ts'
import {
  packSeed,
  toEngineConfig,
  unpackSeeds,
  type PaletteSearch,
  type UnpackedSeed,
} from './search-schema.ts'

export interface SwatchRef {
  ramp: string
  index: number
}

export interface PaletteSession {
  /** What the interface should render: the draft if one is in flight. */
  config: PaletteSearch
  palette: Palette
  /** Set when the engine could not use the current configuration. */
  error: string | null
  seeds: UnpackedSeed[]
  /** True while a gesture is in progress and the URL is behind. */
  isDraft: boolean

  /** Update without touching history. For use during a drag. */
  preview: (patch: Partial<PaletteSearch>) => void
  /** Commit to the URL, adding one history entry. */
  commit: (patch?: Partial<PaletteSearch>) => void

  updateSeed: (index: number, seed: Partial<UnpackedSeed>, options?: { preview?: boolean }) => void
  addSeed: () => void
  removeSeed: (index: number) => void

  /** Never null: falls back to the shade most people want first. */
  selected: SwatchRef
  select: (ref: SwatchRef) => void
}

const Context = createContext<PaletteSession | null>(null)

export function usePaletteSession(): PaletteSession {
  const session = useContext(Context)
  if (!session) throw new Error('usePaletteSession must be used inside PaletteSessionProvider')
  return session
}

/** A palette that always renders, so a bad config never blanks the screen. */
const FALLBACK_CONFIG = { seeds: [{ color: '#635bff' }] }

export function PaletteSessionProvider({
  search,
  children,
}: {
  search: PaletteSearch
  children: ReactNode
}) {
  const navigate = useNavigate()
  const [draft, setDraft] = useState<PaletteSearch | null>(null)
  const [chosen, setChosen] = useState<SwatchRef | null>(null)

  const config = draft ?? search

  const { palette, error } = useMemo(() => {
    try {
      return { palette: generatePalette(toEngineConfig(config)), error: null }
    } catch (cause) {
      return {
        palette: generatePalette(FALLBACK_CONFIG),
        error: cause instanceof Error ? cause.message : 'Could not build a palette from this.',
      }
    }
  }, [config])

  const seeds = useMemo(() => unpackSeeds(config.seeds), [config.seeds])

  // An explicit choice wins, but it is validated against the current palette:
  // changing the step count or removing a seed can leave it pointing at a
  // shade that no longer exists.
  const selected = useMemo<SwatchRef>(() => {
    const primary = palette.ramps[0]
    const fallback: SwatchRef = {
      ramp: primary.role,
      index: Math.max(
        0,
        primary.swatches.findIndex((s) => s.label === 600) === -1
          ? Math.floor((primary.swatches.length - 1) * 0.6)
          : primary.swatches.findIndex((s) => s.label === 600),
      ),
    }

    if (!chosen) return fallback
    const ramp = palette.ramps.find((r) => r.role === chosen.ramp)
    if (!ramp || !ramp.swatches[chosen.index]) return fallback
    return chosen
  }, [chosen, palette])

  /**
   * The in-flight gesture, tracked synchronously.
   *
   * `preview` renders through a transition so a drag stays smooth, which means
   * the draft state may not have flushed by the time the pointer is released.
   * Reading the value to commit from React state loses a quick flick entirely,
   * so the pending patch is mirrored into a ref that is always current.
   */
  const pending = useRef<Partial<PaletteSearch>>({})

  /** The configuration as it stands right now, gesture included. */
  const currentConfig = useCallback(
    (): PaletteSearch => ({ ...search, ...pending.current }),
    [search],
  )

  const preview = useCallback(
    (patch: Partial<PaletteSearch>) => {
      pending.current = { ...pending.current, ...patch }
      const next = { ...search, ...pending.current }
      startTransition(() => setDraft(next))
    },
    [search],
  )

  const commit = useCallback(
    (patch: Partial<PaletteSearch> = {}) => {
      const next = { ...search, ...pending.current, ...patch }
      pending.current = {}
      setDraft(null)
      void navigate({ to: '/', search: next })
    },
    [navigate, search],
  )

  const updateSeed = useCallback(
    (index: number, patch: Partial<UnpackedSeed>, options?: { preview?: boolean }) => {
      const current = unpackSeeds(currentConfig().seeds)
      const nextSeeds = current.map((seed, i) => (i === index ? { ...seed, ...patch } : seed))
      const packed = { seeds: nextSeeds.map(packSeed) }

      if (options?.preview) preview(packed)
      else commit(packed)
    },
    [commit, currentConfig, preview],
  )

  const addSeed = useCallback(() => {
    const current = unpackSeeds(currentConfig().seeds)

    // Offer the family furthest from every colour already chosen: the most
    // useful next seed is the one that opens up a part of the wheel the palette
    // is not yet anchored in.
    const anchored = palette.ramps.filter((r) => r.seed && r.hue !== null).map((r) => r.hue!)
    const candidates = palette.ramps.filter((r) => !r.seed && r.hue !== null)

    let suggestion = '#f59e0b'
    let best = -1
    for (const candidate of candidates) {
      const distance = anchored.length
        ? Math.min(...anchored.map((hue) => hueDistance(hue, candidate.hue!)))
        : 180
      if (distance > best) {
        best = distance
        const mid = candidate.swatches[Math.min(5, candidate.swatches.length - 1)]
        suggestion = mid.hex
      }
    }

    commit({
      seeds: [...current.map(packSeed), packSeed({ hex: suggestion, mode: 'harmonize' })],
    })
  }, [commit, currentConfig, palette])

  const removeSeed = useCallback(
    (index: number) => {
      const current = unpackSeeds(currentConfig().seeds)
      if (current.length <= 1) return
      commit({ seeds: current.filter((_, i) => i !== index).map(packSeed) })
    },
    [commit, currentConfig],
  )

  const session = useMemo<PaletteSession>(
    () => ({
      config,
      palette,
      error,
      seeds,
      isDraft: draft !== null,
      preview,
      commit,
      updateSeed,
      addSeed,
      removeSeed,
      selected,
      select: setChosen,
    }),
    [addSeed, commit, config, draft, error, palette, preview, removeSeed, seeds, selected, updateSeed],
  )

  return <Context.Provider value={session}>{children}</Context.Provider>
}
