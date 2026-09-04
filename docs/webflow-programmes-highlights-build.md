# Programmes Highlights — Webflow build guide

How the "Programmes Highlights" section (the horizontal band + rotary card
wheels, reverse-engineered from Figma node `1897:29690`) is built in the
Webflow Designer. Read `docs/horizontal-scroller.md` first — it documents the
JS components (`horizontalScroller.js`, `rotaryWheel.js`) this build wires up
to. This doc is the Designer-side counterpart: element tree, Client-First
class names, and the Webflow-specific gotchas hit while building it.

Live on the Home page, immediately after `section_highlights` (Key
Highlights) and before the footer.

---

## Element tree

Client-First naming: BEM-ish, one block prefix (`prog-highlights`) shared by
every class in the component, state as a combo (`is-*`).

```
section.section_programmes-highlights.prog-highlights_scroller   [data-hscroll-init]
└ div.prog-highlights_viewport                                   [data-hscroll-viewport]
  └ div.prog-highlights_track                                    [data-hscroll-track]
    ├ div.prog-highlights_panel.is-intro                              60vw
    │ └ div.prog-highlights_intro-content
    │   ├ div.prog-highlights_eyebrow
    │   │ └ div.prog-highlights_eyebrow-icon
    │   ├ h2.prog-highlights_title.heading-style-h2        "Programmes"
    │   ├ h2.prog-highlights_title.heading-style-h2        "Highlights"
    │   └ p.prog-highlights_body.text-size-regular
    │
    ├ div.prog-highlights_panel.is-intro-media          calc(40vw + 15rem)
    │ └ div.prog-highlights_intro-media
    │   └ img.prog-highlights_intro-image
    │
    ├ div.prog-highlights_panel.is-title                             100vw
    │ └ div.prog-highlights_copy
    │   └ h3.prog-highlights_copy-heading.heading-style-h6
    │
    ├ div.prog-highlights_panel.is-thematic.is-wheel                  [data-rotary-wheel-init]
    │ └ div.prog-highlights_stage                                     [data-rotary-wheel-stage]
    │   ├ div.prog-highlights_disc.is-thematic              [aria-hidden="true"]
    │   └ div.prog-highlights_hub                                     [data-rotary-wheel-hub]
    │     └ div.prog-highlights_item × 4                              [data-rotary-wheel-item]
    │       └ div.prog-highlights_card
    │         ├ div.prog-highlights_card-index                        "01"…"04"
    │         ├ h3.prog-highlights_card-heading.heading-style-h6
    │         └ p.prog-highlights_card-body.text-size-small
    │
    ├ div.prog-highlights_panel.is-title       (community heading)
    ├ div.prog-highlights_panel.is-community.is-wheel   (same shape, 4 cards)
    ├ div.prog-highlights_panel.is-title       (impact heading)
    └ div.prog-highlights_panel.is-impact.is-wheel      (same shape, 3 cards)
```

Eight panels, alternating: the intro splits into a title panel and an image
panel, and every wheel is preceded by its own title panel. A title panel holds
nothing but that section's `prog-highlights_copy` heading — the `is-title`
combo is shared by all three, so no per-section combo is needed.

`prog-highlights_intro-media` now holds a real `img.prog-highlights_intro-image`.
`prog-highlights_eyebrow-icon` is still a flat teal-main placeholder — swap in
a real image via `set_image_asset` (or the Designer) once AVPN supplies one;
the class already carries the sizing/radius/`background-size: cover` a
background-image needs.

Per this build's brief, the dotted connector curve and the intro's arrow
button from the Figma were **not** built — the section works without them.
`drawPathScroll` (already band-aware, see `docs/horizontal-scroller.md`) is
the natural home for the connector whenever it's added.

---

## The structural CSS — set directly on Webflow classes, not a page embed

`docs/horizontal-scroller.md` says the sticky/`max-content` rules belong in
the `.page-style` embed because the Designer "can't express them cleanly."
That's true of the Designer's *visual* style panel, but the underlying
properties are still ordinary CSS — so this build set them as literal
properties on the Webflow classes themselves, via the style tool, instead of
writing an embed:

```
.prog-highlights_viewport { position: sticky; top: 0; height: 100vh; overflow: hidden; }
.prog-highlights_track    { display: flex; flex-wrap: nowrap; width: max-content; height: 100%; }
.prog-highlights_stage    { position: relative; overflow: hidden; width: 100vw; height: 100%; }
.prog-highlights_hub      { position: absolute; width: 0; height: 0; left: 50%; top: 50%; }
.prog-highlights_item     { position: absolute; left: 0; top: 0; }
```

Same outcome as the embed, discoverable in the Designer's Style panel like
any other class. If a future edit needs the embed instead (e.g. a property
the Style panel genuinely can't set), that's still the documented fallback.

**Panel width is the pin distance**, same rule as the generic component doc:
a wheel panel is `100vw` plus roughly one viewport-height of scroll per card
step. Built here as:

| Panel | Cards | Width |
|---|---|---|
| Intro title | — | `60vw` (`is-intro`) |
| Intro image | — | `calc(40vw + 15rem)` (`is-intro-media`) |
| Title × 3 | — | `100vw` (`is-title`, same as the panel default) |
| Thematic areas | 4 | `calc(100vw + 240vh)` |
| Community | 4 | `calc(100vw + 240vh)` |
| Impact | 3 | `calc(100vw + 160vh)` |

Each is set on that panel's own 3-way combo (`.prog-highlights_panel.is-*.is-wheel`),
not on `.prog-highlights_panel` itself — only wheel panels have a pin distance.

**The image panel's width is load-bearing.** `is-intro-media` is
`calc(40vw + 15rem)` and `.prog-highlights_intro-media` sits at `right: 0`, so
the image's centre lands exactly `60vw + 40vw` from the band's start — the fold
at rest. The result is an image cut precisely in half on screen, with the rest
revealed as the band scrolls.

The `15rem` is half the image's own `30rem` width, and it is what keeps the
image inside its own panel rather than overhanging the title panel that
follows. An earlier version used a plain `40vw` panel with `right: -15rem`,
`overflow: visible` and `z-index: 2`; that halved the image correctly but left
its right half sitting on top of the first title panel's copy as soon as the
band moved. Widening the panel to contain the overhang gives the identical
at-rest framing with no overlap and no stacking-context tricks.

If either intro width changes, the image is no longer halved: the invariant is
`is-intro width + is-intro-media width − 15rem = 100vw`.

## The wheel panels — centred, on a colored disc

Panels themselves are transparent: the section carries a gradient on
`.section_programmes-highlights.prog-highlights_scroller`, and every panel sits
on top of it. Color comes from the disc instead, one combo per section:

| Wheel | Disc combo | Variable |
|---|---|---|
| Thematic | `.prog-highlights_disc.is-thematic` | `Brand/Secondary/teal-main` |
| Community | `.prog-highlights_disc.is-community` | `Brand/Primary/red-light` |
| Impact | `.prog-highlights_disc.is-impact` | `Brand/Secondary/emerald-main` |

The disc is centred on the hub (`left/top: 50%`, `translate(-50%, -50%)`) at
`120vh` square and full opacity, so it bleeds off the top and bottom of the
stage and reads as a field rather than a shape — the pattern from
days.christou1910.com, where a card turns on a large flat circle. The hub sits
at `left: 50%` to match, rather than the `62%` it used when the section's copy
shared the stage with it.

Card colour is scoped the same way, but from the `.page-style` embed rather
than the style tool: `.prog-highlights_card` is one class shared by all eleven
cards, so the only thing that separates them is the panel's `is-*` state, and a
descendant selector is precisely what the Designer's Style panel cannot write.
Each panel sets `--card-surface` (the section's *lightest* tint, so the card
reads as a pale tile on the saturated disc) and `--card-accent` (the disc's own
colour); the card and its icon/index read those. Adding a fourth section means
one rule, not four.

The embed also repaints the card's text navy — the Webflow class sets it white,
which was survivable over a transparent card and unreadable on a light tint.
Same specificity, later in the cascade, so no `!important` is needed.

The thematic cards carry `prog-highlights_card-icon` (a 3.5rem circle, flat
`--card-accent` until real icon art lands, same placeholder pattern as
`prog-highlights_eyebrow-icon`) *instead of* `prog-highlights_card-index`.
Community and impact keep the numeric index. Both are painted `--card-accent`,
so whichever a card uses, its top line is the section's colour.

Note the disc's `is-*` names are the same three used by the panel combos, but
they are separate combos under a different base class
(`.prog-highlights_disc.is-thematic` vs `.prog-highlights_panel.is-thematic`).
Webflow accepted both, contrary to what gotcha #2 below would predict.

---

## Rebuilding or extending this

- **Card count changes.** Add/remove a `.prog-highlights_item` under the
  panel's `.prog-highlights_hub`; the wheel component reads card count from
  the DOM. Re-check the panel's `width` (see the pin-distance table above) —
  it doesn't auto-adjust.
- **New panel.** Duplicate `is-thematic` (or `is-community`/`is-impact`) as a
  combo pattern: `create_style` a new `is-<name>` combo under
  `prog-highlights_panel`, then a second `is-<name>.is-wheel` 3-way combo for
  the width/pin-distance override.
- **Verify after any bulk build.** Query for Webflow's default placeholder
  strings (`"This is some text inside of a div block."` for Text Blocks,
  `"Heading"` / `"Lorem ipsum"` for others) across the section before calling
  it done — see gotcha #4.
