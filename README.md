# Wheelworks

A hamster-powered 2D routing puzzle for the Squeekchain community. Place and rotate a limited
supply of straight conveyors, elbows and alternators so that energy pulses from a fixed hamster
wheel reach every workshop device's quota within the tick budget.

- Seven handcrafted boards: a tutorial ("First spark") and six levels that teach straight routes,
  then turning, then alternation, then two goals with order-sensitive splitting.
- A Squeekchain challenge: a real, safe Sepolia settlement from the public feed picks one of three
  pretested boards (by `transactionHash`) and an energy tier (by `workAdded`). If the feed is
  unreachable, stale, empty or has no safe settlement, an explicitly labelled offline challenge is
  offered instead.
- No wallet, tokens, contracts, backend, accounts, leaderboard or runtime AI.

## Delivery

| Item | Where |
| --- | --- |
| Static export (served as-is, relative URLs) | `dist/` (`dist/index.html`, `dist/assets/`, `dist/og.png`, `dist/favicon.svg`) |
| Source | `src/` (game logic in `src/game/`, UI in `src/ui/` and `src/App.tsx`) |
| Automated tests | `tests/` |
| Design system | `DESIGN.md` |
| Asset licences and provenance | `ASSETS.md` |
| Test and review report | `TEST_REPORT.md` |

**Public URL.** Hosting is not done from this repository: the IMD publisher pins the committed
`dist/` export to IPFS after the job completes and names it then. This worker cannot know or claim
that URL. The export uses `base: "./"` and hash-only state, so it works at any gateway subpath.

## Install, run, rebuild

Requires Node 18+ (checked with Node 24.21 and npm 11.19).

```sh
npm ci            # install exact versions from package-lock.json
npm run dev       # local dev server with hot reload
npm test          # vitest: simulation, every reference solution, share links, save data, API parsing
npm run typecheck # tsc --noEmit
npm run build     # typecheck + production build into dist/
npm run preview   # serve dist/ locally to check the export
```

After any source change run `npm run build` and commit the regenerated `dist/` alongside the source.

## How to play

1. Pick a part in the parts tray (Straight, Elbow, Alternator, or Remove). Counts show what is left.
2. Tap or click a floor tile to place it. Tap a placed part to rotate it. The next part of that kind
   keeps the last rotation you chose.
3. Press **Start** to run, **Pause** to stop, **Step** to advance exactly one tick, **Reset** to go
   back to tick 0 with your parts kept. Changing the layout always resets the machine to tick 0.
4. A board is solved only when the simulation delivers every device's quota within the tick budget.

Keyboard: Tab to the board, arrow keys move between tiles, Enter or Space places or rotates with the
selected part, R rotates, Delete or Backspace removes. Every tile has a spoken description
(contents, orientation, alternator's next output, device count, any fault).

## Simulation rules

The simulation (`src/game/sim.ts`) is a pure function of level, layout and tick count. It has no
randomness and never reads the clock, so frame rate, animation, sound and network polling cannot
change an outcome. Rendering interpolates between the previous and current tick positions only.

Each tick runs in this fixed order:

1. **Emission**: if supply remains and `(tick - 1) % interval === 0`, the wheel adds a pulse on its own tile.
2. **Movement**: every live pulse, in ascending id order, moves one tile along its heading.
3. **Routing**: in ascending id order, the entered tile decides the pulse's fate. Straight: out the
   opposite side. Elbow: out the other connected side. Alternator: only accepts its input side, sends
   the first arrival out of the left of travel and the next out of the right, alternating (state flips
   in id order). Device: caught if it entered through a socket. Anything else is a fault: off the
   board, wall, bare floor (no track), a closed side of a part, a device's wrong side, or the wheel housing.
4. **Collisions**: two pulses on the same track tile, or two pulses swapping tiles through the same
   edge, are both destroyed. Devices absorb simultaneous arrivals without colliding.
5. **Delivery**: caught pulses are counted.
6. **Outcome**: any fault fails the run and is marked on the board with where and why. Otherwise all
   quotas met wins. Otherwise the run fails when the tick budget runs out or when the supply is spent
   with no live pulses.

Bounds (`LIMITS` in `sim.ts`): 200 ticks, 32 pulses, 120 log events, 8x8 boards. `runToEnd` always
terminates within the budget. Reset rebuilds the initial state, including every alternator.

"Seed": the handcrafted levels have no seed. A chain challenge's seed is its settlement
`transactionHash`, which deterministically chooses the board; the offline challenge's seed is
`offline-1`.

## Squeekchain integration

`src/game/challenge.ts` reads `GET https://api.squeekchain.com/v1/settlements?range=24h` in the browser
on load and every 60 seconds while the tab is visible. Only documented public fields are used:
`status`, `generatedAt`, `chain.chainId`, `chain.target`, `chain.safeThroughBlock`, and per settlement
`transactionHash`, `settledThroughRound`, `workAdded`, `ethereumBlockNumber`, `blockTimestamp`,
`confirmationStatus`.

- Validation: the body must be an object with `status: "available"`, `chain.chainId === "11155111"`
  and `chain.target === "sepolia"`. Each settlement needs a 32-byte hex hash, decimal-string numbers
  in range, and a valid timestamp; malformed entries are dropped, never repaired.
- Selection: the newest settlement whose `confirmationStatus` is `safe` (or `finalized`/`confirmed`),
  whose block is at or below `safeThroughBlock`, and that is within 26 hours of `generatedAt`. Data
  generated more than two hours ago counts as stale.
- Mapping: board = `parseInt(last 6 hex chars of hash) % 3` (Mill row, Bellows, Gearbox). Tier from
  `workAdded`: under 300 Light shift (3 pulses, quotas 2/1), 300 to 599 Busy shift (4 pulses, 2/2),
  600+ Rush shift (5 pulses, 3/2). All nine combinations, plus the offline board, are verified
  solvable by stored reference solutions in `tests/sim.test.ts`.
- Freezing: pressing Start round N locks the challenge. Later feed updates only show a "newer
  settlement" card with an explicit Switch button; the active board, seed and quotas never change.
- Display: round, Sepolia block, work units and the transaction, linked to
  `https://sepolia.etherscan.io/tx/<hash>` only after the chain id was verified as Sepolia and the hash
  matched the 32-byte pattern. The UI states that workshop pulses are fictional while the settlement
  data is real testnet data. No mainnet SQK minting is assumed or shown.
- Fallback: network error, HTTP error, invalid JSON, wrong chain, stale or empty data, or no safe
  settlement shows the reason and offers the "Offline workshop challenge", labelled as not linked to
  any transaction. No transaction data is ever invented.

## Share links and saved progress

Share links live in the URL hash (`#s=`) with a fixed grammar (`src/game/share.ts`):

```
v1~L~<levelId>~<pieces>
v1~C~<txHash>~<round>~<workAdded>~<ethBlock>~<pieces>
v1~O~<pieces>
```

`<pieces>` is up to 40 groups of column digit, row digit and a letter `a`-`l` (kind x 4 + rotation).
Links over 220 characters, with any character outside `A-Z a-z 0-9 ~ -`, unknown levels, or parts that
break the board or the inventory are rejected with a visible message. Nothing from a link is rendered
as HTML. The link reopens the same board, seed and layout after reload. A link is never treated as
proof of a solve. A chain link that was not re-checked says so, and says when it matches the live feed.

Local save (`src/game/storage.ts`, key `wheelworks.save`, `version: 1`) keeps solved levels (best
tick), the last layout per handcrafted level, the last level, and settings (mute, motion). It is
validated field by field on load; anything invalid falls back to defaults.

## Known limitations

- No deployed URL from this worker: the publisher pins `dist/` after the job (see Delivery).
- `og:image` is a relative URL (`./og.png`) because the final host is unknown; some link unfurlers
  require an absolute URL.
- The font stack starts with `ui-rounded` (SF Pro Rounded on Apple devices); other systems use their
  system sans-serif. No web font ships.
- Manual checks on physical phones were not possible here; touch was exercised with Playwright's
  touch emulation (`hasTouch`, `isMobile`) at 390 px. See `TEST_REPORT.md`.
