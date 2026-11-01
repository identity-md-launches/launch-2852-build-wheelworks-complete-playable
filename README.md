# Wheelworks

A complete hamster-powered routing puzzle: place limited straight, elbow and alternator tracks,
then deliver every device's pulse quota within its tick budget. Original SVG art, deterministic
simulation, tutorial, six levels, chain-seeded challenges and local progress. React / TypeScript /
SVG / CSS. No account, wallet, payment, token, leaderboard, runtime AI or backend.

**Public site:** https://wheelworks-a-hamster-powered-rou.imd.site/

This revision supplies the source and complete static export in `dist/` for the existing site's
publisher. The HTTPS site was reachable and its previous version was played during this task.
The revised export has been checked locally; publication of this revision and a subsequent
same-URL verification have not occurred inside this run. See [TEST_REPORT.md](TEST_REPORT.md)
for actual evidence, open delivery limits and browser availability.

## Install, preview and rebuild

Use Node 18+ and npm. From the repository root:

```sh
npm ci
npm test
npm run typecheck
npm run build
npm run preview -- --host 127.0.0.1
npm audit --omit=dev
npm audit
```

`npm run dev` runs the development server. `npm run preview` serves the production export;
open the URL it prints. The build performs its own typecheck and generates `dist/index.html`,
`dist/assets/*`, `dist/favicon.svg` and `dist/og.png`. Commit the rebuilt export with source.
No generated dependencies or browser binaries are part of the delivery. The manifest, lockfile
and existing build configuration are preserved under this assignment's protected-path rule.
The production audit is clean; six development dependency advisories remain, detailed in the report.

To redeploy independently, upload **the contents of `dist/`** to any static HTTPS host, or pin that
directory to IPFS and update the existing site's hosting record using its owner's hosting tools.
No server rewrite is needed: navigation and share state use a single document and URL hashes.
Vite's `base: "./"` gives relative runtime asset URLs, tested under `/preview/`. The social image's
absolute metadata URL targets the existing public site; update `og:url` and `og:image` if you use
another canonical domain. Rebuild after changing metadata. Hosting credentials are never bundled.

## Controls

- Select **Straight**, **Elbow** or **Alternator**, then tap an empty floor tile. The tray's count
  is remaining/total; its preview shows the **next placement's orientation**. Tap a placed part
  of the selected kind again to rotate it. Its orientation is remembered for the next part.
- **Remove** returns a part. **Clear all parts** empties the layout. Editing after a tick resets
  the simulation to tick 0 and keeps the edited layout.
- **Start / Pause / Resume** controls the clock. **Step** advances one tick. **Reset** keeps the
  layout and returns to tick 0. A disabled control uses a dashed border and remains unavailable.
- Switching Workshop / Chain challenge pauses and preserves the current run in this open tab.
  Selecting the current mode or level does nothing. **Load latest round** explicitly starts a
  new frozen challenge. Level layouts and earned wins are saved locally when storage works.
- Keyboard: Tab to one board tile; arrows move; Enter or Space places/rotates; R rotates;
  Delete or Backspace removes. Every tile describes its ports, next alternator output, quota
  and fault. Board focus is clamped on board changes.
- Sound starts **off**. Opt in with **Sound off**; the setting is remembered when storage works.
  Motion follows the system by default and can be reduced in Workshop notes. Audio failures do
  not affect play. Storage failures show a persistent warning and use memory for the session.

Fresh tutorial: choose Straight, tap the first dashed tile, tap it again to turn it horizontal,
then tap the second dashed tile **once**. Press Start. It wins at tick 3. The current instruction
stays beside the board and the complete six-step checklist remains below it.

## Simulation and levels

`src/game/sim.ts` remains a pure deterministic function. Rendering, sound, saves and feed polling
never determine ticks. Each 480ms simulation tick emits, moves one tile, routes, checks same-cell
and head-on collisions, delivers, then evaluates the outcome. A fault ends the run with a location
and explanation. Maximums: 200 ticks, 32 pulses, 120 log events and 8×8 boards. Animation only
interpolates already computed movement; reduced motion shows static destinations and counters.

Every tutorial/level reference solution and all 12 challenge board/tier combinations (three
chain boards plus one offline board, each at three tiers) run through the real simulation tests.
The playable offline challenge uses Busy shift. Collision tests seed explicit live-pulse states;
a closed four-elbow loop with one pulse proves the **exact 200-tick cap**, without pretending a
source-fed jam is an endless loop.

## Chain data and honest fallback

The browser reads `https://api.squeekchain.com/v1/settlements?range=24h` directly, with an 8s timeout,
on load, every 60s while visible, and on visibility return. No proxy was introduced.

Validation requires `status: available`, Sepolia chain id `11155111`, target `sepolia`, valid decimal
string fields, a valid 32-byte transaction hash and valid dates. Data generation must be no older
than two hours. A safe/finalized/confirmed settlement must be at or below the safe block and within
26 hours of **both** generation and current time. Future generation or settlement dates more than
**60 seconds** ahead of the current clock (or settlement dates more than 60s ahead of generation)
are rejected. This small tolerance accommodates clock skew; it is not an allowance for arbitrary
future data. Freshness is checked again before each new challenge and on visibility return.

Hash mapping: `parseInt(hash.slice(-6), 16) % 3` selects Mill row, Bellows or Gearbox. Work selects
Light (<300: 3 pulses, 2/1 quotas), Busy (300–599: 4 pulses, 2/2), or Rush (600+: 5 pulses, 3/2).
Work units and workshop pulses are different measures. Pulses are fictional; there are no tokens,
rewards or mainnet minting. A loaded run never changes when the feed changes or expires.

If no safe feed is available, **“Offline workshop challenge—authored, not chain-derived”** is
shown with the failure reason, automatic retry countdown, **Retry now**, and a playable authored
board. Recovery offers **Load latest round** without disturbing the current run. At phone widths,
provenance collapses behind **Source & energy details**; full hash, round, block, network, work,
energy disclosure and the fixed Sepolia Etherscan link remain available there.

## Share links and saves

**Copy share link** includes board and layout in `#s=`. Valid links opened in the same tab or after
reload reproduce the board/seed at tick 0; they never award a claimed solve. Invalid links show an
error while retaining the current board and simulation. Grammar (`src/game/share.ts`):

```
v1~L~<levelId>~<pieces>
v1~C~<SepoliaTxHash>~<round>~<workAdded>~<SepoliaBlock>~<pieces>
v1~O~<pieces>
```

Version 1 chain links are exclusively **Sepolia / 11155111**. Network cannot be changed by a link.
Hash, work, round, block **and network** must all match a currently fresh, safe validated settlement
before the UI says the link matches the live feed. Otherwise the share visibly says unverified;
round/block/work are explicitly labeled as claims. An explorer link alone never verifies a claim.

Pieces use three characters each (column digit, row digit, letter a–l for kind/rotation). The parser
bounds length, characters, coordinates and inventory; it never renders link data as HTML.

`wheelworks.save` version 1 retains best winning tick, validated level layouts, last level, mute
and motion settings. Valid existing saves are read field by field. Both access to `localStorage`
and its methods are guarded. If reading fails the old save is left alone; if writing fails a
warning states that memory progress/settings will be lost on closing the page. Current-session
mode simulations are held in memory; reload restores layouts and earned wins, not an active tick.

## Verification and project files

- [TEST_REPORT.md](TEST_REPORT.md): commands, actual outcomes, screenshots, design review and limits.
- [DESIGN.md](DESIGN.md): implemented tokens, typography, workbench components and responsive rules.
- [ASSETS.md](ASSETS.md) and [LICENSE](LICENSE): code/art provenance and licensing.
- `tests/*.test.ts`: simulator, solutions, feed, shares, storage and audio checks.
- `tests/browser-check.mjs`: repeatable browser-driven production/export and previous-live-site checks.

Optional browser checks need Playwright, installed outside the delivered app. For example:

```sh
npm install --prefix test/scratch/browser playwright@1.58.2
PLAYWRIGHT_BROWSERS_PATH=/tmp/wheelworks-browsers node test/scratch/browser/node_modules/playwright/cli.js install chromium firefox webkit
PLAYWRIGHT_BROWSERS_PATH=/tmp/wheelworks-browsers node tests/browser-check.mjs /absolute/path/to/test/scratch/browser/node_modules/playwright/index.mjs
```

To regenerate the original social card after changing the art, run
`node scripts/render-social.mjs <absolute-path-to-playwright/index.mjs>` with the same
`PLAYWRIGHT_BROWSERS_PATH`, then rebuild to copy `public/og.png` into `dist/`.

The browser-check script creates and closes its own preview server, exercises UI input, and writes evidence to
`artifacts/`. It explicitly distinguishes synthetic feed fixtures from the real public feed.
Physical-device, screen-reader and native browser zoom checks remain separate manual work.
