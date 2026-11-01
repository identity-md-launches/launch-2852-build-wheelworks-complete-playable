import { describe, expect, it } from "vitest";
import fixture from "./fixture-settlements.json";
import { API_URL, CHALLENGE_BOARDS, challengeFromSettlement, explorerUrl, loadFeed, parseSettlements, pickSettlement, tierForWork, CLOCK_TOLERANCE_MS, MAX_DATA_AGE_MS, recheckFeed, settlementMatches } from "../src/game/challenge";

const NOW = Date.parse(fixture.generatedAt) + 60_000;
const res = (body: unknown, status = 200) => new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
const fetchOf = (r: Response | Error) => (async () => { if (r instanceof Error) throw r; return r; }) as unknown as typeof fetch;

describe("settlement feed", () => {
  it("validates the recorded live response and picks the newest safe settlement", async () => {
    const st = await loadFeed(fetchOf(res(fixture)), () => NOW);
    expect(st.status).toBe("ready");
    if (st.status !== "ready") return;
    const newest = [...fixture.recentSettlements].sort((a, b) => Number(b.ethereumBlockNumber) - Number(a.ethereumBlockNumber))[0];
    expect(st.settlement.transactionHash).toBe(newest.transactionHash);
    expect(st.snapshot.chainId).toBe("11155111");
    expect(explorerUrl(st.settlement.transactionHash)).toBe(`https://sepolia.etherscan.io/tx/${newest.transactionHash}`);
  });
  it("the settlement selects the board by hash and the tier by workAdded", () => {
    const base = { settledThroughRound: 1, ethereumBlockNumber: 1, blockTimestamp: "", confirmationStatus: "safe" };
    const seen = new Set<string>();
    for (const h of ["0", "1", "2", "3", "4", "5"]) {
      const c = challengeFromSettlement({ ...base, transactionHash: "0x" + "a".repeat(63) + h, workAdded: 10 });
      seen.add(c.boardId);
    }
    expect(seen.size).toBe(CHALLENGE_BOARDS.length);
    expect(tierForWork(0).id).toBe(0);
    expect(tierForWork(299).id).toBe(0);
    expect(tierForWork(300).id).toBe(1);
    expect(tierForWork(609).id).toBe(2);
  });
  it("is deterministic for the same settlement", () => {
    const s = { transactionHash: fixture.recentSettlements[0].transactionHash, settledThroughRound: 1, workAdded: 282, ethereumBlockNumber: 1, blockTimestamp: "", confirmationStatus: "safe" };
    expect(challengeFromSettlement(s)).toEqual(challengeFromSettlement(s));
  });
  it("falls back on network error, HTTP error, bad JSON and wrong chain", async () => {
    expect((await loadFeed(fetchOf(new TypeError("offline")), () => NOW)).status).toBe("unavailable");
    expect((await loadFeed(fetchOf(res("nope", 503)), () => NOW)).status).toBe("unavailable");
    expect((await loadFeed(fetchOf(res("{oops")), () => NOW)).status).toBe("unavailable");
    const mainnet = { ...fixture, chain: { ...fixture.chain, chainId: "1", target: "mainnet" } };
    const r = await loadFeed(fetchOf(res(mainnet)), () => NOW);
    expect(r.status === "unavailable" && /Sepolia/.test(r.reason)).toBe(true);
  });
  it("treats stale data and empty or unsafe lists as unavailable", async () => {
    expect((await loadFeed(fetchOf(res(fixture)), () => NOW + 3 * 3600_000)).status).toBe("unavailable");
    expect((await loadFeed(fetchOf(res({ ...fixture, recentSettlements: [] })), () => NOW)).status).toBe("unavailable");
    const pending = { ...fixture, recentSettlements: fixture.recentSettlements.map((s) => ({ ...s, confirmationStatus: "pending" })) };
    expect((await loadFeed(fetchOf(res(pending)), () => NOW)).status).toBe("unavailable");
    const unsafeBlock = { ...fixture, chain: { ...fixture.chain, safeThroughBlock: "1" } };
    expect((await loadFeed(fetchOf(res(unsafeBlock)), () => NOW)).status).toBe("unavailable");
  });
  it("drops entries with wrong types or ranges instead of guessing", () => {
    const junk = { ...fixture, recentSettlements: [{ transactionHash: "0x12", workAdded: "5" }, { ...fixture.recentSettlements[0], workAdded: -3 }, { ...fixture.recentSettlements[0], settledThroughRound: "1e5" }, "x", null] };
    const p = parseSettlements(junk);
    expect(p.ok && p.data.settlements.length).toBe(0);
    expect(parseSettlements([]).ok).toBe(false);
    expect(parseSettlements({ ...fixture, generatedAt: "2026-02-31T00:00:00Z" }).ok).toBe(false);
    expect(parseSettlements({ ...fixture, generatedAt: "2026-11-01" }).ok).toBe(false);
    expect(parseSettlements({ ...fixture, status: "degraded" }).ok).toBe(false);
  });
  it("pickSettlement ignores settlements older than the 24h window", () => {
    const p = parseSettlements(fixture);
    if (!p.ok) throw new Error();
    const old = { ...p.data, settlements: p.data.settlements.map((s) => ({ ...s, blockTimestamp: "2020-01-01T00:00:00.000Z" })) };
    expect(pickSettlement(old, NOW).ok).toBe(false);
  });
  it("rejects future feed and settlement timestamps, invalid dates, and permits only 60s clock skew", async () => {
    const gen = new Date(NOW + CLOCK_TOLERANCE_MS + 1).toISOString();
    expect((await loadFeed(fetchOf(res({ ...fixture, generatedAt: gen })), () => NOW)).status).toBe("unavailable");
    const future = { ...fixture, recentSettlements: fixture.recentSettlements.map((s) => ({ ...s, blockTimestamp: new Date(NOW + 120_000).toISOString() })) };
    expect((await loadFeed(fetchOf(res(future)), () => NOW)).status).toBe("unavailable");
    expect((await loadFeed(fetchOf(res({ ...fixture, generatedAt: "invalid" })), () => NOW)).status).toBe("unavailable");
    const boundary = { ...fixture, generatedAt: new Date(NOW + CLOCK_TOLERANCE_MS).toISOString() };
    expect((await loadFeed(fetchOf(res(boundary)), () => NOW)).status).toBe("ready");
    const invalid = { ...fixture, recentSettlements: fixture.recentSettlements.map((s) => ({ ...s, blockTimestamp: "invalid" })) };
    expect((await loadFeed(fetchOf(res(invalid)), () => NOW)).status).toBe("unavailable");
  });
  it("rechecks cached freshness and verifies every claimed field, including the network and safe status", async () => {
    const feed = await loadFeed(fetchOf(res(fixture)), () => NOW);
    if (feed.status !== "ready") throw new Error("fixture failed");
    const { snapshot, settlement: s } = feed;
    expect(settlementMatches(snapshot, s, NOW)).toBe(true);
    for (const patch of [{ settledThroughRound: 999999999999 }, { ethereumBlockNumber: 1 }, { workAdded: s.workAdded + 1 }, { transactionHash: "0x" + "f".repeat(64) }]) {
      expect(settlementMatches(snapshot, { ...s, ...patch }, NOW)).toBe(false);
    }
    expect(settlementMatches({ ...snapshot, network: "Mainnet" }, s, NOW)).toBe(false);
    expect(settlementMatches({ ...snapshot, chainId: "1" }, s, NOW)).toBe(false);
    expect(settlementMatches({ ...snapshot, safeThroughBlock: 1 }, s, NOW)).toBe(false);
    expect(settlementMatches(snapshot, s, NOW + MAX_DATA_AGE_MS)).toBe(false);
    expect(recheckFeed(feed, NOW + MAX_DATA_AGE_MS).status).toBe("unavailable");
    expect(recheckFeed(feed, NOW).status).toBe("ready");
  });
  it("uses the documented endpoint", () => {
    expect(API_URL).toBe("https://api.squeekchain.com/v1/settlements?range=24h");
  });
});
