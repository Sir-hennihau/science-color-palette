import { createFileRoute } from '@tanstack/react-router'

import { DataTable, DocLink, DocPage, N, Term, Terms } from '../components/DocPage.tsx'

export const Route = createFileRoute('/how-to')({
  head: () => ({
    meta: [
      { title: 'How to read it — Science Color Palette' },
      {
        name: 'description',
        content:
          'Every number the palette tool reports, what it measures, and what to do with it: ' +
          'shade numbers, OKLCH, relative luminance, WCAG ratios, APCA Lc and the chroma envelope.',
      },
    ],
  }),
  component: HowTo,
})

function HowTo() {
  return (
    <DocPage
      title="How to read it"
      standfirst={
        <>
          The tool reports a lot of numbers. Every one of them is measured on the colour that ships,
          not on the higher-precision colour the solver aimed at. This page explains what each
          number means and what to do with it. The entries are independent, and each one names where
          the value appears.
        </>
      }
      sections={[
        { id: 'shade-numbers', title: 'Shade numbers', body: <ShadeNumbers /> },
        { id: 'swatch', title: 'Reading one swatch', body: <SwatchValues /> },
        { id: 'contrast', title: 'The two contrast rulers', body: <ContrastValues /> },
        { id: 'guarantees', title: 'The guarantees', body: <Guarantees /> },
        { id: 'controls', title: 'The controls', body: <ControlValues /> },
        { id: 'limits', title: 'The limits of each hue', body: <Limits /> },
        { id: 'warnings', title: 'When the tool warns you', body: <Warnings /> },
      ]}
    />
  )
}

function ShadeNumbers() {
  return (
    <>
      <p>
        Every family runs from <N>50</N> to <N>950</N>. The number is a position on one shared
        lightness scale, not a description of the colour. Shade <N>600</N> in the yellows and shade{' '}
        <N>600</N> in the blues sit at the same relative luminance, and relative luminance is the
        only quantity WCAG contrast depends on. So you can pick a shade by number and know what its
        contrast will be before you have looked at it.
      </p>
      <p>
        The consequence takes some getting used to: a shade number tells you how <em>readable</em> a
        colour is, never how colourful. A yellow at <N>600</N> is a dark ochre, because that is what
        yellow looks like at that luminance. If it looks wrong, the number is doing its job and the
        expectation came from a palette where the numbers were never consistent to begin with.
      </p>
      <p>
        Asking for fewer or more shades re-samples the same underlying curve instead of
        redistributing it, so any shade two ramps have in common stays identical.
      </p>
    </>
  )
}

function SwatchValues() {
  return (
    <Terms>
      <Term name="#615fec" where="swatch, and the large readout in the panel">
        <p>
          The colour that ships, rounded to the eight bits a screen actually has. Everything else on
          the panel is measured on this value and never on the higher-precision one the solver
          found, so you can reproduce any figure here from the hex alone. Click any swatch to copy
          it.
        </p>
      </Term>

      <Term name="OKLCH" where="swatch panel">
        <p>
          Lightness, chroma and hue in the space the palette is built in. <N>L</N> runs 0–100% and
          is roughly perceptual; <N>C</N> is colourfulness, where sRGB tops out near <N>0.32</N> and
          only for a few hues; <N>H</N> is the hue angle in degrees, the same number shown beside a
          family's name.
        </p>
        <p>
          Chroma has no fixed maximum, because the maximum depends on the other two numbers. See{' '}
          <DocLink to="/how-to#limits">the limits of each hue</DocLink>.
        </p>
      </Term>

      <Term name="RGB" where="swatch panel">
        <p>The same colour as three 0–255 channels, for tools that want it that way.</p>
      </Term>

      <Term name="Luminance" where="swatch panel">
        <p>
          Relative luminance: how much light the colour emits, on a scale where black is <N>0</N>{' '}
          and white is <N>1</N>. It is not the same thing as lightness. A saturated blue and a mid
          grey can look nothing alike and still carry the same luminance, and WCAG will score them
          identically, because luminance is all its formula uses.
        </p>
        <p>
          This is the number the whole palette is built on. Fix it and contrast is fixed with it,
          which leaves hue, chroma and family free to vary underneath.
        </p>
      </Term>
    </Terms>
  )
}

function ContrastValues() {
  return (
    <>
      <p>
        Every pair is measured twice, because the two rulers disagree in ways worth seeing. WCAG 2
        decides pass and fail; it is the one with legal force behind it. APCA is the better
        predictor of what a reader can actually make out, so it sits alongside WCAG rather than
        replacing it.
      </p>

      <Terms>
        <Term name="4.82:1" where="the WCAG column, everywhere">
          <p>
            The WCAG 2 contrast ratio, from <N>1:1</N> (identical) to <N>21:1</N> (black on white).
            The thresholds are <N>3:1</N> for large text, icons and borders, <N>4.5:1</N> for body
            text, and <N>7:1</N> for body text at the strictest level.
          </p>
          <p>
            Its known weakness is dark pairs and mid-tones, where it overstates how readable dark
            text is. That weakness is the reason for the second ruler.
          </p>
        </Term>

        <Term name="Lc 73" where="the APCA column, and the panel's plain-language line">
          <p>
            APCA lightness contrast, running to about <N>106</N>. It takes into account which colour
            is the text and which is the background, so the same pair scores differently in each
            direction. The WCAG ratio cannot express that distinction at all.
          </p>
          <DataTable
            caption="APCA levels and what each is usable for"
            columns={['Lc', 'Usable for']}
            align={[0]}
            rows={[
              ['90', 'Comfortable for body text'],
              ['75', 'The minimum for body text'],
              ['60', 'Headings and labels'],
              ['45', 'Large text only'],
              ['30', 'The floor for any text at all'],
              ['15', 'Shapes and borders only'],
            ]}
          />
          <p>
            APCA is <em>not</em> a ratified standard. It was removed from the WCAG 3 drafts and what
            replaces it is undecided. Treat it as a second opinion, and never as a reason to ship
            something that fails WCAG.
          </p>
        </Term>

        <Term name="on white / on black" where="swatch panel">
          <p>
            The two extremes. Check them together, because a colour that works on white will often
            fail on black. The panel reports both instead of assuming which surface you are
            designing for.
          </p>
        </Term>

        <Term name="on indigo 50" where="swatch panel">
          <p>
            The same shade measured against its own family's lightest tint, since that is the
            background this colour will usually sit on rather than pure white. It is a slightly
            harder test. Shade <N>50</N> measures around <N>1.06:1</N> against white, so it uses up
            about 6% of the available range before any text is drawn.
          </p>
          <p>
            The tool's own guarantees are set against this value instead of against white, so the
            promise holds on the background you will actually use.
          </p>
        </Term>

        <Term name="Best with white text" where="swatch panel">
          <p>
            Which of black or white to put on this colour. There are two answers, and on mid-tones
            they genuinely differ: the perceptual pick, from APCA, and the pick that maximises the
            WCAG ratio. The recommendation on screen is the perceptual one. The exports carry both,
            so anything that has to pass an audit can use the WCAG pick, which never falls below{' '}
            <N>4.58:1</N>.
          </p>
        </Term>
      </Terms>
    </>
  )
}

function Guarantees() {
  return (
    <>
      <p>
        Three positions on the scale are contracts, not aesthetic choices. Their luminance is
        derived from a target contrast ratio, so a shade landing on one is solved until it reaches
        that ratio, then re-measured on the eight-bit value that ships.
      </p>

      <DataTable
        caption="The three contract shades and what each promises"
        columns={['Shade', 'Promise', 'Measured against', 'Use it for']}
        align={[0]}
        rows={[
          ['500', '3:1', 'shade 50', 'Large text, icons, borders'],
          ['600', '4.5:1', 'shade 50', 'Body text'],
          ['700', '7:1', 'shade 50', 'Body text, strictest level'],
        ]}
      />

      <p>
        They hold in every hue in the palette, which is what the shared scale is for, and they are
        marked on the board above the ramps so you do not have to remember them. Since shade{' '}
        <N>50</N> is darker than white, a promise made against shade <N>50</N> also holds against
        white. The reverse does not follow, which is why palettes that quote a figure against white
        often miss it on their own lightest tint.
      </p>

      <Terms>
        <Term name="Steps apart" where="Contrast panel">
          <p>
            The other half of the guarantee. Every ramp climbs the same scale, so the distance
            between two shade numbers predicts their contrast in any hue and across any two
            families. With the default eleven shades, <N>5</N> steps apart clears <N>3:1</N>,{' '}
            <N>6</N> clears <N>4.5:1</N> and <N>7</N> clears <N>7:1</N>.
          </p>
          <p>
            The table reports the worst case found anywhere in the palette at that distance, not an
            average, so it is safe to use as a rule. Change the number of shades and these distances
            change with them; the table always shows the current figures.
          </p>
        </Term>
      </Terms>
    </>
  )
}

function ControlValues() {
  return (
    <Terms>
      <Term name="Families" where="control band">
        <p>
          How many hue families to generate. Your own colours are fixed anchors; the rest are shared
          out around the wheel in proportion to the gaps between those anchors, then named after the
          nearest free colour name. More families means less distance between neighbours. Past ten
          or so, the lightest shades of adjacent families begin to converge, and the tool says so
          when they do.
        </p>
      </Term>

      <Term name="Shades" where="control band">
        <p>
          Steps per family, from <N>5</N> to <N>15</N>. Eleven reproduces the familiar{' '}
          <N>50</N>–<N>950</N> set.
        </p>
      </Term>

      <Term name="Colourfulness" where="control band">
        <p>
          How much of each hue's available chroma to use: <em>Muted</em>, <em>Natural</em> or{' '}
          <em>Vivid</em>. The setting is a share, not a fixed amount, which is why one value works
          for every hue. Asking for "90% of whatever this hue can manage here" produces a yellow
          ramp that peaks light and a blue one that peaks dark, with no special cases for either.
        </p>
        <p>
          The lightest shades are the exception. They are held to a fixed small chroma, because just
          past a hue's most vivid point the available chroma falls away so steeply that a share
          stops restraining anything. Holding them absolutely is what gives curated palettes their
          consistently barely-tinted <N>50</N>s.
        </p>
      </Term>

      <Term name="Hue drift" where="control band">
        <p>
          Degrees of hue rotation across a whole ramp, up to <N>60</N>, and zero by default.
          Hand-tuned palettes use more of this than you might guess: Tailwind's yellow rotates about{' '}
          <N>44°</N> from its lightest shade to its darkest, which is what makes its dark shades
          read as brown instead of olive.
        </p>
      </Term>

      <Term name="Grey tint" where="control band">
        <p>
          How far the greys lean toward your first colour. A pure grey next to a saturated brand
          colour reads as dead, so most good systems tint their neutrals very slightly. This control
          is an absolute amount rather than a share, which keeps the greys equally restrained
          whichever hue they lean toward.
        </p>
      </Term>

      <Term name="Adjust / Keep exact" where="beside each colour you enter">
        <p>
          <em>Adjust</em> treats your colour as an intention: it keeps the hue and the sense of
          colourfulness but moves the shade onto the shared scale, so every guarantee holds. The
          panel says how far it moved.
        </p>
        <p>
          <em>Keep exact</em> treats it as a requirement. Your colour ships byte for byte and the
          ramp bends around it: warped scale, rescaled chroma, hue anchored on yours. That ramp no
          longer shares the palette's lightness scale, so it may break the contrast contracts. Any
          contract that breaks is measured on the shipped colour and reported. This is never silent.
        </p>
      </Term>
    </Terms>
  )
}

function Limits() {
  return (
    <>
      <p>
        For each hue, the third panel draws every colour a screen can actually show at that hue,
        with lightness running left to right and colourfulness bottom to top. The shape of that
        region is the reason a palette cannot be built by scaling numbers.
      </p>

      <Terms>
        <Term name="The envelope" where="Limits of each hue">
          <p>
            The filled region. Its width is the full lightness range, and its height at any point is
            the most chroma that hue can reach there. Your ramp is drawn through it as a line, so
            you can see how much of the available colour it is using and where it runs out.
          </p>
        </Term>

        <Term name="Most vivid at 62% lightness" where="under each plot">
          <p>
            The <em>cusp</em>: the lightness at which this hue is at its most colourful. It sits
            high for yellow, since there is no such thing as a dark vivid yellow, and low for blue,
            whose most vivid form is dark. That difference is the whole reason colourfulness has to
            be expressed as a share of what is available. As a fixed number, no single setting could
            suit both hues.
          </p>
        </Term>

        <Term name="Hue angle" where="beside each family name">
          <p>
            Where the family sits on the colour wheel, in degrees. It is useful for judging how far
            apart two families really are, with one caveat: equal angles are not equal perceptual
            distances. At a fixed spacing, the gap between neighbours varies by about a factor of
            two around the circle.
          </p>
        </Term>
      </Terms>
    </>
  )
}

function Warnings() {
  return (
    <>
      <p>
        Anything the tool cannot deliver, it tells you about. These messages appear under the
        palette instead of in a dialogue, because they describe the result rather than block it.
      </p>

      <Terms>
        <Term name="below usual contrast" where="beside a family name, and on the swatch">
          <p>
            A shade that does not reach the ratio its position normally guarantees. This can only
            happen when a colour is kept exactly, because that is the one mode that gives up the
            shared scale. The message names a shade in the same ramp that does reach the ratio.
          </p>
        </Term>

        <Term name="own lightness scale" where="beside a family name">
          <p>
            This ramp was warped around an exact colour, so its shades no longer line up with the
            rest of the palette. The main steps-apart table does not describe it, and it carries its
            own instead.
          </p>
        </Term>

        <Term name="adjusted at 600" where="beside a family name">
          <p>
            Where your colour landed, and whether it had to move to get there. <em>matched</em>{' '}
            means the change is imperceptible; <em>adjusted</em> means it is visible, and the panel
            will tell you by how much.
          </p>
        </Term>

        <Term name="families are indistinguishable" where="under the palette">
          <p>
            You have asked for more families than the light end can carry. The lightest shades are
            deliberately barely tinted, so hues run out of room to differ there long before they do
            at mid-ramp. The mid shades will still be distinct; the <N>50</N>s and <N>100</N>s will
            not.
          </p>
        </Term>
      </Terms>

      <p>
        For where the method comes from and what it does differently, see{' '}
        <DocLink to="/about">About</DocLink>.
      </p>
    </>
  )
}
