import { CHALLENGE_BOARDS, boardIndexForHash, challengeFromSettlement, offlineChallenge, type Challenge } from "./challenge";
import { levelById } from "./levels";
import { LIMITS, PIECE_KINDS, validateLayout, type Level, type Placement } from "./sim";

/**
 * Share links live in the URL hash and use a tiny fixed grammar:
 *   v1~L~<levelId>~<pieces>
 *   v1~C~<txHash>~<round>~<workAdded>~<ethBlock>~<pieces>
 *   v1~O~<pieces>
 * <pieces> is a run of 3-character groups: column digit, row digit, and one
 * letter a-l (kind * 4 + rotation). Anything else is rejected; nothing from the
 * link is ever rendered as HTML. A share link proves nothing about a solve.
 */

export const MAX_SHARE_LENGTH = 220;
const PIECES_RE = /^(?:[0-7][0-7][a-l]){0,40}$/;

export type ShareTarget =
  | { kind: "level"; level: Level; placements: Placement[] }
  | { kind: "challenge"; challenge: Challenge; placements: Placement[] };

export type ShareParse = { ok: true; value: ShareTarget } | { ok: false; reason: string };

export function encodePieces(placements: Placement[]): string {
  return placements
    .filter((p) => !p.fixed)
    .slice()
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((p) => `${p.x}${p.y}${String.fromCharCode(97 + PIECE_KINDS.indexOf(p.kind) * 4 + (((p.rot % 4) + 4) % 4))}`)
    .join("");
}

export function decodePieces(s: string): Placement[] | null {
  if (!PIECES_RE.test(s)) return null;
  const out: Placement[] = [];
  for (let i = 0; i < s.length; i += 3) {
    const code = s.charCodeAt(i + 2) - 97;
    out.push({ x: Number(s[i]), y: Number(s[i + 1]), kind: PIECE_KINDS[Math.floor(code / 4)], rot: code % 4 });
  }
  return out;
}

export function encodeLevelShare(levelId: string, placements: Placement[]): string {
  return `v1~L~${levelId}~${encodePieces(placements)}`;
}

export function encodeChallengeShare(ch: Challenge, placements: Placement[]): string {
  if (ch.kind === "offline" || !ch.settlement) return `v1~O~${encodePieces(placements)}`;
  const s = ch.settlement;
  return `v1~C~${s.transactionHash}~${s.settledThroughRound}~${s.workAdded}~${s.ethereumBlockNumber}~${encodePieces(placements)}`;
}

function checkPieces(level: Level, raw: string): Placement[] | string {
  const pieces = decodePieces(raw);
  if (!pieces) return "The parts list in the link is malformed.";
  const err = validateLayout(level, pieces);
  if (err) return `The parts in the link do not fit this board: ${err}`;
  return pieces;
}

export function parseShare(input: string): ShareParse {
  if (typeof input !== "string" || input.length === 0) return { ok: false, reason: "Empty link." };
  if (input.length > MAX_SHARE_LENGTH) return { ok: false, reason: "The link is too long." };
  if (!/^[A-Za-z0-9~-]+$/.test(input)) return { ok: false, reason: "The link contains characters it should not." };
  const parts = input.split("~");
  if (parts[0] !== "v1") return { ok: false, reason: "Unknown link version." };
  if (parts[1] === "L" && parts.length === 4) {
    const level = levelById(parts[2]);
    if (!level) return { ok: false, reason: "That level does not exist." };
    const pieces = checkPieces(level, parts[3]);
    if (typeof pieces === "string") return { ok: false, reason: pieces };
    return { ok: true, value: { kind: "level", level, placements: pieces } };
  }
  if (parts[1] === "O" && parts.length === 3) {
    const challenge = offlineChallenge();
    const pieces = checkPieces(challenge.level, parts[2]);
    if (typeof pieces === "string") return { ok: false, reason: pieces };
    return { ok: true, value: { kind: "challenge", challenge, placements: pieces } };
  }
  if (parts[1] === "C" && parts.length === 7) {
    const [, , hash, round, work, block, raw] = parts;
    if (!/^0x[0-9a-f]{64}$/.test(hash)) return { ok: false, reason: "The transaction hash in the link is malformed." };
    const nums = [round, work, block].map((v) => (/^\d{1,12}$/.test(v) ? Number(v) : NaN));
    if (nums.some((n) => !Number.isSafeInteger(n))) return { ok: false, reason: "The round, work or block in the link is malformed." };
    if (boardIndexForHash(hash) >= CHALLENGE_BOARDS.length) return { ok: false, reason: "Unknown board." };
    const challenge = challengeFromSettlement(
      { transactionHash: hash, settledThroughRound: nums[0], workAdded: nums[1], ethereumBlockNumber: nums[2], blockTimestamp: "", confirmationStatus: "unverified" },
      true,
    );
    const pieces = checkPieces(challenge.level, raw);
    if (typeof pieces === "string") return { ok: false, reason: pieces };
    return { ok: true, value: { kind: "challenge", challenge, placements: pieces } };
  }
  return { ok: false, reason: "The link is not a WHEELWORKS board." };
}

export const SHARE_PREFIX = "#s=";

export function readShareFromHash(hash: string): ShareParse | null {
  if (!hash.startsWith(SHARE_PREFIX)) return null;
  return parseShare(hash.slice(SHARE_PREFIX.length));
}

export { LIMITS };
