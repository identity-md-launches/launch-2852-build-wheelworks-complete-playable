# Asset licences and provenance

Every shipped asset was made for this project. No Squeekchain NFT art, logos or other games' assets
are used. Project code and assets are released under the MIT licence in `LICENSE`.

| Asset | Shipped as | Made how | Licence |
| --- | --- | --- | --- |
| Hamster-in-wheel mark, wheel tile, device tiles, wall bricks, conveyor, elbow and alternator tracks, fault marker, check and cross icons | Inline SVG in `src/ui/art.tsx`, bundled into `dist/assets/index-*.js` | Hand-written SVG paths and shapes for Wheelworks | MIT (this repository) |
| Favicon | `public/favicon.svg` -> `dist/favicon.svg` | Hand-written SVG, simplified hamster mark | MIT (this repository) |
| Social preview image | `public/og.png` -> `dist/og.png` (1200x630) | Screenshot of this game's own built page (level "Lopsided order" mid-run), captured with Playwright headless Chromium | MIT (this repository) |
| Sound effects | None shipped as files | Synthesised at run time with the Web Audio API (`src/ui/audio.ts`, oscillator tones) | MIT (this repository) |
| Fonts | None shipped | The page uses the visitor's system UI font stack | n/a |

## Third-party code bundled into `dist/`

| Package | Version | Licence |
| --- | --- | --- |
| react | 18.3.1 | MIT |
| react-dom | 18.3.1 | MIT |
| scheduler (dependency of react-dom) | 0.23.x | MIT |

Build-only tools (vite, @vitejs/plugin-react, typescript, vitest, @types/*) are not shipped.

## Data

`tests/fixture-settlements.json` is a recorded response of the public
`https://api.squeekchain.com/v1/settlements?range=24h` endpoint, used only by the automated tests.
