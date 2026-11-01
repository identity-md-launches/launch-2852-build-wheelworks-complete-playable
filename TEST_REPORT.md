# Wheelworks revision: actual validation and limits

Validation date: 2026-11-01. This is a worker's report, not independent certification.

The revised source and production export are implemented and playable in the checked Chromium
flows. **Full delivery verification remains incomplete:** this run cannot publish the revision
or verify it after publication at the existing HTTPS URL; the public settlement feed was
unavailable here; Firefox/WebKit could not launch; physical devices, a screen-reader session and
native browser 200% zoom were not available. These limits are not reported as passes.

## Results at a glance

| Area | Actual result |
| --- | --- |
| Unit tests | **63/63 pass** across four files |
| Production build and TypeScript | Pass |
| Browser suite | **36 pass, 0 fail, 3 unavailable**; `artifacts/browser-results.json` |
| Fresh-player tutorial sequence | Win at **tick 3**; second straight placed with one tap |
| Tutorial + six levels | All seven reference solutions pass simulation and UI playthroughs |
| Challenge family | All **12 board/tier combinations** pass simulation; nine chain variants and the playable offline Busy variant pass UI playthroughs |
| Feed/share/storage/audio/navigation | Requested failure and recovery cases pass below |
| Design probe | **15/16 checks pass**, one intentional framed-board exception |
| First 390px screen | Product, board, parts and Start visible; active offline challenge run row fits 390×844 |
| Audits | Production **0**; all dependencies **6** (3 moderate, 1 high, 2 critical), all development-side |
| Public HTTPS site | Existing previous version reachable and playable; revised version not yet published/verified |
| Bundle | Under 8 MiB; includes source, unchanged lockfile, complete export and real screenshots |

## Commands and scope

Run from repository root:

| Command | Outcome |
| --- | --- |
| `npm ci --cache /tmp/wheelworks-npm --no-fund` | Pass, exact existing lockfile installed. An earlier attempt using the default cache failed; using a task cache resolved installation. |
| `npm test` | Final run: 4 files, **63 passed** (simulation 40, API 10, share/save 8, resilience 5). |
| `npm run typecheck` | Pass, `tsc --noEmit`. |
| `npm run build` | Pass, TypeScript plus Vite production build; no new runtime dependency. |
| `npm audit --omit=dev --json --cache /tmp/wheelworks-npm` | Exit 0, no production vulnerabilities. |
| `npm audit --json --cache /tmp/wheelworks-npm` | Exit 1, six development dependency vulnerabilities. |
| `PLAYWRIGHT_BROWSERS_PATH=/tmp/wheelworks-browsers node tests/browser-check.mjs <path-to-playwright/index.mjs>` | Final run exit 0; 36 passing cases, three explicitly unavailable. Owns and closes its production preview. |
| `IMD_PLAYWRIGHT=<path-to-playwright/index.mjs> PLAYWRIGHT_BROWSERS_PATH=/tmp/wheelworks-browsers node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste` | Ran on final game source/export: 15 passed checks, `chrome` flagged the framed board inside the workbench. |
| Production asset integrity check | Every relative runtime script/style/favicon reference resolves; no source maps/tarballs; favicon/social copy equals `public/`; file sizes and SHA-256 values recorded in `artifacts/export-check.json`. |

The optional Playwright installation is confined to disposable scratch and browser downloads;
neither is included in the submission. Existing build/dependency configuration and ignore rules
were preserved. Runtime assets remain local and relative; production preview was exercised under
`/preview/`, including share hashes. No wallet, backend, proxy or new runtime library was added.

## Correctness proof and behavior checks

### Tutorial, simulation and solutions

A new isolated Chromium context starts on First spark, with no progress and sound off. Through
actual UI input: select Straight → place first dashed tile → rotate it once → observe that the
preview and placed SVG both show the horizontal track → read the adjacent instruction saying
“second dashed tile once” → tap that tile once → Start → Pause/Step → **Solved at tick 3**.
The winning tick persists after reload; loading a share itself starts at tick 0 and grants no win.
Complete checklist remains below the workbench. This is an automated fresh-context playthrough,
not an observation of an independent human player.

`tests/sim.test.ts` retains tutorial/six-level solutions and all three tiers for Mill row, Bellows,
Gearbox and the offline Night shift (12 challenge combinations). All meet their actual quotas and
inventory. UI playthroughs place and rotate parts with buttons/cells, rather than modifying React
state, then advance the real simulation with Start/Step.

The misleading old loop fixtures were replaced:

| Fixture | Exact asserted outcome |
| --- | --- |
| Bare floor, wall, wrong socket, off-board | Failed at tick 1 with the corresponding exact fault kind |
| Upright straight entered from west | Jam, tick 1, cell (1,0), pulse 1 |
| Three-elbow route returning to the wheel | Housing fault, tick 4, wheel cell (0,0), pulse 1 |
| Two opposite arrivals on one open straight | One collision fault, tick 1, cell (1,1), pulse ids 1 and 2; both destroyed |
| Head-on pulse swap across adjacent open tracks | One head-on collision at tick 1, not a jam |
| One live pulse inside a closed four-elbow ring | No routing faults at **every tick 1–200**; still circulating; budget failure at exactly **200**; finished state cannot advance |

Collision/circulation fixtures explicitly seed live-pulse states to isolate those mechanics.
A closed two-port elbow ring has no entrance for a source-fed pulse; this distinction is documented
in the test, rather than claiming that a source-fed track which jams is an endless loop.
Determinism, immutability, alternator ordering, inventory and hard supply bounds remain tested.

### Feed, provenance and shares

Unit/API and intercepted-browser checks exercise good, offline, stale, future feed, future
settlement, malformed/invalid dates/structure, wrong chain, empty/unsafe settlements and unsafe
blocks. Impossible calendar dates and date-only generation values are rejected. Only safe data
within the documented two-hour generation / 26-hour settlement windows is eligible. Future skew
is limited to **60 seconds** against the current clock and generation time. Cached data is checked
again before a new challenge and on visibility return. The frozen board, layout and tick survive
feed failure or recovery. The automatic retry was advanced using a virtual clock (61 seconds),
without waiting a minute in real time. Retry now and Load latest round were both exercised.

Matching shares must compare hash, work, round, block and fixed Sepolia network against a recent,
safe feed settlement. Browser cases used the recorded public fixture with explicitly synthetic
fresh timestamps. The same hash/work with round `999999999999` and block `1`, as well as individual
round/block/work changes, stays visibly **Unverified share data**, with claimed fields in the
expanded source. Network/chain mismatch and unsafe matching entries fail unit tests. The safe
explorer URL remains `https://sepolia.etherscan.io/tx/<validated-32-byte-hash>`; it does not imply
that the claimed round/block is proven. Version 1 chain links cannot specify another network.

A new `#s=` while the page is open rebuilds a valid board at tick 0. Invalid links keep the board
and tick intact with an alert. Share/reload preserves layout/seed; no solve is awarded on opening.

**Live limit:** direct public API access answered HTTP 403 in this environment; the existing
site's browser also offered fallback. Good-feed tests were intercepted fixtures, not a real-live
settlement playthrough. No proxy was added to hide this environmental difference.

### Storage, audio, navigation and focus

- Throwing `localStorage` getter, denied `getItem`, and denied writes each show a persistent save
  warning and allow an in-memory tutorial win. The write-denial test begins with valid older
  progress and confirms it is unchanged on disk while new progress appears in memory.
- New saves default muted. A valid saved unmuted preference and progress survive validation.
  Share/reload preserves earned local wins and layouts.
- Audio construction, rejected resume and playback failures are injected separately. Each allows
  ticks, a tutorial win and a saved best tick of 3, with a sound-unavailable warning. No uncaught
  exception remains. Sound is supplementary to the pulse, quota, fault and status visuals.
- Current mode/current level clicks are idempotent. Mode switches preserve paused tick and layout;
  switching back restores the same run. An additional case verifies returning to a shared workshop
  level instead of opening an older saved level.
- Level 6 → a smaller challenge keeps exactly one Tab-reachable board cell. Keyboard checks cover
  arrow movement, Enter placement, R rotation, Delete removal and the focused rendered tile.
- Touch is **emulated Chromium touch input** (`hasTouch`, `isMobile`), not a physical phone.
  Tap-only tutorial input reaches a win.

## Responsive and rendered review

Production screenshots were captured; representative initial, small challenge, keyboard, win/fail
and expanded-source views were visually inspected. They are not mockups. The repeatable matrix
walks initial, selected, running, win, failure, reset/retry and offline challenge states at:

| View | Captured states | Observation |
| --- | --- | --- |
| 1440×900 | All seven | Board and controls share one workbench; notes stay secondary. |
| 390×844 | All seven | Primary interaction visible initially. Active offline board, parts and Start/Step/Reset fit the first viewport. |
| 320×640 | All seven | Every level remains discoverable; full part labels retained. Remove moves to its own row for three-part trays. Natural vertical scrolling is required. |
| 1024×600 | All seven | Short desktop scrolls naturally; no overlay covers the grid. |
| 1440×900 with CSS `zoom: 2` | All seven | Usable scrolling, no horizontal document overflow. **This is not native browser zoom.** |

The suite asserts no horizontal document overflow for each captured state. Reduced-motion checks
verify the rendered preference, no spinning wheel, static pulse rendering and a playable win.
An early race when the system preference changed during initial effect subscription was fixed
by synchronizing the media-query value when the listener attaches.

Screenshot links (all final local export unless explicitly labeled previous live version):

| Evidence | Files |
| --- | --- |
| First screen | [390px](artifacts/screenshots/initial-390.jpg), [320px](artifacts/screenshots/initial-320.jpg), [desktop](artifacts/screenshots/initial-1440.jpg) |
| Tutorial | [Selected](artifacts/screenshots/tutorial-selected-390.jpg), [running/paused](artifacts/screenshots/tutorial-running-390.jpg), [won](artifacts/screenshots/tutorial-win-390.jpg) |
| State matrix at 390px | [Selected](artifacts/screenshots/selected-390.jpg), [running](artifacts/screenshots/running-390.jpg), [win](artifacts/screenshots/win-390.jpg), [failure](artifacts/screenshots/fail-390.jpg), [retry](artifacts/screenshots/retry-390.jpg) |
| Small challenge | [390px](artifacts/screenshots/offline-390.jpg), [320px](artifacts/screenshots/offline-320.jpg), [offline win](artifacts/screenshots/offline-win-390.jpg) |
| Source and accessibility | [Unverified share](artifacts/screenshots/unverified-share-390.jpg), [keyboard focus](artifacts/screenshots/keyboard-focus-390.jpg), [reduced-motion win](artifacts/screenshots/reduced-motion-win.jpg) |
| Short screen / enlarged UI | [1024×600](artifacts/screenshots/offline-1024.jpg), [200% CSS zoom](artifacts/screenshots/initial-1440-zoom200.jpg) |
| Six-level playthrough | [Level six win](artifacts/screenshots/level-six-win-390.jpg) |
| **Previous deployed version** | [Level six win](artifacts/screenshots/existing-deployed-level-six.jpg), [offline win](artifacts/screenshots/existing-deployed-offline-win.jpg) |

Additional matrix files use `{initial,selected,running,win,fail,retry,offline}-{1440,320,1024,1440-zoom200}.jpg`.
JPEG evidence replaces superseded PNG captures to meet the submission budget; the required social
image remains a complete PNG and all runtime art remains in source/SVG.

The main suite records **zero uncaught application exceptions** and no failed local export
resources. Expected API request failures in offline fixtures are not hidden as app successes.
The actual feed failed separately, as stated above. The probe independently reports no script
errors or missing local files. This does not claim that every browser console category was empty.

## Better Interface review: all six domains

Applied the pinned guide during implementation, then checked the final production rendering.
Visual idea: one ivory hamster clockwork workbench surrounding a navy blueprint grid, with brass
routes and enamel devices. No added hero, fixed dock, account flow or unrelated surface.

| Domain | Coverage | Fixes / evidence | Remaining limits |
| --- | --- | --- | --- |
| Accessibility | Checked source, native semantics, keyboard/touch flow, focus image, names, motion, zoom/reflow | Board roving focus clamp; decorative Start glyph hidden from name; DOM order matches mobile tray/run order; labeled tools and redundant success/failure cues | No screen-reader session, native zoom, physical device or forced-colors rendered test |
| Layout | Checked 320/390/1024/1440 and CSS 200% state matrix | Unified workbench; level wrap; compact provenance; Move Remove below three-part tray at 320; no document overflow or fixed overlays | No physical safe-area testing or RTL/localization session |
| Writing | Checked all changed control/source/tutorial text | One-tap second straight instruction; unverified claims named; explicit authored fallback, retry and memory-save warning | No independent user comprehension study |
| Typography | Source + rendered probe, four/five effective sizes, three weights | Natural case/tracking; full hashes wrap; no mid-word part labels in final small layout; 16px fields | System font resolves differently on other platforms |
| Colors | Opaque token calculation + rendered probe | All measured interface text meets 4.5:1 (3:1 large); status and selection have text/icons | SVG art lettering excluded by probe; not a complete accessibility certification |
| UI details | Initial/selected/running/win/fail/retry; hover source, focus screenshot, motion emulation | Original device silhouettes, bolted walls, next-orientation preview, restrained 120ms feedback, no shake/flashing | No animation-panel slow-motion session; Firefox/WebKit unavailable |

Measured opaque contrasts: ink/workbench **13.85:1**, secondary/paper **5.48:1**, Start label/brass
**6.50:1**, success text/background **6.08:1**, failure **6.09:1**, focus blue/paper **5.64:1**,
track rail/navy floor **6.02:1**. These identify the actual opaque pairs; they do not claim every
possible illustration pixel has been measured.

### Consolidated findings and repairs

| Severity / source | Finding, repair and recheck |
| --- | --- |
| High — `src/App.tsx:607`, `src/ui/art.tsx:163` | Remembered rotation contradicted tutorial directions and tray art. Explicit one-tap step plus actual next-rotation preview; fresh-context tick-3 win and equal SVG paths confirm repair. |
| High — `src/game/challenge.ts:276`, `src/App.tsx:629` | Hash/work-only match could launder a forged round/block. Compare every field and network only against fresh safe data; visible unverified/claimed labels. Forged-round/block browser cases and API tests pass. |
| High — `src/game/challenge.ts:200`, `src/game/challenge.ts:253`, `src/App.tsx:117` | Future/stale cached data could seed new runs. Strict ISO/calendar checks, one-minute skew tolerance, revalidation and retry scheduler; browser future/stale/visibility/new-run cases pass without altering frozen runs. |
| High — `src/game/storage.ts:71`, `src/game/storage.ts:82` | Storage getter crash and silent write loss. Guard accessor/methods, retain memory, warn and preserve unreadable/old saves; all three browser denial cases pass. |
| High — `src/ui/audio.ts:33` | Audio exception could interrupt progress after displaying Solved. Guard construction/resume/playback and surface warning; three injected audio failures persist the actual win. |
| High — `src/App.tsx:84`, `src/App.tsx:111`, `src/App.tsx:344`, `src/ui/Board.tsx:56` | Mode resets, stale share handling and out-of-range focus. Session restoration, live hash listener, current shared-level return and focus clamp; browser navigation/hash/keyboard cases pass. |
| Medium — `src/styles.css:40`, `src/styles.css:44`, `src/styles.css:81`, `src/styles.css:184` | Wasted selector space, separated controls, hidden level 6 and cramped part labels. Wrapped levels, one workbench, grid tray and separate Remove row below 350px; screenshot recheck at 320/390 passes. |
| Medium — `src/ui/art.tsx:65`, `src/ui/art.tsx:98` | Generic device circles/walls lacked workshop character. Original labeled device silhouettes and bolted plate family; sockets, quota and alternator arrows remain visible in small-board screenshots. |
| Medium — `src/App.tsx:32`, `src/App.tsx:479` | Browser checks exposed media preference subscription race and CSS-generated triangle in the Start accessible name. Synchronize preference on subscription, use an aria-hidden decorative span; final media/touch/Start cases pass. |
| Medium — `tests/sim.test.ts:121`, `tests/sim.test.ts:145` | Old “collision” and “circulating” tests accepted jams. Replace with exact live-pulse collision/cap fixtures; final 63-test run passes. |
| Low / intentional — `src/styles.css:44`, `src/styles.css:59` | taste `chrome` sees the framed board nested in the workbench. Kept because the brief explicitly asks to group a **framed board** as one workbench. It is game housing, with no nested informational cards or competing card shadows. Screenshot reviewed; remaining 15 checks pass. |

The taste report is preserved in `artifacts/taste.json`. It reports all 32 entry controls above
the 24px baseline or appropriately spaced, with eight below the 44px comfortable size. All UI
size/face/tracking/copy/share checks pass. Its initial-page scan does not replace the game-state
matrix. The required authored fallback heading intentionally contains the brief's em dash; it is
not part of the entry-page glyph check and is preserved for the requested honest label.

## Dependency advisories and protected files

Production audit: **zero vulnerabilities**. Full audit: six affected development packages:

| Package | Reported severity |
| --- | --- |
| `@vitest/mocker` | moderate |
| `esbuild` | moderate |
| `vite-node` | moderate |
| `vite` | high |
| `tinypool` | critical |
| `vitest` | critical |

Titles, advisory URLs and ranges are retained in `artifacts/dependency-audit.json`. These include
Vitest UI-server arbitrary read/execution, mock registration/path traversal, tinypool pollution
and Vite/esbuild development-server issues. The existing Vite 5.4.21 / Vitest 2.1.9 development
versions remain. **No patch upgrade was made:** the assignment expressly forbids changing the
existing package manifest or lockfiles, even though this revision also asks to update them if
feasible. The stronger protected-path rule controls. No dependency advisory is claimed fixed.
No development server or test UI is part of the static export.

## Existing HTTPS site and outstanding work

`https://wheelworks-a-hamster-powered-rou.imd.site/` returned HTTP 200 in the final browser run.
The **previous deployed version** was played through the tutorial, six levels and offline challenge
using actual UI placement/rotation/Step. A prior navigation attempt timed out; a later final run
succeeded. The old tutorial text is still old on that deployment; its successful test uses the
corrected one-tap sequence rather than treating the old copy as repaired.

This assignment supplies the rebuilt `dist/` under the same site's continuation, without changing
its hosting identity. The publisher must publish that export before anyone can verify **this
revision** on the same HTTPS URL. No publication command was run and no updated-live claim is made.

Unavailable/unmet checks are explicit:

1. **Revised deployment and same-URL postpublication playthrough**: not performed in this run.
2. **One real live chain challenge**: not performed; public feed unavailable here. Fixture-based
   good-feed validation is not a substitute. Offline challenge is playable and honestly labeled.
3. **Firefox / WebKit rendering and input**: binaries were downloaded to disposable storage but
   could not launch because required system libraries were unavailable. The supplied browser tool
   also lacked its configured executable. Chromium via local Playwright was the functioning tool.
4. **Physical-device, independent human tutorial, screen-reader and native 200% browser-zoom
   sessions**: not performed. Touch and CSS zoom are emulations; the distinction is preserved.
5. **Patched development dependencies**: not delivered under the protected manifest/lockfile rule;
   six advisories remain. Production dependencies audit clean.

No missing account/key/owner value was invented. This is a useful locally verified implementation
with the above delivery/verification limits, not a claim of fully completed deployed acceptance.
