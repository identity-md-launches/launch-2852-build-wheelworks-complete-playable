# Asset rights and provenance

Project code and original art are released under the MIT license now included in [LICENSE](LICENSE).
No Squeekchain NFT art, official brand artwork, stock imagery or other games' assets are used.

| Asset | Source / production copy | Provenance |
| --- | --- | --- |
| Hamster, wheel, directional port, tracks and alternator arrows | `src/ui/art.tsx`, bundled in `dist/assets/index-*.js` | Original SVG shapes retained from the first Wheelworks version and refined in this revision: expressive face, whiskers/tail, navy/ivory/copper palette. |
| Devices, sockets, counters and faults | `src/ui/art.tsx` | Original SVG device family drawn in code for this revision (grater/sorter, oven/kiln, lamp/lantern, bell/music box, kettle/pump, fan/bellows, press, mill and spring winder); A/B and quota remain separate. Fault marker retained and recolored. |
| Bolted wall plates | `src/ui/art.tsx` | Original SVG plates, cross bracing and rivets replacing brick art. |
| Check, cross, Start/Pause and disclosure marks | `src/ui/art.tsx`, `src/App.tsx`, `src/styles.css` | Original SVG check/cross; standard text glyphs for controls. Decorative glyphs are hidden from accessible names where needed. |
| Favicon | `public/favicon.svg` → `dist/favicon.svg` | Original simplified hamster/wheel on a navy rounded square, updated to the final palette. |
| Social card | `public/og.png` → `dist/og.png`, 1200×630 | Chromium screenshot of this revision's own SVG game board (Lopsided order with placed tracks), arranged as a static share composition by `scripts/render-social.mjs` using HTML/CSS. Original rendered game art; no external image. |
| Evidence screenshots | `artifacts/screenshots/` | Actual browser captures. Files prefixed `existing-deployed-` show the previous live version and are labeled as such in TEST_REPORT.md; other final captures show the revised production export. |
| Audio | `src/ui/audio.ts` | Existing oscillator synthesis; no audio files. Failure handling added; muted by default. |
| Typography | CSS system font stack | No bundled font or remote font request. Final UI uses Segoe UI / system-ui / platform sans-serif fallback. |

React 18.3.1, React DOM 18.3.1 and scheduler 0.23.x are MIT-licensed third-party runtime code bundled
in the production JS. Vite, Vitest, TypeScript and associated build tools are development-only.
The runtime MIT notice is retained in `public/THIRD_PARTY_NOTICES.txt` and copied to `dist/`.
The copyright notice was checked against the [React 18.3.1 license](https://raw.githubusercontent.com/facebook/react/v18.3.1/LICENSE). Dependency archives are not shipped. No runtime dependency was added in this revision.

`tests/fixture-settlements.json` is a public API response supplied with the preceding version.
This revision retains it as test data. Browser feed scenarios explicitly intercept it, refresh its
timestamps or insert malformed/future values for testing; these are **synthetic tests**, not proof
of a currently reachable live settlement. No feed data is bundled as an invented live source.

Design review used the pinned Better Interface guide (Jakub Krehel, MIT) and its document method
adapted from Paul Bakaus's Impeccable (Apache-2.0). Their prose is not copied into the game.
