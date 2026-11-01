import { describe, expect, it } from "vitest";
import { LEVELS, buildLevel } from "../src/game/levels";
import { CHALLENGE_BOARDS, OFFLINE_BOARD, TIERS, buildChallengeLevel } from "../src/game/challenge";
import { LIMITS, initialState, layoutFrom, runToEnd, step, validateLayout, type Level, type Placement } from "../src/game/sim";

const solve = (level: Level, placements: Placement[]) => runToEnd(level, layoutFrom([...level.fixed, ...placements]));

describe("handcrafted levels", () => {
  it("ships a tutorial and at least six levels", () => {
    expect(LEVELS[0].id).toBe("tutorial");
    expect(LEVELS.length).toBeGreaterThanOrEqual(7);
  });
  for (const level of LEVELS) {
    it(`${level.id}: reference solution wins within budget and inventory`, () => {
      expect(validateLayout(level, level.solution)).toBeNull();
      const end = solve(level, level.solution);
      expect(end.failReason).toBeNull();
      expect(end.outcome).toBe("won");
      expect(end.tick).toBeLessThanOrEqual(level.tickBudget);
      for (const t of level.targets) expect(end.delivered[t.id]).toBeGreaterThanOrEqual(t.quota);
    });
    it(`${level.id}: an empty board does not win`, () => {
      expect(solve(level, []).outcome).toBe("failed");
    });
  }
  it("teaching order: straight, turn, alternation, two goals", () => {
    const kinds = (l: Level) => new Set(l.solution.map((p) => p.kind));
    expect([...kinds(LEVELS[1])]).toEqual(["straight"]);
    expect(kinds(LEVELS[2]).has("elbow")).toBe(true);
    expect(kinds(LEVELS[2]).has("alternator")).toBe(false);
    expect(kinds(LEVELS[4]).has("alternator")).toBe(true);
    expect(LEVELS.slice(4).every((l) => l.targets.length === 2)).toBe(true);
    expect(kinds(LEVELS[6]).size).toBe(3);
  });
});

describe("challenge family", () => {
  for (const board of [...CHALLENGE_BOARDS, OFFLINE_BOARD]) {
    for (const tier of TIERS) {
      it(`${board.id} / ${tier.name} is solvable by its reference`, () => {
        const level = buildChallengeLevel(board, tier, "x");
        expect(validateLayout(level, level.solution)).toBeNull();
        const end = solve(level, level.solution);
        expect(end.failReason).toBeNull();
        expect(end.outcome).toBe("won");
      });
    }
  }
});

describe("determinism and rules", () => {
  const lop = LEVELS.find((l) => l.id === "lopsided")!;
  it("same inputs give identical state sequences", () => {
    const layout = layoutFrom(lop.solution);
    const run = () => {
      const states = [];
      let s = initialState(lop);
      while (s.outcome === "running") {
        s = step(lop, layout, s);
        states.push(JSON.stringify(s));
      }
      return states;
    };
    expect(run()).toEqual(run());
  });
  it("step never mutates its input and stepping one by one equals runToEnd", () => {
    const layout = layoutFrom(lop.solution);
    const s0 = initialState(lop);
    const snap = JSON.stringify(s0);
    let s = step(lop, layout, s0);
    expect(JSON.stringify(s0)).toBe(snap);
    while (s.outcome === "running") s = step(lop, layout, s);
    expect(s).toEqual(runToEnd(lop, layout));
    expect(step(lop, layout, s)).toBe(s); // finished runs do not advance
  });
  it("alternator sends first pulse left of travel, then alternates", () => {
    const end = solve(lop, lop.solution);
    expect(end.delivered).toEqual({ A: 2, B: 1 });
  });
  it("entering the alternator from the other side gives the wrong split", () => {
    // Same layout mirrored so pulses enter from above: first output goes east.
    const alt: Placement[] = lop.solution.map((p) => (p.kind === "alternator" ? { ...p, rot: 1 } : p));
    const end = solve(lop, alt);
    expect(end.outcome).toBe("failed");
    expect(end.faults[0].kind).toBe("jam");
  });
  it("reports falling off the board with a location", () => {
    const l = LEVELS[1];
    const end = solve(l, [{ x: 1, y: 2, kind: "straight", rot: 0 }]);
    expect(end.faults[0].kind).toBe("jam");
    const lvl = buildLevel({ id: "t", name: "t", goal: "", hint: "", map: ["S.A"], sourceDir: 2, supply: 1, interval: 1, targets: { A: { label: "A", sockets: [3], quota: 1 } }, inventory: {}, tickBudget: 5, solution: [] });
    const off = runToEnd(lvl, {});
    expect(off).toMatchObject({ tick: 1, outcome: "failed" });
    expect(off.faults[0].kind).toBe("offboard");
    expect(off.faults[0].message).toMatch(/fell off the board heading south from column 1, row 1/);
  });
  it("reports walls, bare floor and wrong sockets", () => {
    const mk = (map: string[], sockets: (0 | 1 | 2 | 3)[] = [3]) =>
      buildLevel({ id: "t", name: "t", goal: "", hint: "", map, sourceDir: 1, supply: 1, interval: 1, targets: { A: { label: "Lamp", sockets, quota: 1 } }, inventory: { straight: 2 }, tickBudget: 9, solution: [] });
    expect(runToEnd(mk(["S#A"]), {})).toMatchObject({ tick: 1, outcome: "failed", faults: [{ kind: "wall" }] });
    expect(runToEnd(mk(["S.A"]), {})).toMatchObject({ tick: 1, outcome: "failed", faults: [{ kind: "floor" }] });
    expect(runToEnd(mk(["SA"], [0]), {})).toMatchObject({ tick: 1, outcome: "failed", faults: [{ kind: "socket" }] });
    expect(runToEnd(mk(["SA"], [3]), {}).outcome).toBe("won");
  });
  it("a wrong straight opening jams at tick 1, with no ambiguous alternate outcome", () => {
    const lvl = buildLevel({ id: "jam", name: "", goal: "", hint: "", map: ["S.A"], sourceDir: 1, supply: 1, interval: 1, targets: { A: { label: "A", sockets: [3], quota: 1 } }, inventory: { straight: 1 }, tickBudget: 9, solution: [] });
    const end = runToEnd(lvl, layoutFrom([{ x: 1, y: 0, kind: "straight", rot: 0 }]));
    expect(end).toMatchObject({ tick: 1, outcome: "failed", faults: [{ kind: "jam", x: 1, y: 0, pulseIds: [1] }] });
  });
  it("a source-fed three-elbow route back into the wheel faults at exactly tick 4", () => {
    const lvl = buildLevel({ id: "housing", name: "", goal: "", hint: "", map: ["S.A", "..."], sourceDir: 1, supply: 1, interval: 1, targets: { A: { label: "A", sockets: [3], quota: 1 } }, inventory: { elbow: 3 }, tickBudget: 9, solution: [] });
    const end = runToEnd(lvl, layoutFrom([
      { x: 1, y: 0, kind: "elbow", rot: 2 }, { x: 1, y: 1, kind: "elbow", rot: 3 }, { x: 0, y: 1, kind: "elbow", rot: 0 },
    ]));
    expect(end.tick).toBe(4);
    expect(end.outcome).toBe("failed");
    expect(end.faults).toHaveLength(1);
    expect(end.faults[0]).toMatchObject({ kind: "housing", x: 0, y: 0, pulseIds: [1] });
  });
  const collisionLevel = buildLevel({ id: "collision", name: "", goal: "", hint: "", map: ["S...A", ".....", "....."], sourceDir: 1, supply: 0, interval: 1, targets: { A: { label: "A", sockets: [3], quota: 1 } }, inventory: { straight: 4, elbow: 4 }, tickBudget: 500, solution: [] });
  it("two opposite arrivals collide on an open straight at exactly tick 1", () => {
    // Explicit live-pulse fixture isolates collision handling from emission/routing.
    const state = { ...initialState(collisionLevel), nextId: 3, pulses: [
      { id: 1, x: 0, y: 1, heading: 1 as const }, { id: 2, x: 2, y: 1, heading: 3 as const },
    ] };
    const end = step(collisionLevel, layoutFrom([{ x: 1, y: 1, kind: "straight", rot: 1 }]), state);
    expect(end.tick).toBe(1);
    expect(end.outcome).toBe("failed");
    expect(end.faults).toHaveLength(1);
    expect(end.faults[0]).toMatchObject({ kind: "collision", x: 1, y: 1, pulseIds: [1, 2] });
    expect(end.pulses).toEqual([]);
    expect(end.lastMoves.map((m) => m.fate)).toEqual(["fault", "fault"]);
  });
  it("head-on pulses swapping adjacent open tracks collide at exactly tick 1", () => {
    const state = { ...initialState(collisionLevel), pulses: [
      { id: 1, x: 1, y: 1, heading: 1 as const }, { id: 2, x: 2, y: 1, heading: 3 as const },
    ] };
    const end = step(collisionLevel, layoutFrom([1, 2].map((x) => ({ x, y: 1, kind: "straight", rot: 1 }))), state);
    expect(end.outcome).toBe("failed");
    expect(end.tick).toBe(1);
    expect(end.faults).toHaveLength(1);
    expect(end.faults[0].kind).toBe("collision");
    expect(end.faults[0].message).toContain("head-on");
  });
  it("a pulse already circulating in a closed four-elbow ring reaches exactly the 200-tick cap without jamming", () => {
    // A closed two-port ring has no source entrance. Seed a real live pulse inside it
    // rather than mislabel a source-fed track that necessarily jams on re-entry.
    const ring = layoutFrom([
      { x: 1, y: 1, kind: "elbow", rot: 1 }, { x: 2, y: 1, kind: "elbow", rot: 2 },
      { x: 2, y: 2, kind: "elbow", rot: 3 }, { x: 1, y: 2, kind: "elbow", rot: 0 },
    ]);
    let state = { ...initialState(collisionLevel), pulses: [{ id: 1, x: 1, y: 1, heading: 1 as 0 | 1 | 2 | 3 }] };
    for (let i = 1; i <= LIMITS.maxTicks; i++) {
      state = step(collisionLevel, ring, state);
      expect(state.tick).toBe(i);
      expect(state.faults).toEqual([]);
      expect(state.pulses).toHaveLength(1);
      expect(state.outcome).toBe(i < 200 ? "running" : "failed");
    }
    expect(state.tick).toBe(200);
    expect(state.failReason).toBe("The tick budget (200) ran out before every device reached its quota.");
    expect(step(collisionLevel, ring, state)).toBe(state);
  });
});

describe("bounds", () => {
  it("supply is clamped", () => {
    const lvl = { ...LEVELS[1], source: { ...LEVELS[1].source, supply: 10_000, interval: 1 }, tickBudget: 10_000, targets: LEVELS[1].targets.map((t) => ({ ...t, quota: 10_000 })) };
    const end = runToEnd(lvl, layoutFrom(LEVELS[1].solution));
    expect(end.emitted).toBeLessThanOrEqual(LIMITS.maxSupply);
    expect(end.tick).toBeLessThanOrEqual(LIMITS.maxTicks);
  });
});
