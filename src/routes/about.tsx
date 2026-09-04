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
          'how it compares with Tailwind Ink, and the measured places where it goes further ' +
          'than its own references.',
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
          How the generator works, whose work it builds on, the three places where it goes further
          than that work, and the things it still cannot do. Every figure quoted on this page comes
          out of the test suite.
        </>
      }
      sections={[
        { id: 'problem', title: 'The problem', body: <Problem /> },
        { id: 'idea', title: 'The one idea', body: <Idea /> },
        { id: 'inspiration', title: 'What we borrowed, and from whom', body: <Inspiration /> },
        { id: 'further', title: 'Where we went further', body: <Further /> },
        { id: 'tailwind-ink', title: 'Compared with Tailwind Ink', body: <TailwindInk /> },
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
        Most palettes number their shades from <N>50</N> to <N>900</N>, which invites you to read
        the number as a constant: <N>yellow-500</N> and <N>blue-500</N> share a number, so they
        ought to be interchangeable. In the palettes people actually build on, they are not.
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
        This is not a complaint about hand-tuning. Those ramps were made by eye, and by eye they are
        beautiful. The trouble starts with what teams then build on top of the numbers. When a
        design system writes a rule like "use <N>600</N> for body text", that rule holds in some
        hues and quietly fails in others, and usually nobody finds out which until an audit.
      </p>
    </>
  )
}

function Idea() {
  return (
    <>
      <p>
        Everything here follows from one decision. WCAG contrast depends on a single property of a
        colour, its relative luminance. Hue and saturation play no part, and neither does lightness
        as a colour picker reports it. So the tool fixes the luminance first and solves for the
        colour second. By the time a shade has a hex value, its contrast is already settled.
      </p>
      <p>
        Every family climbs the same luminance staircase, which is why shade <N>600</N> carries the
        same contrast whether it is blue or yellow. Three rungs on that staircase are contracts:
        their luminance is derived from a target ratio, and the solver keeps working until the shade
        that lands there meets it.
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
        That leaves hue and colourfulness free to vary, and most of the remaining work goes into
        deciding how.
      </p>
    </>
  )
}

function Inspiration() {
  return (
    <>
      <p>
        None of the underlying science is ours, so it is only fair to be specific about who did
        what.
      </p>

      <dl className="flex flex-col gap-4">
        <Source
          title="Stripe — Designing accessible color systems"
          href="https://stripe.com/blog/accessible-color-systems"
        >
          The whole shape of the idea. Stripe hit the same wall we did: brand colours that failed
          contrast, with no way to fix one without breaking the set. Their answer was to move into a
          perceptual space and put every hue on one lightness curve, so that a level number meant
          the same contrast everywhere. The figures in that post, with every hue landing above{' '}
          <N>3.0</N> for icons and above <N>4.5</N> for text, are what this tool aims at. We
          arrived at nearly the same staircase independently: the scale in their screenshots reads{' '}
          <N>98 92 81 70 61 49 37 29 21 13</N>, ours <N>98 94 89 82 72 60 48 36 28 21 13</N>.
        </Source>

        <Source title="HSLuv" href="https://www.hsluv.org/">
          The normalisation trick. Raw chroma makes a poor control because its maximum moves with
          hue and lightness, so HSLuv expresses colourfulness as a percentage of whatever is
          available at that point. Colourfulness works the same way here: a share of the hue's own
          envelope instead of a fixed number.
        </Source>

        <Source
          title="Programming Design Systems — Perceptually uniform colour spaces"
          href="https://programmingdesignsystems.com/color/perceptually-uniform-color-spaces/index.html"
        >
          Why HSL cannot do this job: blue and yellow both sit at "100% lightness" in HSL, and one
          of them is nearly black. It also makes a point we ended up measuring for ourselves, that
          equal steps around a hue circle are not equal perceptual steps.
        </Source>

        <Source title="Jamie Wong — Color: From Hexcodes to Eyeballs" href="https://jamie-wong.com/post/color/">
          The arithmetic, done carefully. Gamma encoding, why luminance coefficients only apply
          after decoding to linear light, and why blending in encoded space is wrong. The engine's
          transfer functions are the ones from this article.
        </Source>

        <Source title="Bartosz Ciechanowski — Color Spaces" href="https://ciechanow.ski/color-spaces/">
          What sits underneath all of it: cone responses, CIE XYZ, chromaticity, and the fact that a
          gamut is a shape with edges rather than a range with limits. The chroma envelope is that
          shape, computed per hue.
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
        Three places where the tool does something its references do not. Each one came out of
        measurement rather than argument, and each can be reproduced from the test suite.
      </p>

      <h3 className="mt-2 text-[13px] font-medium">
        1. The promise is made against shade 50, not against white
      </h3>
      <p>
        Contrast guarantees are conventionally quoted against pure white, but <N>bg-50</N> is the
        background these colours usually sit on. Shade <N>50</N> measures about <N>1.06:1</N>{' '}
        against white, so a promise made against white has already spent 6% of its range before any
        text appears. This tool followed the convention at first. Auditing its own output caught the
        gap:
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
        Each figure is the worst case across the whole palette, not a flattering ramp, and all three
        contracts were failing on the palette's own lightest tint. Re-deriving the rungs against
        shade <N>50</N> fixed that, and since white is lighter than shade <N>50</N> the promise
        against white then comes for free. The cost was about <N>1.5</N> points of lightness (shade{' '}
        <N>600</N> moved from <N>#6563f1</N> to <N>#615fec</N>), and it bought a full step on every
        guarantee: <N>4.5:1</N> now arrives six shades apart instead of seven.
      </p>

      <h3 className="mt-4 text-[13px] font-medium">2. The gamut is computed, not drawn</h3>
      <p>
        Stripe's tool <em>showed</em> designers the unreachable colours as shaded regions so they
        could stay clear of them by eye. Here the boundary is solved for each hue and the ramp is
        held inside it, which is what turns "use 90% of what this hue can manage" into a rule a
        machine can follow. It also means every exported colour has been checked against what a
        screen can display. Browsers clip out-of-range colours instead of mapping them, so the check
        has to happen here or not at all.
      </p>

      <h3 className="mt-4 text-[13px] font-medium">3. A newer colour space, and the evidence for it</h3>
      <p>
        Stripe used CIELAB, which was the right choice in 2019. This tool uses OKLab, published a
        year later. On the lightness axis the two are equivalent, since both are functions of
        luminance alone, so that part is a different spelling and not an improvement. Hue is where
        the choice matters. Holding a hue number constant down a ramp ought to keep the colour
        recognisably the same family, and CIELAB is known to fail at that in the blues.
      </p>
      <p>
        We built the same indigo family both ways on the same luminance staircase, then judged both
        with an independent appearance model.
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
        The pattern holds across ten hues: OKLab's worst case is <N>1.9°</N> of drift, CIELAB's is{' '}
        <N>21.3°</N> and HSLuv's is <N>9.8°</N>. The two appearance models disagree about the
        blue-violet region and neither of them settles it, so the more useful check is one that does
        not depend on choosing an oracle at all. Here is how the generated ramps compare with ramps
        people hand-tuned and shipped.
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
        On every family we could compare, the generated ramp holds its hue better than the
        hand-tuned one. Two cautions if you want to repeat the measurement. Hue angle is meaningless
        at low chroma, so the lightest shades have to be excluded; leave them in and quantisation
        noise roughly doubles every figure. And OKLab and Jzazbz share a lineage, which predisposes
        Jzazbz to agree with OKLab. That is why the Tailwind column carries more weight than the
        Jzazbz one.
      </p>
    </>
  )
}

function TailwindInk() {
  return (
    <>
      <p>
        Tailwind Ink is the closest tool to this one in spirit. You pick a colour and it gives you a
        whole Tailwind-shaped palette: ten hue families, <N>50</N> to <N>900</N>. It gets there a
        different way. Two small neural networks, trained on Tailwind&rsquo;s own colours, predict
        the remaining nine families from the one you picked, then predict each ramp from its family.
      </p>
      <p>
        Its models are open source and ship as plain inference functions, so this comparison could
        be measured instead of argued.{' '}
        <N>scripts/tailwind-ink.mjs</N> downloads the two networks, runs the tool&rsquo;s own
        procedure over <N>180</N> seeds spaced around the hue circle, and measures the{' '}
        <N>1,800</N> ramps that come back the same way the engine measures its own.
      </p>
      <p>
        The credit first, because it is deserved. Every ramp darkened from one shade to the next
        without a stumble, no swatch needed clipping back into sRGB, and shade <N>500</N> cleared{' '}
        <N>3:1</N> in all <N>1,800</N> ramps. Tailwind itself puts <N>20.3</N> points of L* between
        its yellow-500 and its blue-500; the widest spread Tailwind Ink produced at shade{' '}
        <N>500</N> was <N>6.7</N>. Learning from those ramps has smoothed out most of the
        inconsistency in them.
      </p>

      <DataTable
        caption="The three contract shades, measured on each tool's own lightest tint"
        columns={['Shade', 'Promise', 'Tailwind Ink', 'Ramps that miss it', 'This tool']}
        align={[0, 2, 3, 4]}
        rows={[
          ['500', '3:1', '3.31', '0 of 1,800', '3.02'],
          ['600', '4.5:1', '4.32', '9 of 1,800', '4.54'],
          ['700', '7:1', '6.38', '54 of 1,800', '7.10'],
        ]}
      />

      <p>
        Read the first row carefully, because it does not favour us. At shade <N>500</N> Tailwind
        Ink&rsquo;s worst sample of <N>3.31:1</N> is more contrast than our worst case of{' '}
        <N>3.02:1</N>. The difference is not the figure, it is what kind of figure it is. Ours is a
        floor: shade <N>500</N> is placed at the luminance <N>3:1</N> requires, and{' '}
        <N>3.02:1</N> is as close to the line as eight-bit rounding ever pushes it. Theirs is
        wherever <N>1,800</N> samples happened to land. The next two rows show what that
        distinction costs. Nine ramps miss the ratio shade <N>600</N> conventionally implies and{' '}
        <N>54</N> miss it at <N>700</N>, with nothing in the tool to say which ones.
      </p>
      <p>
        The second difference turns up as soon as you have a brand colour to honour. The networks
        predict a palette <em>from</em> your colour; they do not place your colour in one. Across
        all <N>180</N> seeds, not a single palette contained its seed exactly, and the nearest
        colour in the palette sat an average of <N>47</N> RGB units away. Ask for <N>#635bff</N>{' '}
        and the closest thing that comes back is <N>#546edd</N>, which is a different purple.{' '}
        <em>Adjust</em> moves your colour too, but it reports the distance;{' '}
        <em>Keep exact</em> ships your colour untouched and reports what that costs elsewhere.
      </p>
      <p>
        None of this makes Tailwind Ink worse at the job it set out to do. It is quick, it is
        pleasant to use, and if what you want is a palette that feels like Tailwind&rsquo;s, then
        learning from Tailwind is the most direct route there. What it cannot do is tell you what
        its numbers guarantee, because it was never given a number to hit. Two cautions on our
        figures as well: <N>180</N> seeds is a sample and not a proof, and since the networks are
        open, anyone could retrain them against a contrast target and change the answer.
      </p>
    </>
  )
}

function Limits() {
  return (
    <>
      <p>
        Nothing here is free, and the first trade-off below is inherent to the method rather than an
        item on a to-do list.
      </p>
      <p>
        <strong className="font-medium text-ink">
          Equal contrast is not equal apparent lightness.
        </strong>{' '}
        Pinning luminance is what makes the contrast guarantee exact, but luminance is not what the
        eye reports as lightness. Take one shade number across every family and an appearance model
        puts up to <N>4.9</N> units of lightness between the swatches, even though their measured
        contrast is identical. The effect is strongest at mid-ramp, where chroma is highest. Those
        swatches really are interchangeable for contrast, and really are not interchangeable for
        apparent weight. Stripe's method has the same property, and we know of no version of this
        approach that keeps the guarantee and avoids the effect.
      </p>
      <p>
        The rest of the list is shorter. APCA is not a ratified standard and appears here as a
        second opinion only. Output is sRGB: the envelope maths is already gamut-generic and
        Display-P3 is covered by tests, but nothing emits it yet. There is no
        colour-vision-deficiency simulation, so the tool makes no claim about CVD-safe output. And
        past roughly ten families the lightest shades of neighbours start to converge, which the
        tool warns about instead of glossing over.
      </p>
    </>
  )
}

function Checked() {
  return (
    <>
      <p>
        Every claim above is only as good as the measurement behind it, so the checking is part of
        the product.
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
        The colour maths is written from the source papers instead of pulled from a library. That
        costs some code, and it buys tests in which{' '}
        <DocLink to="https://culorijs.org/">culori</DocLink> and the APCA reference package act as
        independent oracles, instead of being both the implementation and its own check. Contrast
        contracts are re-measured on the eight-bit values that ship. Full palettes are snapshotted,
        so any change to the algorithm has to be reviewed and versioned before it can be recorded.
      </p>
      <p>
        The interface has to pass its own audit too. That is why its labels use the WCAG-maximising
        text colour instead of the perceptual one it recommends to you, and why every pass or fail
        mark carries an icon and a word as well as a colour.
      </p>
      <p>
        For what each reported value means, see{' '}
        <DocLink to="/how-to">How to read it</DocLink>.
      </p>
    </>
  )
}
