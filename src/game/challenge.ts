import { buildLevel, type LevelSpec } from "./levels";
import type { Dir, Level } from "./sim";

/**
 * Squeekchain challenge: a real, safe Sepolia settlement picks one of a small
 * family of pretested boards (by transactionHash) and an energy tier
 * (by workAdded). Every board x tier pair is verified solvable in tests.
 */

export const API_URL = "https://api.squeekchain.com/v1/settlements?range=24h";
export const SEPOLIA_CHAIN_ID = "11155111";
export const EXPLORER_TX = "https://sepolia.etherscan.io/tx/";
/** Data older than this (by the API's generatedAt) is treated as stale. */
export const MAX_DATA_AGE_MS = 2 * 60 * 60 * 1000;
/** A chosen settlement must be within this window of generatedAt. */
export const MAX_SETTLEMENT_AGE_MS = 26 * 60 * 60 * 1000;

/** Accept at most one minute of clock skew; never accept arbitrary future data. */
export const CLOCK_TOLERANCE_MS = 60_000;

const N: Dir = 0;
const E: Dir = 1;
const S: Dir = 2;
const W: Dir = 3;

type BoardSpec = Omit<LevelSpec, "supply" | "targets" | "tickBudget" | "goal"> & {
  labels: { A: string; B: string; socketsA: Dir[]; socketsB: Dir[] };
  baseBudget: number;
};

export const CHALLENGE_BOARDS: BoardSpec[] = [
  {
    id: "mill-row",
    name: "Mill row",
    hint: "Split once, then bend each branch along the outer rows.",
    map: [".....A", ".#.#..", "S...#.", ".#.#..", ".....B"],
    sourceDir: E,
    interval: 2,
    labels: { A: "Flour mill", B: "Hay press", socketsA: [W], socketsB: [W] },
    inventory: { straight: 7, elbow: 2, alternator: 1 },
    baseBudget: 9,
    solution: [
      [1, 2, "straight", 1],
      [2, 2, "alternator", 0],
      [2, 1, "straight", 0],
      [2, 0, "elbow", 1],
      [3, 0, "straight", 1],
      [4, 0, "straight", 1],
      [2, 3, "straight", 0],
      [2, 4, "elbow", 0],
      [3, 4, "straight", 1],
      [4, 4, "straight", 1],
    ],
  },
  {
    id: "bellows",
    name: "Bellows",
    hint: "Climb from the wheel, then split along the middle row.",
    map: ["#....#", "A....B", "#.##.#", "......", "......", "..S..."],
    sourceDir: N,
    interval: 2,
    labels: { A: "Bellows", B: "Kiln", socketsA: [E], socketsB: [W] },
    inventory: { straight: 5, elbow: 2, alternator: 1 },
    baseBudget: 10,
    solution: [
      [2, 4, "elbow", 2],
      [1, 4, "elbow", 0],
      [1, 3, "straight", 0],
      [1, 2, "straight", 0],
      [1, 1, "alternator", 3],
      [2, 1, "straight", 1],
      [3, 1, "straight", 1],
      [4, 1, "straight", 1],
    ],
  },
  {
    id: "gearbox",
    name: "Gearbox",
    hint: "Drop down the left wall before you split.",
    map: ["S....#", ".####.", ".....A", "...##.", "....#.", ".#...B"],
    sourceDir: S,
    interval: 2,
    labels: { A: "Gear press", B: "Spring winder", socketsA: [W], socketsB: [W] },
    inventory: { straight: 8, elbow: 3, alternator: 1 },
    baseBudget: 11,
    solution: [
      [0, 1, "straight", 0],
      [0, 2, "straight", 0],
      [0, 3, "elbow", 0],
      [1, 3, "straight", 1],
      [2, 3, "alternator", 0],
      [2, 2, "elbow", 1],
      [3, 2, "straight", 1],
      [4, 2, "straight", 1],
      [2, 4, "straight", 0],
      [2, 5, "elbow", 0],
      [3, 5, "straight", 1],
      [4, 5, "straight", 1],
    ],
  },
];

export const OFFLINE_BOARD: BoardSpec = {
  id: "night-shift",
  name: "Night shift",
  hint: "The wheel faces west. Which way is left for a pulse heading west?",
  map: ["B....#", ".#....", "#.#..S", "..#...", "A.....", "...#.."],
  sourceDir: W,
  interval: 2,
  labels: { A: "Lantern", B: "Music box", socketsA: [E], socketsB: [E] },
  inventory: { straight: 7, elbow: 2, alternator: 1 },
  baseBudget: 9,
  solution: [
    [4, 2, "straight", 1],
    [3, 2, "alternator", 2],
    [3, 3, "straight", 0],
    [3, 4, "elbow", 3],
    [2, 4, "straight", 1],
    [1, 4, "straight", 1],
    [3, 1, "straight", 0],
    [3, 0, "elbow", 2],
    [2, 0, "straight", 1],
    [1, 0, "straight", 1],
  ],
};

export interface Tier {
  id: number;
  name: string;
  minWork: number;
  supply: number;
  quotaA: number;
  quotaB: number;
  extraTicks: number;
}

/** Energy tiers chosen by the settlement's workAdded. */
export const TIERS: Tier[] = [
  { id: 0, name: "Light shift", minWork: 0, supply: 3, quotaA: 2, quotaB: 1, extraTicks: 0 },
  { id: 1, name: "Busy shift", minWork: 300, supply: 4, quotaA: 2, quotaB: 2, extraTicks: 2 },
  { id: 2, name: "Rush shift", minWork: 600, supply: 5, quotaA: 3, quotaB: 2, extraTicks: 4 },
];

export function tierForWork(work: number): Tier {
  let t = TIERS[0];
  for (const tier of TIERS) if (work >= tier.minWork) t = tier;
  return t;
}

export function boardIndexForHash(hash: string): number {
  return parseInt(hash.slice(-6), 16) % CHALLENGE_BOARDS.length;
}

export function buildChallengeLevel(board: BoardSpec, tier: Tier, id: string): Level {
  return buildLevel({
    ...board,
    id,
    goal: `${board.labels.A} needs ${tier.quotaA} pulses and ${board.labels.B} needs ${tier.quotaB}, from ${tier.supply} pulses.`,
    supply: tier.supply,
    targets: {
      A: { label: board.labels.A, sockets: board.labels.socketsA, quota: tier.quotaA },
      B: { label: board.labels.B, sockets: board.labels.socketsB, quota: tier.quotaB },
    },
    tickBudget: board.baseBudget + (tier.supply - 1) * board.interval + tier.extraTicks,
  });
}

/* ---------- API validation ---------- */

export interface Settlement {
  transactionHash: string;
  settledThroughRound: number;
  workAdded: number;
  ethereumBlockNumber: number;
  blockTimestamp: string;
  confirmationStatus: string;
}

export interface ChainSnapshot {
  chainId: string;
  network: string;
  generatedAt: string;
  safeThroughBlock: number;
  settlements: Settlement[];
}

export type ParseResult = { ok: true; data: ChainSnapshot } | { ok: false; reason: string };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const DEC = /^\d{1,20}$/;
const HASH = /^0x[0-9a-fA-F]{64}$/;
const SAFE_STATUSES = new Set(["safe", "finalized", "confirmed"]);

function decStr(v: unknown, max: number): number | null {
  if (typeof v !== "string" || !DEC.test(v)) return null;
  const n = Number(v);
  return Number.isSafeInteger(n) && n >= 0 && n <= max ? n : null;
}

function isoTime(v: unknown): number | null {
  if (typeof v !== "string" || v.length > 40) return null;
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.exec(v);
  if (!match || Number(match[2]) > 23 || Number(match[3]) > 59 || Number(match[4]) > 59) return null;
  const calendar = Date.parse(`${match[1]}T00:00:00Z`);
  if (!Number.isFinite(calendar) || new Date(calendar).toISOString().slice(0, 10) !== match[1]) return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : null;
}

/** Validate the documented public fields; anything unexpected is rejected, never guessed. */
export function parseSettlements(body: unknown): ParseResult {
  if (!isObj(body)) return { ok: false, reason: "The response was not a JSON object." };
  if (body.status !== "available") return { ok: false, reason: "The settlement feed reports it is not available." };
  const chain = body.chain;
  if (!isObj(chain)) return { ok: false, reason: "The response has no chain details." };
  if (chain.chainId !== SEPOLIA_CHAIN_ID || chain.target !== "sepolia")
    return { ok: false, reason: "The feed is not for the Sepolia test network, so no explorer link is offered." };
  const safeThrough = decStr(chain.safeThroughBlock, 1e12);
  if (safeThrough === null) return { ok: false, reason: "The safe block height is missing or malformed." };
  if (isoTime(body.generatedAt) === null) return { ok: false, reason: "The response has no valid generation time." };
  const list = body.recentSettlements;
  if (!Array.isArray(list)) return { ok: false, reason: "The response has no settlement list." };
  const settlements: Settlement[] = [];
  for (const raw of list.slice(0, 100)) {
    if (!isObj(raw)) continue;
    const hash = raw.transactionHash;
    const round = decStr(raw.settledThroughRound, 1e9);
    const work = decStr(raw.workAdded, 1e12);
    const block = decStr(raw.ethereumBlockNumber, 1e12);
    const ts = isoTime(raw.blockTimestamp);
    const status = raw.confirmationStatus;
    if (typeof hash !== "string" || !HASH.test(hash)) continue;
    if (round === null || work === null || block === null || ts === null) continue;
    if (typeof status !== "string") continue;
    settlements.push({
      transactionHash: hash.toLowerCase(),
      settledThroughRound: round,
      workAdded: work,
      ethereumBlockNumber: block,
      blockTimestamp: new Date(ts).toISOString(),
      confirmationStatus: status,
    });
  }
  return {
    ok: true,
    data: { chainId: SEPOLIA_CHAIN_ID, network: "Sepolia", generatedAt: String(body.generatedAt), safeThroughBlock: safeThrough, settlements },
  };
}

export type PickResult = { ok: true; settlement: Settlement } | { ok: false; reason: string };

/** All timestamps are rechecked at use time, including cached snapshots. */
export function snapshotFresh(snap: ChainSnapshot, now: number): boolean {
  const gen = isoTime(snap.generatedAt);
  return gen !== null && Number.isFinite(now) && gen <= now + CLOCK_TOLERANCE_MS && now - gen <= MAX_DATA_AGE_MS
    && snap.chainId === SEPOLIA_CHAIN_ID && snap.network === "Sepolia";
}

export function safeSettlement(snap: ChainSnapshot, s: Settlement, now: number): boolean {
  const gen = isoTime(snap.generatedAt), ts = isoTime(s.blockTimestamp);
  return gen !== null && ts !== null && snapshotFresh(snap, now) && ts <= now + CLOCK_TOLERANCE_MS
    && ts <= gen + CLOCK_TOLERANCE_MS && gen - ts <= MAX_SETTLEMENT_AGE_MS
    && now - ts <= MAX_SETTLEMENT_AGE_MS && SAFE_STATUSES.has(s.confirmationStatus)
    && s.ethereumBlockNumber <= snap.safeThroughBlock;
}

export function pickSettlement(snap: ChainSnapshot, now: number): PickResult {
  if (!snapshotFresh(snap, now)) return { ok: false, reason: "The feed timestamp is stale, future-dated or invalid, or the network is not Sepolia." };
  const safe = snap.settlements.filter((s) => safeSettlement(snap, s, now))
    .sort((a, b) => b.ethereumBlockNumber - a.ethereumBlockNumber || a.transactionHash.localeCompare(b.transactionHash));
  if (!safe.length) return { ok: false, reason: "No recent safe settlement with a valid timestamp is available." };
  return { ok: true, settlement: safe[0] };
}

/** v1 chain share links are exclusively Sepolia (11155111), never arbitrary networks. */
export function settlementMatches(snap: ChainSnapshot, claimed: Settlement, now: number): boolean {
  return snap.chainId === SEPOLIA_CHAIN_ID && snap.network === "Sepolia" && snap.settlements.some((s) =>
    safeSettlement(snap, s, now) && s.transactionHash.toLowerCase() === claimed.transactionHash.toLowerCase()
    && s.workAdded === claimed.workAdded && s.settledThroughRound === claimed.settledThroughRound
    && s.ethereumBlockNumber === claimed.ethereumBlockNumber);
}

export function recheckFeed(feed: FeedState, now: number): FeedState {
  if (feed.status !== "ready") return feed;
  const picked = pickSettlement(feed.snapshot, now);
  return picked.ok ? { ...feed, settlement: picked.settlement } : { status: "unavailable", reason: picked.reason };
}

export interface Challenge {
  kind: "chain" | "offline";
  level: Level;
  boardId: string;
  tier: Tier;
  seed: string;
  settlement: Settlement | null;
  /** True when the settlement came from a share link and was not re-checked against the feed. */
  fromLink: boolean;
}

export function challengeFromSettlement(s: Settlement, fromLink = false): Challenge {
  const board = CHALLENGE_BOARDS[boardIndexForHash(s.transactionHash)];
  const tier = tierForWork(s.workAdded);
  return {
    kind: "chain",
    level: buildChallengeLevel(board, tier, `chain-${board.id}-${tier.id}`),
    boardId: board.id,
    tier,
    seed: s.transactionHash,
    settlement: s,
    fromLink,
  };
}

export function offlineChallenge(): Challenge {
  const tier = TIERS[1];
  return {
    kind: "offline",
    level: buildChallengeLevel(OFFLINE_BOARD, tier, "offline-night-shift"),
    boardId: OFFLINE_BOARD.id,
    tier,
    seed: "offline-1",
    settlement: null,
    fromLink: false,
  };
}

export const explorerUrl = (hash: string) => (HASH.test(hash) ? `${EXPLORER_TX}${hash}` : null);

export type FeedState =
  | { status: "loading" }
  | { status: "ready"; snapshot: ChainSnapshot; settlement: Settlement; fetchedAt: number }
  | { status: "unavailable"; reason: string };

export async function loadFeed(fetcher: typeof fetch, now: () => number, timeoutMs = 8000): Promise<FeedState> {
  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  try {
    const res = await fetcher(API_URL, { signal: ctrl?.signal, headers: { accept: "application/json" } });
    if (!res.ok) return { status: "unavailable", reason: `The settlement feed answered with HTTP ${res.status}.` };
    const text = await res.text();
    if (text.length > 512_000) return { status: "unavailable", reason: "The settlement feed response was too large." };
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return { status: "unavailable", reason: "The settlement feed did not return valid JSON." };
    }
    const parsed = parseSettlements(body);
    if (!parsed.ok) return { status: "unavailable", reason: parsed.reason };
    const pick = pickSettlement(parsed.data, now());
    if (!pick.ok) return { status: "unavailable", reason: pick.reason };
    return { status: "ready", snapshot: parsed.data, settlement: pick.settlement, fetchedAt: now() };
  } catch {
    return { status: "unavailable", reason: "The settlement feed could not be reached." };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
