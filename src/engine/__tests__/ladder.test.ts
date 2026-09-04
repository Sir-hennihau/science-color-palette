import { describe, expect, it } from 'vitest'

import {
  DEFAULT_LIGHTEST_L,
  DEFAULT_STEPS,
  MAX_STEPS,
  MIN_STEPS,
  buildLadder,
  labelForT,
  nearestSlot,
  slotForLabel,
  warpLadderForSeed,
} from '../ladder.ts'
import { lstarFromY, yFromLstar } from '../color/space.ts'
import { yForRatioBelow, yForRatioOnWhite } from '../contrast/wcag.ts'
import { LIGHTEST_Y_MARGIN, MARGIN_Y } from '../constants.ts'
import { EngineError } from '../types.ts'

const TAILWIND_LABELS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]

function stepCounts(): number[] {
  return Array.from({ length: MAX_STEPS - MIN_STEPS + 1 }, (_, i) => MIN_STEPS + i)
}

describe('shade labels', () => {
  it('reproduces the familiar Tailwind set at the default step count', () => {
    expect(buildLadder().labels).toEqual(TAILWIND_LABELS)
    expect(DEFAULT_STEPS).toBe(11)
  })

  it('stays unique and ordered for every supported step count', () => {
    for (const steps of stepCounts()) {
      const { labels } = buildLadder({ steps })
      expect(labels, `steps=${steps}`).toHaveLength(steps)
      expect(new Set(labels).size, `steps=${steps} unique`).toBe(steps)
      for (let i = 1; i < labels.length; i++) {
        expect(labels[i], `steps=${steps} ordered`).toBeGreaterThan(labels[i - 1])
      }
    }
  })

  it('pins the ends to 50 and 950', () => {
    expect(labelForT(0)).toBe(50)
    expect(labelForT(1)).toBe(950)
  })
})

describe('ladder shape', () => {
  it('runs light to dark, strictly, at every step count', () => {
    for (const steps of stepCounts()) {
      const { lstar, yTargets } = buildLadder({ steps })
      for (let i = 1; i < steps; i++) {
        expect(lstar[i], `steps=${steps} lstar[${i}]`).toBeLessThan(lstar[i - 1])
        expect(yTargets[i], `steps=${steps} y[${i}]`).toBeLessThan(yTargets[i - 1])
      }
    }
  })

  it('keeps luminance and lightness consistent', () => {
    const { lstar, yTargets } = buildLadder()
    for (let i = 0; i < lstar.length; i++) {
      expect(yFromLstar(lstar[i])).toBeCloseTo(yTargets[i], 12)
      expect(lstarFromY(yTargets[i])).toBeCloseTo(lstar[i], 9)
    }
  })

  it('hits the contrast anchors exactly at the default step count', () => {
    const ladder = buildLadder()

    // Shades 500, 600 and 700 are the contract steps, and they are measured
    // against the ramp's own lightest shade rather than against pure white.
    expect(ladder.contracts).toEqual([
      { index: 5, kind: 'ratioOnLightest', target: 3 },
      { index: 6, kind: 'ratioOnLightest', target: 4.5 },
      { index: 7, kind: 'ratioOnLightest', target: 7 },
    ])

    const lightestY = yFromLstar(DEFAULT_LIGHTEST_L) - LIGHTEST_Y_MARGIN

    for (const contract of ladder.contracts) {
      const expected = yForRatioBelow(lightestY, contract.target) - MARGIN_Y
      expect(ladder.yTargets[contract.index]).toBeCloseTo(expected, 12)
    }
  })

  it('biases contract luminances toward the safe side of the threshold', () => {
    const ladder = buildLadder()
    const lightestY = yFromLstar(DEFAULT_LIGHTEST_L)

    for (const contract of ladder.contracts) {
      // Darker than strictly required, so 8-bit rounding cannot drop the
      // shipped colour below its promised ratio.
      expect(ladder.yTargets[contract.index]).toBeLessThan(
        yForRatioBelow(lightestY, contract.target),
      )
    }
  })

  it('anchoring on the lightest shade implies the same promise on white', () => {
    // White is lighter than shade 50, so it can only give more contrast. This
    // is why the switch costs nothing: every guarantee that held before still
    // holds, and the one that matters — against the background these colours
    // are actually used on — now holds too.
    const ladder = buildLadder()
    for (const contract of ladder.contracts) {
      expect(ladder.yTargets[contract.index]).toBeLessThan(
        yForRatioOnWhite(contract.target),
      )
    }
  })

  it('refuses a contract the background cannot support', () => {
    // 30:1 on a shade-50 background is not a tight fit but an impossibility;
    // clamping it would ship a promise that cannot hold.
    expect(() => buildLadder({ anchors: [{ t: 0.5, ratioOnLightest: 30 }] })).toThrow(
      EngineError,
    )
    expect(() => buildLadder({ anchors: [{ t: 0.5, ratioOnWhite: 25 }] })).toThrow(EngineError)
  })

  it('refines rather than reshuffles when steps are added', () => {
    // A 6-step ramp samples the same underlying curve as an 11-step one, so the
    // shades they share must be identical.
    const coarse = buildLadder({ steps: 6 })
    const fine = buildLadder({ steps: 11 })

    for (let i = 0; i < coarse.steps; i++) {
      const match = fine.t.findIndex((t) => Math.abs(t - coarse.t[i]) < 1e-12)
      expect(match, `coarse step ${i} exists in the fine ladder`).toBeGreaterThanOrEqual(0)
      expect(fine.lstar[match]).toBeCloseTo(coarse.lstar[i], 9)
    }
  })

  it('honours custom endpoints', () => {
    const ladder = buildLadder({ lightestL: 99, darkestL: 5 })
    expect(ladder.lstar[0]).toBeCloseTo(99, 9)
    expect(ladder.lstar[ladder.steps - 1]).toBeCloseTo(5, 9)
  })
})

describe('ladder validation', () => {
  it('rejects step counts outside the supported range', () => {
    for (const steps of [4, 16, 0, -1, 10.5]) {
      expect(() => buildLadder({ steps }), `steps=${steps}`).toThrow(EngineError)
    }
  })

  it('rejects anchors that do not run light to dark', () => {
    expect(() =>
      buildLadder({ anchors: [{ t: 0.3, lstar: 40 }, { t: 0.6, lstar: 80 }] }),
    ).toThrow(/decrease in lightness/)
  })

  it('rejects anchors at or outside the endpoints', () => {
    expect(() => buildLadder({ anchors: [{ t: 0, lstar: 50 }] })).toThrow(EngineError)
    expect(() => buildLadder({ anchors: [{ t: 1, lstar: 50 }] })).toThrow(EngineError)
  })

  it('rejects an anchor with nothing to anchor to', () => {
    expect(() => buildLadder({ anchors: [{ t: 0.5 }] })).toThrow(/needs one of/)
  })

  it('supports dark-surface contracts', () => {
    const ladder = buildLadder({
      anchors: [
        { t: 0.3, lstar: 80 },
        { t: 0.5, ratioOnBlack: 4.5 },
        { t: 0.8, lstar: 25 },
      ],
    })
    const contract = ladder.contracts.find((c) => c.kind === 'ratioOnBlack')
    expect(contract).toBeDefined()
    // Lighter than strictly required, the safe side for a dark background.
    expect(ladder.yTargets[contract!.index]).toBeGreaterThan(0.175)
  })
})

describe('slot assignment', () => {
  it('picks the step closest in lightness', () => {
    const ladder = buildLadder()
    for (let i = 0; i < ladder.steps; i++) {
      expect(nearestSlot(ladder, ladder.lstar[i])).toBe(i)
    }
  })

  it('breaks ties toward the middle of the ramp', () => {
    const ladder = buildLadder()
    const midpoint = (ladder.lstar[5] + ladder.lstar[6]) / 2
    const chosen = nearestSlot(ladder, midpoint)
    expect([5, 6]).toContain(chosen)
  })

  it('clamps colours beyond either end to the end step', () => {
    const ladder = buildLadder()
    expect(nearestSlot(ladder, 100)).toBe(0)
    expect(nearestSlot(ladder, 0)).toBe(ladder.steps - 1)
  })

  it('resolves labels to indices', () => {
    const ladder = buildLadder()
    expect(slotForLabel(ladder, 600)).toBe(6)
    expect(slotForLabel(ladder, 999)).toBe(-1)
  })
})

describe('warping the ladder for an exact seed', () => {
  it('places the seed lightness exactly on its step', () => {
    const ladder = buildLadder()
    for (const index of [0, 3, 6, 10]) {
      for (const offset of [6, -6]) {
        const target = Math.min(99, Math.max(1, ladder.lstar[index] + offset))
        const { ladder: warped, warnings } = warpLadderForSeed(ladder, index, target)
        expect(warnings.map((w) => w.code)).not.toContain('SEED_SLOT_INFEASIBLE')
        expect(warped.lstar[index], `index ${index} offset ${offset}`).toBeCloseTo(target, 9)
      }
    }
  })

  it('keeps the ramp strictly light to dark for any seed at any slot', () => {
    const ladder = buildLadder()
    for (const index of [0, 1, 5, 9, 10]) {
      for (const target of [0, 12, 50, 88, 100]) {
        const { ladder: warped } = warpLadderForSeed(ladder, index, target)
        for (let i = 1; i < warped.steps; i++) {
          expect(
            warped.lstar[i],
            `index ${index} target ${target} step ${i}`,
          ).toBeLessThan(warped.lstar[i - 1])
        }
        for (const l of warped.lstar) {
          expect(l).toBeGreaterThanOrEqual(0)
          expect(l).toBeLessThanOrEqual(100)
        }
      }
    }
  })

  it('says so when a slot cannot physically hold the colour', () => {
    // Black at the lightest slot would leave no lightness for the ten shades
    // below it, so the request is reported rather than silently mangled.
    const ladder = buildLadder()
    const { warnings, ladder: warped } = warpLadderForSeed(ladder, 0, 0)

    expect(warnings.map((w) => w.code)).toContain('SEED_SLOT_INFEASIBLE')
    expect(warped.lstar[0]).toBeGreaterThan(0)
    for (let i = 1; i < warped.steps; i++) {
      expect(warped.lstar[i]).toBeLessThan(warped.lstar[i - 1])
    }
  })

  it('accepts extreme seeds at the matching end without complaint', () => {
    const ladder = buildLadder()

    const black = warpLadderForSeed(ladder, ladder.steps - 1, 0)
    expect(black.warnings.map((w) => w.code)).not.toContain('SEED_SLOT_INFEASIBLE')
    expect(black.ladder.lstar[ladder.steps - 1]).toBeCloseTo(0, 9)

    const white = warpLadderForSeed(ladder, 0, 100)
    expect(white.warnings.map((w) => w.code)).not.toContain('SEED_SLOT_INFEASIBLE')
    expect(white.ladder.lstar[0]).toBeCloseTo(100, 9)
  })

  it('leaves the ladder untouched when the seed already fits', () => {
    const ladder = buildLadder()
    const { ladder: warped, warnings } = warpLadderForSeed(ladder, 6, ladder.lstar[6])
    expect(warped).toBe(ladder)
    expect(warnings).toEqual([])
  })

  it('barely moves distant shades', () => {
    // The displacement tapers to nothing at both ends, so a mid-ramp seed does
    // not drag the lightest and darkest shades around with it.
    const ladder = buildLadder()
    const { ladder: warped } = warpLadderForSeed(ladder, 6, ladder.lstar[6] + 5)
    expect(Math.abs(warped.lstar[0] - ladder.lstar[0])).toBeLessThan(0.6)
    expect(Math.abs(warped.lstar[10] - ladder.lstar[10])).toBeLessThan(0.6)
  })

  it('reports strain when a seed drags the ramp a long way', () => {
    const ladder = buildLadder()
    const { warnings } = warpLadderForSeed(ladder, 6, ladder.lstar[6] + 25)
    expect(warnings.map((w) => w.code)).toContain('SEED_WARP_STRAIN')
  })

  it('reports compression for a degenerate request', () => {
    // White pinned to the darkest step leaves almost no room above it: the pin
    // is pulled just inside the feasible range and the squeeze is reported.
    const ladder = buildLadder()
    const { warnings, ladder: warped } = warpLadderForSeed(ladder, ladder.steps - 1, 100)

    const codes = warnings.map((w) => w.code)
    expect(codes).toContain('SEED_WARP_COMPRESSED')
    expect(codes).toContain('SEED_SLOT_INFEASIBLE')
    expect(warped.lstar[warped.steps - 1]).toBeGreaterThan(98)
    for (let i = 1; i < warped.steps; i++) {
      expect(warped.lstar[i]).toBeLessThan(warped.lstar[i - 1])
    }
  })

  it('recomputes luminance targets from the warped lightnesses', () => {
    const ladder = buildLadder()
    const { ladder: warped } = warpLadderForSeed(ladder, 4, ladder.lstar[4] - 8)
    for (let i = 0; i < warped.steps; i++) {
      expect(warped.yTargets[i]).toBeCloseTo(yFromLstar(warped.lstar[i]), 12)
    }
  })
})
