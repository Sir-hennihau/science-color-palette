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
  useState,
  type ReactNode,
} from 'react'
import { useNavigate } from '@tanstack/react-router'

import { generatePalette, type Palette } from '../engine/index.ts'
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

  const preview = useCallback((patch: Partial<PaletteSearch>) => {
    // Transitions keep a drag smooth: React may show a slightly stale palette
    // for a frame rather than blocking the pointer.
    startTransition(() => {
      setDraft((current) => ({ ...(current ?? search), ...patch }))
    })
  }, [search])

  const commit = useCallback(
    (patch: Partial<PaletteSearch> = {}) => {
      const next = { ...(draft ?? search), ...patch }
      setDraft(null)
      void navigate({ to: '/', search: next })
    },
    [draft, navigate, search],
  )

  const updateSeed = useCallback(
    (index: number, patch: Partial<UnpackedSeed>, options?: { preview?: boolean }) => {
      const current = unpackSeeds((draft ?? search).seeds)
      const nextSeeds = current.map((seed, i) => (i === index ? { ...seed, ...patch } : seed))
      const packed = { seeds: nextSeeds.map(packSeed) }

      if (options?.preview) preview(packed)
      else commit(packed)
    },
    [commit, draft, preview, search],
  )

  const addSeed = useCallback(() => {
    const current = unpackSeeds((draft ?? search).seeds)
    const palettePrimary = palette.ramps[0]
    // Offer the complement of the primary, which is the most useful next
    // colour far more often than another shade of what is already there.
    const suggestion =
      palette.suggestions.find((s) => s.kind === 'complementary')?.preview[0]?.hex ?? '#f59e0b'

    commit({
      seeds: [
        ...current.map(packSeed),
        packSeed({ hex: palettePrimary ? suggestion : '#f59e0b', mode: 'harmonize' }),
      ],
    })
  }, [commit, draft, palette, search])

  const removeSeed = useCallback(
    (index: number) => {
      const current = unpackSeeds((draft ?? search).seeds)
      if (current.length <= 1) return
      commit({ seeds: current.filter((_, i) => i !== index).map(packSeed) })
    },
    [commit, draft, search],
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
