# Wheelworks design system

Taken from the implemented source: `src/styles.css` (tokens and all component CSS), `src/ui/art.tsx`
(tile and icon artwork), `src/ui/Board.tsx` (board and pulse layer) and `src/App.tsx` (screen
composition). Values below are copied from those files.

## Overview

Wheelworks is a single-screen puzzle game for the Squeekchain community, played on phones and desktops.
Its character is a warm clockwork workshop drawn on a blueprint: cream paper surfaces and brass
controls around a deep-blue blueprint board, with brick walls, brass conveyor tracks and an original
hamster-in-a-wheel motif. The game board is always the largest element; text is short and practical.
Hierarchy is: board, then run controls (Start/Step/Reset) and the run status, then the parts tray,
then tutorial and reference notes. Nothing overlays the board or the controls.

## Colors

All colors are hex custom properties on `:root` in `src/styles.css`.

| Token | Value | Job |
| --- | --- | --- |
| `--paper` | `#f7f0e1` | Page background (also `theme-color` in `index.html`) |
| `--surface` | `#fffaf0` | Buttons, tool tiles, status line, cards (coach, notes, source card) |
| `--ink` | `#2b2118` | Primary text, active mode tab background |
| `--ink-2` | `#5b4a3a` | Secondary text (goal, hints, fine print, disabled button text) |
| `--line` | `#d9c9a8` | Default borders of buttons, tabs, chips, tools, fields |
| `--brass` | `#8a5a12` | Accent: primary button fill, outline-button border and text, board frame, active chip, selected tool border |
| `--brass-hover` | `#6f4709` | Primary button hover (only on hover-capable pointers) |
| `--brass-soft` | `#f1dfb8` | Outline-button hover, selected tool fill |
| `--blueprint` | `#1e3a5c` | Board background |
| `--blueprint-line` | `#3d6290` | Board grid lines and floor crosshair marks |
| `--floor` | `#24466d` | Floor tiles and tool icon wells |
| `--ok` / `--ok-soft` | `#1f6b3d` / `#e3f1e6` | Solved status, met quotas, solved level chips, done tutorial steps |
| `--bad` / `--bad-soft` | `#b3261e` / `#fbe5e2` | Failed status, error banner, Remove tool icon |
| `--focus` | `#0b57d0` | Focus outline everywhere; links in the source card |

Artwork colors live in `src/ui/art.tsx` and are fixed, not themed: brass track `#d9a441` with outline
`#5c3b0c`, walls `#5a4636` with mortar `#3b2d22`, hamster fur `#e9b872`, belly `#fbe6c4`, outline
`#4a2f17`, pulses `#ffd166`, fault marker `#c0281c` on white. Status never relies on color alone:
solved and failed states add a check or cross icon and words, met quotas add "(met)" and a check on
the device tile, faults add a dashed ring with an exclamation mark, walls carry a brick pattern,
hinted tutorial tiles use a dashed outline, the alternator's next output is a solid arrow and the
other an outline arrow.

There is no dark theme.

## Typography

- Family: `ui-rounded, "SF Pro Rounded", "Segoe UI", system-ui, -apple-system, Roboto, sans-serif`
  on `:root`, inherited by every control and SVG text. No web font ships; on systems without a rounded
  UI face the system sans-serif renders (the probe's Linux Chromium reported the family but the face
  is a system fallback).
- Weights: 400 body, 600 buttons, tabs, tool names and summaries, 700 brand, level title, badges and
  SVG lettering.
- Scale (rem tokens): `--fs-1` 13px counts, fine print, log; `--fs-2` 15px body and buttons (set on
  `body`); `--fs-3` 17px section headings (Tutorial, Workshop notes, challenge title); `--fs-4` 21px
  brand name and level title; `--fs-5` 26px reserved for SVG tile letters (device letters use SVG
  user units sized 26 and 21 to match the scale).
- Line height 1.45 on `:root`, 1.2 on the level title. No letter-spacing and no all-caps.
- Headings use `text-wrap: balance`; paragraphs and list items use `text-wrap: pretty`.

## Layout

- Spacing tokens: `--space-1` 4px, `--space-2` 8px, `--space-3` 12px, `--space-4` 16px, `--space-5` 24px.
  Gaps between related controls are 8px; between sections 12px; page side padding 16px.
- `.app` is centered with `max-width: 1180px`.
- Mobile first (`.play` grid, one column) in this order: level head (title, goal, device quotas),
  board, run controls with status, parts tray, tutorial, notes. At 390 px the first screen shows the
  title, goal, board and Start/Step/Reset.
- From `min-width: 900px`: two columns `minmax(0, 1fr) 380px`; the board spans the left column and is
  `position: sticky` so it stays visible while the right column (head, run, tray, coach, notes) scrolls.
- The level chip row is a 7-column grid (`auto repeat(6, minmax(36px, 1fr))`, 52px chips on desktop)
  with 40px below it so the chips are not read as a label for the level title.
- The board is a CSS grid with `aspect-ratio: w / h`, square cells and `max-width: 600px`; it scales to
  the column width. Pulses are drawn in an absolutely positioned SVG overlay in board units (100 per tile).
- Checked widths: 320, 390, 1280 and 1440 px with no horizontal scroll.
- Physical margin properties are written as logical ones (`margin-block-*`, `padding-inline-start`).

## Elevation & Depth

Flat. Surfaces separate by tone (`--surface` on `--paper`) and 2px borders, never by drop shadows.
The only inset shadows are the board grid lines (`inset 0 0 0 1px`), the selected tool (`inset 0 0 0
2px var(--brass)`) and the focused tile ring. The focused board tile is raised with `z-index: 2`.

## Shapes

- `--radius` 10px: board inner corners, coach/notes/source cards.
- `--radius-sm` 8px: buttons, tabs, chips, tools, fields, banners, status line.
- Board frame: 14px radius with 6px brass padding.
- Circles: device badges, tutorial step markers, pulses. Tile artwork uses rounded rectangles
  (wheel housing 14, device 10, wall 6 in SVG units).
- Minimum interactive height `--tap` 44px for every button, tab, chip, select and field; tools are 88px tall.

## Components

| Component | Source | Use and states |
| --- | --- | --- |
| Button `.btn` | `src/styles.css` | Outline button: brass border and text on surface. `.btn-primary` filled brass with white text (one per group: Start, Next level, Start challenge). `.btn-quiet` neutral border for secondary tools (Mute, Clear all parts, Copy share link). Disabled: dashed `--line` border, `--ink-2` text, `cursor: not-allowed`. Hover tints only under `@media (hover: hover)`. |
| Mode tabs `.modes .tab` | `src/App.tsx`, `src/styles.css` | Two equal buttons; the current one is `.tab-on` (ink fill) with `aria-current="page"`. |
| Level chips `.level-pick .chip` | same | "Learn" plus 1 to 6. `.chip-on` brass fill and `aria-current`; `.chip-done` green border plus check icon and ", solved" in the accessible name. |
| Board `Board` | `src/ui/Board.tsx` | Grid of `<button class="cell">` with roving tabindex. Arrow keys move, Enter/Space applies the tool, R rotates, Delete removes. Each cell's `aria-label` describes contents, orientation, alternator next output, device count and any fault. `.cell-hint` dashed outline for tutorial targets. Focus: white outline plus 6px blue inset ring. |
| Tile art | `src/ui/art.tsx` | `SourceTile` (hamster wheel with direction arrow, spins while running unless motion is reduced), `TargetTile` (letter, count, socket notches, check when met), `WallTile` (bricks), `PieceArt` (straight, elbow, alternator with solid next arrow), `FaultMark`. |
| Pulse layer | `src/ui/Board.tsx` `PulseLayer` | Numbered amber dots interpolated between ticks with `requestAnimationFrame`; red when faulted; positions jump per tick when motion is reduced. Never affects the simulation. |
| Run controls `.run` | `src/App.tsx` | Start/Pause/Resume (primary), Step, Reset; status line `.status` (`role="status"`, polite) with `.status-won` and `.status-failed` variants; after a run, "Run it again"/"Reset and try again" and "Next" buttons. |
| Parts tray `.tray .tool` | same | Toggle buttons with `aria-pressed`, icon, name and "n of m left". Only parts the board provides are shown, plus Remove. Notice line below is a stable polite live region (hidden when empty). |
| Source card `.source-card` | `src/App.tsx` `ChallengePanel` | Settlement or offline details, explorer link, start/switch buttons, fallback reason. |
| Coach `.coach` | `src/App.tsx` `tutorialSteps` | Ordered steps that tick themselves off from game state. |
| Notes `.rules` | same | Level hint, rules `<details>`, motion `<select>`, machine log `<details>`. |

## Do's and Don'ts

- Do start a new screen from `.app` and the `.play` grid areas; keep the board first on mobile and
  never cover it or the run controls with overlays.
- Do use `.btn-primary` for the one main action in a group and `.btn` or `.btn-quiet` for the rest.
- Do pair every status color with an icon or words; use `--ok` and `--bad` only for outcomes.
- Do use the `--fs-*` and `--space-*` tokens; the page currently renders four text sizes and should
  stay at six or fewer.
- Do draw new art as inline SVG in `src/ui/art.tsx` with `aria-hidden` and describe it in the owning
  control's accessible name; record it in `ASSETS.md`.
- Don't add letter-spacing, all-caps labels, drop shadows or gradient text.
- Don't animate anything forever; gate motion behind the Motion setting and `prefers-reduced-motion`.
- Recipe for another page: add a mode to the `.modes` nav, render a `<section>` inside `.app` using
  `.source-card` or `.coach`-style surfaces for content and `.btn` variants for actions, and reuse
  `Board` with any `Level` built by `buildLevel` in `src/game/levels.ts`.
