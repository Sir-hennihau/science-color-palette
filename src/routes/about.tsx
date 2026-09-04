import { createFileRoute } from '@tanstack/react-router'

import { DataTable, DocLink, DocPage, Figures, N } from '../components/DocPage.tsx'

export const Route = createFileRoute('/about')({
  head: () => ({
    meta: [
      { title: 'About — Science Color Palette' },
      {
        name: 'description',
        content:
          'Where this palette generator came from, what it borrows from Stripe, HSLuv and OKLab, ' +
          'and the measured places where it goes further than its own references.',
      },
    ],
  }),
  component: About,
})

function About() {
  return (
    <DocPage
      title="About"
      standfirst={
        <>
          A palette generator that will not make a promise it cannot measure. This page is the
          honest version of how it works: what it borrows, where it goes further than the work that
          inspired it, and the things it still cannot do.
        </>
      }
      sections={[
        { id: 'problem', title: 'The problem', body: <Problem /> },
        { id: 'idea', title: 'The one idea', body: <Idea /> },
        { id: 'inspiration', title: 'What we borrowed, and from whom', body: <Inspiration /> },
        { id: 'further', title: 'Where we went further', body: <Further /> },
        { id: 'limits', title: 'What it still cannot do', body: <Limits /> },
        { id: 'checked', title: 'How any of this is checked', body: <Checked /> },
      ]}
    />
  )
}

function Problem() {
  return (
    <>
      <p>
        Most palettes number their shades <N>50</N> to <N>900</N> and imply that the numbers mean
        something across hues — that <N>yellow-500</N> and <N>blue-500</N> are interchangeable
        because they share a number. In the palettes people actually build on, they are not.
      </p>

      <Figures
        items={[
          {
            value: '20.3',
            label: 'L* between two shade 500s',
            note: 'Tailwind yellow-500 sits at L* 75.9, its blue-500 at 55.6',
          },
          {
            value: '1.92:1',
            label: 'yellow-500 on white',
            note: 'Below 3:1 — not usable even for large text',
          },
          {
            value: '3.68:1',
            label: 'blue-500 on white',
            note: 'The same shade number, a different answer',
          },
        ]}
      />

      <p>
        That is not a criticism of hand-tuning — those ramps were made by eye, and by eye they are
        beautiful. It is a criticism of the number. If <N>500</N> means one thing in yellow and
        another in blue, then every rule a design system writes on top of it ("use{' '}
        <N>600</N> for body text") is true in some hues and false in others, and nobody finds out
        which until an audit.
      </p>
    </>
  )
}

function Idea() {
  return (
    <>
      <p>
        Everything here follows from one decision. WCAG contrast depends on exactly one property of
        a colour — its relative luminance. Not hue, not saturation, not lightness as any colour
        picker reports it. So if you <em>place</em> a shade by luminance rather than choosing it and
        measuring afterwards, its contrast is fixed before you know what colour it will be.
      </p>
      <p>
        Every family in the palette climbs the same luminance staircase. Shade <N>600</N> carries
        the same contrast whether it is blue or yellow, because it was placed at the same rung.
        Three of those rungs are contracts: their luminance is derived from a target ratio, so the
        shade landing there is solved until it reaches it.
      </p>

      <Figures
        items={[
          {
            value: '0.27',
            label: 'L* spread across families',
            note: 'At shade 500, over eleven families',
          },
          { value: '3.02:1', label: 'worst shade 500', note: 'Promises 3:1 — large text, icons' },
          { value: '4.54:1', label: 'worst shade 600', note: 'Promises 4.5:1 — body text' },
        ]}
      />

      <p>
        What is left over — hue, and how colourful the shade is — is then free to vary, and that is
        where the rest of the work goes.
      </p>
    </>
  )
}

function Inspiration() {
  return (
    <>
      <p>
        None of the underlying science is ours. It is worth being specific about who did what.
      </p>

      <dl className="flex flex-col gap-4">
        <Source
          title="Stripe — Designing accessible color systems"
          href="https://stripe.com/blog/accessible-color-systems"
        >
          The whole shape of the idea. Stripe hit the same wall — brand colours that failed contrast,
          and no way to fix one without breaking the set — and solved it by moving to a perceptual
          space and putting every hue on one lightness curve, so that a level number meant the same
          contrast everywhere. Their figures showing every hue landing on <N>3.0+</N> for icons and{' '}
          <N>4.5+</N> for text are the target this tool aims at. We arrived at nearly the same
          staircase independently: the scale in their screenshots reads{' '}
          <N>98 92 81 70 61 49 37 29 21 13</N>, ours <N>98 94 89 82 72 60 48 36 28 21 13</N>.
        </Source>

        <Source title="HSLuv" href="https://www.hsluv.org/">
          The normalisation trick. HSLuv's insight is that raw chroma is unusable as a control
          because its maximum depends on hue and lightness, so it expresses colourfulness as a
          percentage of whatever is available at that point. That is exactly how colourfulness works
          here — a share of the hue's own envelope, not a number.
        </Source>

        <Source
          title="Programming Design Systems — Perceptually uniform colour spaces"
          href="https://programmingdesignsystems.com/color/perceptually-uniform-color-spaces/index.html"
        >
          Why HSL cannot do this job: blue and yellow are both "100% lightness" in HSL and one of
          them is nearly black. It also makes the point we ended up measuring for ourselves — that
          equal steps around a hue circle are not equal perceptual steps.
        </Source>

        <Source title="Jamie Wong — Color: From Hexcodes to Eyeballs" href="https://jamie-wong.com/post/color/">
          The arithmetic, done carefully. Gamma encoding, why luminance coefficients only apply
          after decoding to linear light, and why blending in encoded space is wrong. The engine's
          transfer functions are the ones from this article.
        </Source>

        <Source title="Bartosz Ciechanowski — Color Spaces" href="https://ciechanow.ski/color-spaces/">
          What is underneath all of it: cone responses, CIE XYZ, chromaticity, and the fact that a
          gamut is a shape with edges rather than a range with limits. The chroma envelope is that
          shape, per hue.
        </Source>
      </dl>
    </>
  )
}

function Source({
  title,
  href,
  children,
}: {
  title: string
  href: string
  children: React.ReactNode
}) {
  return (
    <div className="border-t border-line pt-3 first:border-t-0 first:pt-0">
      <dt className="text-[13px] font-medium">
        <DocLink to={href}>{title}</DocLink>
      </dt>
      <dd className="mt-1.5 max-w-[74ch]">{children}</dd>
    </div>
  )
}

function Further() {
  return (
    <>
      <p>
        Three places where the tool does something its references do not. Each was found by
        measuring rather than by reasoning, and each is reproducible.
      </p>

      <h3 className="mt-2 text-[13px] font-medium">
        1. The promise is made against shade 50, not against white
      </h3>
      <p>
        Contrast guarantees are conventionally quoted against pure white. But <N>bg-50</N> is the
        background these colours actually sit on, and shade <N>50</N> is only about <N>1.06:1</N>{' '}
        against white — so a promise made against white has already spent 6% of itself before your
        text starts. The tool used to do it the conventional way. Auditing its own output caught it:
      </p>

      <DataTable
        caption="The three contract shades before and after anchoring on shade 50"
        columns={[
          'Shade',
          'Promises',
          'On white',
          'On shade 50, anchored on white',
          'On shade 50, now',
        ]}
        align={[0, 2, 3, 4]}
        rows={[
          ['500', '3:1', '3.19', '2.84', '3.02'],
          ['600', '4.5:1', '4.79', '4.27', '4.54'],
          ['700', '7:1', '7.50', '6.68', '7.10'],
        ]}
      />

      <p>
        Every figure here is the worst case across the whole palette, not a favourable ramp. All
        three were quietly failing on the palette's own lightest tint. Re-deriving the rungs
        against shade <N>50</N> fixed it, and because white is lighter than shade <N>50</N>, the
        promise against white comes free. The whole cost was about <N>1.5</N> points of lightness —
        shade <N>600</N> moved from <N>#6563f1</N> to <N>#615fec</N> — and it bought a full step on
        every guarantee: <N>4.5:1</N> now arrives at six shades apart instead of seven.
      </p>

      <h3 className="mt-4 text-[13px] font-medium">2. The gamut is computed, not drawn</h3>
      <p>
        Stripe's tool <em>showed</em> designers the impossible colours as shaded regions so they
        could avoid them by eye. Here the boundary is solved per hue and the ramp is constrained to
        stay inside it, which is what makes "use 90% of what this hue can manage" a rule the
        machine can follow. Their figure is a warning label; this is a constraint. It also means
        every exported colour is checked against what a screen can display — browsers clip
        out-of-range colours rather than mapping them, so the tool has to be the one guaranteeing
        it.
      </p>

      <h3 className="mt-4 text-[13px] font-medium">3. A newer colour space, and the evidence for it</h3>
      <p>
        Stripe used CIELAB, which was the right choice in 2019. This tool uses OKLab, published a
        year later. For the lightness axis the two are equivalent — both are functions of luminance
        alone — so that part is not an improvement, just a different spelling. Hue is where it
        matters: holding one hue number constant down a ramp should keep the colour recognisably
        the same family, and CIELAB is known to fail at this in the blues.
      </p>
      <p>
        Building the same indigo family both ways on the same luminance staircase, and judging both
        with an independent appearance model:
      </p>

      <DataTable
        caption="Hue drift down one indigo ramp, built two ways"
        columns={['Constant hue in', 'Jzazbz hue drift', 'CAM16 hue drift']}
        align={[1, 2]}
        rows={[
          ['OKLab (ours)', '2.7°', '12.9°'],
          ['CIELAB (Stripe’s space)', '22.5°', '14.0°'],
        ]}
      />

      <p>
        Across ten hues the pattern holds: OKLab's worst case is <N>1.9°</N> of drift, CIELAB's is{' '}
        <N>21.3°</N> and HSLuv's is <N>9.8°</N>. The two appearance models disagree about the
        blue-violet region and neither settles it, so the useful check is the one that does not
        depend on picking an oracle — how the result compares to ramps people hand-tuned and
        shipped:
      </p>

      <DataTable
        caption="Hue drift compared with hand-tuned reference ramps, measured by CAM16"
        columns={['Family', 'Ours', 'Tailwind']}
        align={[1, 2]}
        rows={[
          ['yellow', '3.3°', '52.1°'],
          ['sky / blue', '6.8°', '24.0°'],
          ['indigo', '12.9°', '15.1°'],
          ['purple / violet', '9.1°', '11.1°'],
          ['emerald', '2.2°', '6.6°'],
          ['rose / red', '0.9°', '7.9°'],
        ]}
      />

      <p>
        Generated ramps hold their hue better than hand-tuned ones on every family we could compare.
        Two cautions if you repeat this: hue angle is meaningless at low chroma, so the lightest
        shades have to be excluded or quantisation noise roughly doubles every figure, and OKLab and
        Jzazbz share a lineage, so Jzazbz is predisposed to agree with OKLab. The Tailwind column is
        the honest one.
      </p>
    </>
  )
}

function Limits() {
  return (
    <>
      <p>
        Nothing here is free, and one of the trade-offs is inherent rather than a to-do.
      </p>
      <p>
        <strong className="font-medium text-ink">
          Equal contrast is not equal apparent lightness.
        </strong>{' '}
        Pinning luminance is what makes the contrast guarantee exact, but luminance is not what the
        eye reports as lightness. At the same shade number, across families, an appearance model
        puts up to <N>4.9</N> units of lightness between the swatches even though their measured
        contrast is identical — the effect is strongest at mid-ramp, where chroma is highest. They
        are genuinely interchangeable for contrast and genuinely not interchangeable for apparent
        weight. Stripe's method has exactly the same property; there is no version of this that
        keeps the guarantee and loses the effect.
      </p>
      <p>
        Also true, and worth saying plainly: APCA is not a ratified standard and is reported here as
        a second opinion only. Output is sRGB — the envelope maths is already gamut-generic and
        Display-P3 is tested, but nothing emits it yet. There is no colour-vision-deficiency
        simulation, so the tool makes no claim about CVD-safe output. And the lightest shades of
        neighbouring families converge past about ten families; the tool warns you rather than
        pretending otherwise.
      </p>
    </>
  )
}

function Checked() {
  return (
    <>
      <p>
        The credibility of everything above rests on it being measured rather than asserted, so the
        checking is part of the product.
      </p>

      <Figures
        items={[
          { value: '214', label: 'engine tests', note: 'Unit, calibration, golden, property' },
          {
            value: '43',
            label: 'browser checks',
            note: 'Including axe on every page, in both themes',
          },
          { value: '~250', label: 'generated configs', note: 'Every invariant, every time' },
        ]}
      />

      <p>
        The colour maths is written from the source papers rather than pulled from a library, which
        means <DocLink to="https://culorijs.org/">culori</DocLink> and the APCA reference package
        can serve as independent oracles in the tests instead of being both the implementation and
        its own check. Contrast contracts are re-measured on the eight-bit values that ship. Full
        palettes are snapshotted, so a change to the algorithm has to be looked at and versioned
        before it can be recorded.
      </p>
      <p>
        The tool also has to pass its own audit, which is why its interface uses the
        WCAG-maximising text colour for its own labels rather than the perceptual one it recommends
        to you, and why every pass or fail mark carries an icon and a word rather than relying on
        colour. If a contrast tool fails its own standard, nothing else it says is worth much.
      </p>
      <p>
        For what each reported value means, see{' '}
        <DocLink to="/how-to">How to read it</DocLink>.
      </p>
    </>
  )
}
