/**
 * WHEELWORKS deterministic simulation.
 *
 * The simulation is a pure function of (level, layout, tick count). It has no
 * randomness, never reads the clock and never touches the DOM, so frame rate,
 * animation, audio and network polling cannot change an outcome.
 *
 * Order inside one tick (documented in README "Simulation rules"):
 *   1. Emission  - the wheel adds one pulse on its own cell when supply remains
 *                  and (tick - 1) % interval === 0.
 *   2. Movement  - every live pulse, in ascending id order, moves one cell along
 *                  its heading.
 *   3. Routing   - in ascending id order, the cell each pulse entered decides
 *                  its fate: a piece turns it (alternators flip their state in
 *                  this order), a target socket catches it, anything else is a
 *                  fault (off board, wall, bare floor, wrong side, wheel housing).
 *   4. Collisions - two pulses on the same track cell, or two pulses that swapped
 *                  cells through the same edge, are both destroyed (fault).
 *   5. Delivery  - pulses caught by target sockets are absorbed and counted.
 *   6. Outcome   - any fault fails the run; else every quota met wins; else the
 *                  tick budget or an empty machine (no supply, no live pulses)
 *                  fails it.
 */

export type Dir = 0 | 1 | 2 | 3; // 0 north, 1 east, 2 south, 3 west
export const DX = [0, 1, 0, -1] as const;
export const DY = [-1, 0, 1, 0] as const;
export const DIR_NAMES = ["north", "east", "south", "west"] as const;
export const opposite = (d: number): Dir => ((d + 2) % 4) as Dir;

export type PieceKind = "straight" | "elbow" | "alternator";
export const PIECE_KINDS: PieceKind[] = ["straight", "elbow", "alternator"];

export interface Placement {
  x: number;
  y: number;
  kind: PieceKind;
  rot: number; // 0..3
  fixed?: boolean;
}

export type Layout = Record<string, Placement>;
export const key = (x: number, y: number) => `${x},${y}`;

export interface TargetDef {
  id: string;
  label: string;
  x: number;
  y: number;
  sockets: Dir[];
  quota: number;
}

export interface SourceDef {
  x: number;
  y: number;
  dir: Dir;
  supply: number;
  interval: number;
}

export interface Level {
  id: string;
  name: string;
  goal: string;
  hint: string;
  w: number;
  h: number;
  walls: boolean[]; // index y * w + x
  source: SourceDef;
  targets: TargetDef[];
  inventory: Record<PieceKind, number>;
  tickBudget: number;
  fixed: Placement[];
  solution: Placement[];
}

/** Hard bounds: no level, share link or challenge may exceed these. */
export const LIMITS = {
  maxW: 8,
  maxH: 8,
  maxTicks: 200,
  maxSupply: 32,
  maxEvents: 120,
  maxQuota: 16,
} as const;

/* ---------- piece geometry ---------- */

/** Sides a straight connects: rot even = north-south, rot odd = east-west. */
export function pieceSides(kind: PieceKind, rot: number): Dir[] {
  const r = ((rot % 4) + 4) % 4;
  if (kind === "straight") return r % 2 === 0 ? [0, 2] : [1, 3];
  if (kind === "elbow") return [r as Dir, ((r + 1) % 4) as Dir];
  const input = ((r + 3) % 4) as Dir;
  return [input, ((input + 1) % 4) as Dir, ((input + 3) % 4) as Dir];
}

/** Alternator: input side, first output (left of travel), second output. */
export function alternatorPorts(rot: number): { input: Dir; first: Dir; second: Dir } {
  const r = ((rot % 4) + 4) % 4;
  const input = ((r + 3) % 4) as Dir;
  return { input, first: ((input + 1) % 4) as Dir, second: ((input + 3) % 4) as Dir };
}

/** Rotations that look different (straight has two). */
export const distinctRotations = (kind: PieceKind) => (kind === "straight" ? 2 : 4);

/* ---------- state ---------- */

export interface Pulse {
  id: number;
  x: number;
  y: number;
  heading: Dir;
}

export type FaultKind = "offboard" | "wall" | "floor" | "jam" | "socket" | "housing" | "collision";

export interface Fault {
  kind: FaultKind;
  tick: number;
  x: number;
  y: number;
  pulseIds: number[];
  message: string;
}

/** One pulse movement in the last tick, used only for drawing. */
export interface Move {
  id: number;
  fx: number;
  fy: number;
  tx: number;
  ty: number;
  fate: "moving" | "delivered" | "fault";
}

export type Outcome = "running" | "won" | "failed";

export interface SimState {
  tick: number;
  emitted: number;
  nextId: number;
  pulses: Pulse[];
  delivered: Record<string, number>;
  alt: Record<string, 0 | 1>; // next output: 0 first, 1 second
  outcome: Outcome;
  faults: Fault[];
  failReason: string | null;
  lastMoves: Move[];
  events: string[];
}

export function initialState(level: Level): SimState {
  const delivered: Record<string, number> = {};
  for (const t of level.targets) delivered[t.id] = 0;
  return {
    tick: 0,
    emitted: 0,
    nextId: 1,
    pulses: [],
    delivered,
    alt: {},
    outcome: "running",
    faults: [],
    failReason: null,
    lastMoves: [],
    events: [],
  };
}

export const where = (x: number, y: number) => `column ${x + 1}, row ${y + 1}`;

function pushEvent(events: string[], text: string) {
  events.push(text);
  if (events.length > LIMITS.maxEvents) events.splice(0, events.length - LIMITS.maxEvents);
}

export function cellAt(level: Level, layout: Layout, x: number, y: number) {
  if (x < 0 || y < 0 || x >= level.w || y >= level.h) return { type: "off" as const };
  if (level.walls[y * level.w + x]) return { type: "wall" as const };
  if (level.source.x === x && level.source.y === y) return { type: "source" as const };
  const target = level.targets.find((t) => t.x === x && t.y === y);
  if (target) return { type: "target" as const, target };
  const piece = layout[key(x, y)];
  if (piece) return { type: "piece" as const, piece };
  return { type: "floor" as const };
}

/** Advance exactly one tick. Pure: returns a new state, never mutates `s`. */
export function step(level: Level, layout: Layout, s: SimState): SimState {
  if (s.outcome !== "running") return s;
  const budget = Math.min(level.tickBudget, LIMITS.maxTicks);
  const supply = Math.min(level.source.supply, LIMITS.maxSupply);
  const tick = s.tick + 1;
  const events = s.events.slice();
  const alt = { ...s.alt };
  const delivered = { ...s.delivered };
  let pulses = s.pulses.map((p) => ({ ...p }));
  let emitted = s.emitted;
  let nextId = s.nextId;

  // 1. Emission
  const interval = Math.max(1, level.source.interval);
  if (emitted < supply && (tick - 1) % interval === 0) {
    pulses.push({ id: nextId, x: level.source.x, y: level.source.y, heading: level.source.dir });
    pushEvent(events, `Tick ${tick}: the wheel released pulse ${nextId}.`);
    nextId++;
    emitted++;
  }

  // 2. Movement and 3. Routing (ascending id order)
  pulses.sort((a, b) => a.id - b.id);
  const faults: Fault[] = [];
  const moves: Move[] = [];
  const arriving: { pulse: Pulse; target: TargetDef }[] = [];
  const onTrack: Pulse[] = [];
  const from = new Map<number, { x: number; y: number }>();

  for (const p of pulses) {
    const fx = p.x;
    const fy = p.y;
    from.set(p.id, { x: fx, y: fy });
    const tx = fx + DX[p.heading];
    const ty = fy + DY[p.heading];
    const entry = opposite(p.heading);
    const cell = cellAt(level, layout, tx, ty);
    const fault = (kind: FaultKind, message: string, fxAt = tx, fyAt = ty) => {
      faults.push({ kind, tick, x: fxAt, y: fyAt, pulseIds: [p.id], message });
      moves.push({ id: p.id, fx, fy, tx, ty, fate: "fault" });
    };
    switch (cell.type) {
      case "off":
        fault("offboard", `Pulse ${p.id} fell off the board heading ${DIR_NAMES[p.heading]} from ${where(fx, fy)}.`, fx, fy);
        break;
      case "wall":
        fault("wall", `Pulse ${p.id} hit a wall at ${where(tx, ty)}.`);
        break;
      case "source":
        fault("housing", `Pulse ${p.id} ran back into the wheel housing at ${where(tx, ty)}.`);
        break;
      case "floor":
        fault("floor", `Pulse ${p.id} spilled onto bare floor at ${where(tx, ty)}: no track there.`);
        break;
      case "target": {
        const t = cell.target;
        if (t.sockets.includes(entry)) {
          arriving.push({ pulse: { ...p, x: tx, y: ty }, target: t });
          moves.push({ id: p.id, fx, fy, tx, ty, fate: "delivered" });
        } else {
          fault("socket", `Pulse ${p.id} reached ${t.label} from the ${DIR_NAMES[entry]} side, but its socket faces ${t.sockets.map((d) => DIR_NAMES[d]).join(" or ")}.`);
        }
        break;
      }
      case "piece": {
        const pc = cell.piece;
        const k = key(tx, ty);
        let out: Dir | null = null;
        if (pc.kind === "alternator") {
          const ports = alternatorPorts(pc.rot);
          if (entry === ports.input) {
            const st = alt[k] ?? 0;
            out = st === 0 ? ports.first : ports.second;
            alt[k] = st === 0 ? 1 : 0;
          }
        } else {
          const sides = pieceSides(pc.kind, pc.rot);
          if (sides.includes(entry)) {
            out = pc.kind === "straight" ? opposite(entry) : sides[0] === entry ? sides[1] : sides[0];
          }
        }
        if (out === null) {
          fault("jam", `Pulse ${p.id} jammed: the ${pc.kind} at ${where(tx, ty)} has no opening on its ${DIR_NAMES[entry]} side.`);
        } else {
          onTrack.push({ id: p.id, x: tx, y: ty, heading: out });
          moves.push({ id: p.id, fx, fy, tx, ty, fate: "moving" });
        }
        break;
      }
    }
  }

  // 4. Collisions (track cells only; target sockets absorb simultaneous arrivals)
  const dead = new Set<number>();
  const byCell = new Map<string, Pulse[]>();
  for (const p of onTrack) {
    const k = key(p.x, p.y);
    const list = byCell.get(k) ?? [];
    list.push(p);
    byCell.set(k, list);
  }
  for (const [, list] of byCell) {
    if (list.length > 1) {
      const ids = list.map((p) => p.id);
      ids.forEach((id) => dead.add(id));
      faults.push({ kind: "collision", tick, x: list[0].x, y: list[0].y, pulseIds: ids, message: `Pulses ${ids.join(" and ")} collided at ${where(list[0].x, list[0].y)}.` });
    }
  }
  for (let i = 0; i < onTrack.length; i++) {
    for (let j = i + 1; j < onTrack.length; j++) {
      const a = onTrack[i];
      const b = onTrack[j];
      const fa = from.get(a.id)!;
      const fb = from.get(b.id)!;
      if (a.x === fb.x && a.y === fb.y && b.x === fa.x && b.y === fa.y && !dead.has(a.id) && !dead.has(b.id)) {
        dead.add(a.id);
        dead.add(b.id);
        faults.push({ kind: "collision", tick, x: a.x, y: a.y, pulseIds: [a.id, b.id], message: `Pulses ${a.id} and ${b.id} collided head-on between ${where(fa.x, fa.y)} and ${where(fb.x, fb.y)}.` });
      }
    }
  }
  for (const m of moves) if (dead.has(m.id)) m.fate = "fault";
  pulses = onTrack.filter((p) => !dead.has(p.id));

  // 5. Delivery
  for (const { pulse, target } of arriving) {
    delivered[target.id] = (delivered[target.id] ?? 0) + 1;
    pushEvent(events, `Tick ${tick}: ${target.label} received pulse ${pulse.id} (${delivered[target.id]} of ${target.quota}).`);
  }

  // 6. Outcome
  let outcome: Outcome = "running";
  let failReason: string | null = null;
  if (faults.length > 0) {
    outcome = "failed";
    for (const f of faults) pushEvent(events, `Tick ${tick}: ${f.message}`);
    failReason = faults[0].message;
  } else if (level.targets.every((t) => delivered[t.id] >= t.quota)) {
    outcome = "won";
    pushEvent(events, `Tick ${tick}: every device reached its quota.`);
  } else if (tick >= budget) {
    outcome = "failed";
    failReason = `The tick budget (${budget}) ran out before every device reached its quota.`;
    pushEvent(events, `Tick ${tick}: ${failReason}`);
  } else if (emitted >= supply && pulses.length === 0) {
    outcome = "failed";
    failReason = `All ${supply} pulses are spent and the quotas are not met.`;
    pushEvent(events, `Tick ${tick}: ${failReason}`);
  }

  return { tick, emitted, nextId, pulses, delivered, alt, outcome, faults, failReason, lastMoves: moves, events };
}

/** Run until the outcome is decided. Always terminates within the tick budget. */
export function runToEnd(level: Level, layout: Layout): SimState {
  let s = initialState(level);
  const cap = Math.min(level.tickBudget, LIMITS.maxTicks) + 1;
  for (let i = 0; i < cap && s.outcome === "running"; i++) s = step(level, layout, s);
  return s;
}

/* ---------- layout editing ---------- */

export function layoutFrom(placements: Placement[]): Layout {
  const out: Layout = {};
  for (const p of placements) out[key(p.x, p.y)] = { ...p, rot: ((p.rot % 4) + 4) % 4 };
  return out;
}

export function usedCounts(layout: Layout): Record<PieceKind, number> {
  const c: Record<PieceKind, number> = { straight: 0, elbow: 0, alternator: 0 };
  for (const p of Object.values(layout)) if (!p.fixed) c[p.kind]++;
  return c;
}

export function canPlace(level: Level, layout: Layout, x: number, y: number, kind: PieceKind): string | null {
  const cell = cellAt(level, layout, x, y);
  if (cell.type === "off") return "That tile is off the board.";
  if (cell.type === "wall") return "Walls cannot hold parts.";
  if (cell.type === "source") return "The wheel sits there.";
  if (cell.type === "target") return "A device sits there.";
  if (cell.type === "piece" && cell.piece.fixed) return "That part is bolted down.";
  const used = usedCounts(layout);
  const replacing = cell.type === "piece" && cell.piece.kind === kind ? 1 : 0;
  if (used[kind] - replacing >= level.inventory[kind]) return `No ${kind} parts left.`;
  return null;
}

/** Check a layout only uses free floor and stays within the inventory. */
export function validateLayout(level: Level, placements: Placement[]): string | null {
  let layout: Layout = layoutFrom(level.fixed.map((p) => ({ ...p, fixed: true })));
  for (const p of placements) {
    if (!PIECE_KINDS.includes(p.kind)) return "Unknown part.";
    if (!Number.isInteger(p.x) || !Number.isInteger(p.y) || !Number.isInteger(p.rot)) return "Bad coordinates.";
    if (layout[key(p.x, p.y)]) return "Two parts on one tile.";
    const err = canPlace(level, layout, p.x, p.y, p.kind);
    if (err) return err;
    layout = { ...layout, [key(p.x, p.y)]: { x: p.x, y: p.y, kind: p.kind, rot: ((p.rot % 4) + 4) % 4 } };
  }
  return null;
}
