# Wheelworks design system

## Overview

Wheelworks is a playable hamster clockwork workbench, for puzzle players in the Squeekchain
community. A warm ivory bench surrounds a deep navy blueprint grid; restrained brass/copper
tracks, enamel device faces and a friendly original hamster give the mechanism its character.
The game is the first screen. There is no marketing hero or separate landing page.

`src/styles.css` is the canonical token/component source. `src/App.tsx` assembles the workbench;
`src/ui/Board.tsx` handles accessible cells and pulse rendering; `src/ui/art.tsx` supplies the
original SVG family. The simulator's timing is independent of visual effects.

## Colors

| Token | Value | Role |
| --- | --- | --- |
| `--paper` | `#f3eee4` | Page, secondary controls and status background |
| `--surface` | `#fffcf5` | Workbench and enamel device surfaces; Start label |
| `--ink` | `#192d3b` | Main text, selected level |
| `--ink-2` | `#56616a` | Supporting copy, counts, disabled labels |
| `--line` | `#d2c9b8` | Structural dividers, secondary control borders |
| `--brass` | `#845025` | Primary action, selected-tool outline, tutorial guide |
| `--brass-hover` | `#633b1c` | Primary hover |
| `--brass-soft` | `#f0dfc1` | Selected tool, current tutorial instruction, save warning |
| `--blueprint` | `#132a3a` | Board frame, wall plate |
| `--blueprint-line` | `#3e5969` | Grid registration and wall bracing |
| `--floor` | `#203d50` | Playable floor and tray preview |
| `--ok` / `--ok-soft` | `#24634e` / `#e5f1e7` | Solved and quota-met text/background |
| `--bad` / `--bad-soft` | `#a0302d` / `#fbeae5` | Fault/error text/background |
| `--focus` | `#185bb7` | Keyboard focus on light surfaces and links |

SVG rail fill is `#dfb678`, with copper `#7a4b27` edges; sockets/pulses use warm yellow.
The hamster retains tan fur and pink ears. These are illustration colors, not extra UI statuses.

Computed opaque token contrasts: body/workbench 13.8:1, secondary/paper 5.5:1, Start label/brass
6.5:1 (rounded; exact measurements and rendered probe coverage are in TEST_REPORT.md).
There is one light interface, with a navy game board; no alternate theme was added.

## Typography

System stack: `"Segoe UI", system-ui, -apple-system, sans-serif`; no downloaded fonts.
Weights are 400 body, 600 controls/labels and 700 titles/strong counters. The stack resolves on
each platform; requesting a family is not a guarantee that its font is installed.

The five source sizes are `--fs-1: .8125rem` (13px compact game labels/notes), `--fs-2: .9375rem`
(15px body/buttons), `--fs-3: 1rem` (16px tray/notes headings and form controls), `--fs-4: 1.375rem`
(22px level/mobile brand), `--fs-5: 1.75rem` (28px desktop brand). SVG lettering follows its viewBox.
Body line height is 1.5; headings 1.2. Brand tracking is −.04em; level titles −.02em; prose uses
natural spacing. Headings balance; paragraphs wrap naturally/pretty. Source hashes wrap anywhere
and are fully selectable. Dynamic counts and status use tabular numbers. Inputs/selects remain
16px to avoid unwanted mobile input zoom. There are no tracked uppercase kicker labels.

## Layout

Spacing tokens: 4, 8, 12, 16 and 24px. The desktop app is at most 1080px wide, with 24px gutters.
One ivory `.play` workbench groups goals, framed board, tray, controls and status. At 800px and
above it uses a flexible board column and 340px control column, with 28px between columns.
Title/quotas span the bench. Board sits left, parts then run controls then secondary layout
controls right. Tutorial and notes are below; none are sticky or cover cells.

Below 800px the app is at most 580px with 12px gutters. Workbench padding becomes 12px. Reading
and display order are title/quotas → board/current tutorial instruction → parts → run/status →
secondary layout/share actions → full tutorial → notes/log. CSS grid positions the controls without
removing native DOM semantics. The board is never behind a fixed dock. Level navigation wraps;
there is no hidden horizontal level scroller.

At 420px and below, board width is bounded by `36svh`; active challenges use
`min(100%, max(280px, 33svh))` to retain useful cell size. Challenge goal prose is omitted at this
width because the device quota list and pulse count already state the complete goal. Provenance
is a compact round/tier row and a native details disclosure; retry timing and Retry now stay visible.
On 390×844 the active offline board, tray and run row fit the first viewport. At 320px, short
screens, enlarged text or zoom, the page scrolls normally instead of shrinking controls into a dock.
Rendered coverage: 320, 390, 1024 and 1440 widths, plus 200% CSS zoom. Native browser zoom and
physical device behavior are explicitly not verified.

## Elevation & Depth

The bench has a soft `0 4px 24px #192d3b0b` shadow. The board frame uses `0 3px 0 #a48a64` as its
machined edge and `0 8px 16px #192d3b14` for depth. Grid lines are inset half-pixel strokes;
registration crosses stay subtle. Structural borders divide headers/notes; selected parts use
an outline, not extra panels. The framed board inside the workbench is intentional game housing,
which the generic taste probe classifies as a nested card (documented exception).

## Shapes

Shared radii: 12px general surface, 6px control. Desktop workbench radius is 18px with 24px
padding; mobile bench is 12px with 12px padding. Board frame is 16px with 10px padding, inner
board 6px; mobile frame is 14px with 8px padding. Tools use 8px outer and 5px preview radii.
Devices are square enamel forms, while the hamster's wheel is circular. Walls are bolted plates
with cross bracing; they cannot be mistaken for track. Track ports meet cell edges exactly.

## Components

- **Mode navigation / levels** (`src/App.tsx`, `.modes`, `.tab`, `.level-pick`, `.chip`): native
  buttons, selected underline or filled level, spoken current state and solved check. Selecting
  the current item is idempotent. Mode changes pause/restore the current run in memory.
- **Board** (`src/ui/Board.tsx`): one Tab-reachable cell, arrow navigation, Enter/Space to place,
  R to rotate, Delete/Backspace to remove. Focus is clamped to dimensions. Cells expose source,
  sockets, track directions, next alternator output, quota and fault as spoken text. Focus uses
  an inset ivory/blue ring; forced-color mode uses Highlight. Pulse overlays ignore pointer input.
- **Art** (`src/ui/art.tsx`): `HamsterMark`, `SourceTile`, `TargetTile`, `PieceArt`, `PieceIcon`,
  `WallTile`, `FaultMark`, `CheckIcon` and `CrossIcon`. Target device silhouettes sit beside A/B;
  quotas and socket notches remain distinct. Alternators distinguish the next output with a
  solid arrow and the following output with an outline. `PieceIcon` receives the actual next rotation.
- **Parts tray** (`.tools`, `.tool`): labeled previews, compact remaining/total counts, spoken
  next rotation. Selected parts get a check plus brass outline. Remove is a separate dashed
  control; below 350px a tray with all three parts puts Remove on its own full-width row to keep
  every part name intact. A zero count still allows rotating an already placed part of that kind.
- **Run controls / status** (`.controls`, `.status`): brass Start/Pause/Resume, secondary Step,
  explicit Reset. Disabled states use dashed borders, never color alone. Success/failure has
  text and check/cross, plus quota/fault indicators. Secondary layout/share actions sit after
  the run controls on phones.
- **Tutorial** (`tutorialSteps`, `.coach-current`, `.coach`): current instruction beside the
  board, full checklist below. Step four explicitly says to place the second straight once.
- **Source/retry** (`ChallengePanel`, `.provenance`, `.feed-retry`): native details/summary with
  chevrons; all source fields and fictional-energy disclosure expand together. Unverified links
  say so visibly. Offline source has an authored/not-chain-derived heading, reason, countdown
  and Retry now. Feed changes offer a new run; they never alter a frozen one.
- **Persistence/audio warnings** (`.banner-warn`): persistent text explains memory-only play or
  sound unavailability. Neither blocks ticks, wins or navigation.
- **Settings / notes** (`.motion`, native select/details): sound is off initially; motion follows
  the system. Notes/log remain secondary. All controls use native labels and visible focus.

Controls default to 44px minimum height. Secondary layout actions are 36px high on phones;
level buttons may be narrower with 44px height and visible gaps. Board cells remain above the
24px baseline in the checked 320px layout. No control's pseudo hit area overlaps another.

Motion: 480ms pulse interpolation reflects computed ticks only. Wheel rotation runs only while
playing and when motion is allowed. Placement opacity feedback is 120ms; button press scale is
.96, with a 120ms transition. Reduced motion removes gliding/spinning/placement animation and
retains numbers, ports, quota checks, fault marks and textual status. No shake or flashing.

## Do's and Don'ts

Reuse the existing workbench, Board and SVG art when adding a level. Supply a pure level definition
and reference solution, then run the simulator tests. Keep a single filled primary run action;
show state with words/icons as well as color. Keep all playable cells unobscured and put source
or notes in disclosures. Update the next-rotation preview whenever rotation behavior changes.

Do not add a hero above the game, a fixed tray over the board, new runtime dependencies, tiny
counts as the only status, or unverified chain claims. New settings need guarded persistence and
must not become a dependency of the simulation. When adding another informational surface,
start with the app gutters, existing heading/body tokens, native controls and secondary details;
keep the workbench as the primary destination.
