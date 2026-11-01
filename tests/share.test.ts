import { describe, expect, it } from "vitest";
import { LEVELS } from "../src/game/levels";
import { challengeFromSettlement, offlineChallenge } from "../src/game/challenge";
import { MAX_SHARE_LENGTH, decodePieces, encodeChallengeShare, encodeLevelShare, encodePieces, parseShare, readShareFromHash } from "../src/game/share";
import { defaultSave, loadSave, validateSave } from "../src/game/storage";
import { layoutFrom, runToEnd } from "../src/game/sim";

const HASH = "0xd09a82ef1b48ac4ae41cf7059ed384b69152f153a2401a71f146b288caa0c29f";

describe("share links", () => {
  it("round-trips every level's reference layout", () => {
    for (const l of LEVELS) {
      const link = encodeLevelShare(l.id, l.solution);
      expect(link.length).toBeLessThanOrEqual(MAX_SHARE_LENGTH);
      const r = parseShare(link);
      expect(r.ok).toBe(true);
      if (r.ok && r.value.kind === "level") {
        expect(r.value.level.id).toBe(l.id);
        expect(runToEnd(l, layoutFrom(r.value.placements)).outcome).toBe("won");
      }
    }
  });
  it("round-trips a chain challenge to the same board and seed", () => {
    const ch = challengeFromSettlement({ transactionHash: HASH, settledThroughRound: 821, workAdded: 282, ethereumBlockNumber: 12039268, blockTimestamp: "2026-11-01T06:40:36.000Z", confirmationStatus: "safe" });
    const link = encodeChallengeShare(ch, ch.level.solution);
    const r = parseShare(link);
    expect(r.ok).toBe(true);
    if (r.ok && r.value.kind === "challenge") {
      expect(r.value.challenge.seed).toBe(HASH);
      expect(r.value.challenge.level.id).toBe(ch.level.id);
      expect(r.value.challenge.fromLink).toBe(true);
      expect(r.value.challenge.settlement?.settledThroughRound).toBe(821);
    }
  });
  it("round-trips the offline challenge", () => {
    const ch = offlineChallenge();
    const r = parseShare(encodeChallengeShare(ch, []));
    expect(r.ok && r.value.kind === "challenge" && r.value.challenge.kind === "offline").toBe(true);
  });
  it("rejects malformed, oversized, scripted and over-inventory links", () => {
    const bad = [
      "",
      "v2~L~tutorial~",
      "v1~L~nope~",
      "v1~L~tutorial~11b11b",
      "v1~L~tutorial~11b21b31b",
      "v1~L~tutorial~00z",
      "v1~L~tutorial~<script>",
      "v1~L~tutorial~" + "11b".repeat(80),
      "v1~C~0xabc~1~2~3~",
      "v1~C~" + HASH + "~1~2~x~",
      "v1~L~tutorial~01b", // source tile
      "javascript:alert(1)",
    ];
    for (const b of bad) expect(parseShare(b).ok, b).toBe(false);
  });
  it("only reads the #s= hash", () => {
    expect(readShareFromHash("#other")).toBeNull();
    expect(readShareFromHash("#s=v1~L~tutorial~")?.ok).toBe(true);
  });
  it("piece codec is stable", () => {
    const p = decodePieces("11b21b")!;
    expect(encodePieces(p)).toBe("11b21b");
  });
});

describe("local save", () => {
  it("falls back to defaults on junk", () => {
    expect(validateSave(null)).toEqual(defaultSave());
    expect(validateSave({ version: 9 })).toEqual(defaultSave());
    expect(loadSave({ getItem: () => "{not json" })).toEqual(defaultSave());
  });
  it("keeps valid fields and drops invalid ones", () => {
    const s = validateSave({
      version: 1,
      solved: { tutorial: 3, nope: 4, fork: -1 },
      layouts: { tutorial: [{ x: 1, y: 1, kind: "straight", rot: 1 }], fork: [{ x: 0, y: 2, kind: "straight", rot: 0 }] },
      lastLevel: "fork",
      settings: { muted: true, motion: "loud" },
    });
    expect(s.solved).toEqual({ tutorial: 3 });
    expect(Object.keys(s.layouts)).toEqual(["tutorial"]);
    expect(s.lastLevel).toBe("fork");
    expect(s.settings).toEqual({ muted: true, motion: "system" });
  });
});
