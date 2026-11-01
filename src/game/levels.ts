import type { Dir, Level, PieceKind, Placement, TargetDef } from "./sim";

/**
 * Handcrafted boards. Map legend: "." floor, "#" wall, "S" wheel, "A"/"B" devices.
 * Every board carries a reference solution that tests/levels.test.ts runs
 * through the real simulation.
 */

interface TargetSpec {
  label: string;
  sockets: Dir[];
  quota: number;
}

export interface LevelSpec {
  id: string;
  name: string;
  goal: string;
  hint: string;
  map: string[];
  sourceDir: Dir;
  supply: number;
  interval: number;
  targets: Record<string, TargetSpec>;
  inventory: Partial<Record<PieceKind, number>>;
  tickBudget: number;
  fixed?: Placement[];
  solution: [number, number, PieceKind, number][];
}

export function buildLevel(spec: LevelSpec): Level {
  const h = spec.map.length;
  const w = spec.map[0].length;
  const walls: boolean[] = [];
  let source: Level["source"] | null = null;
  const targets: TargetDef[] = [];
  spec.map.forEach((row, y) => {
    if (row.length !== w) throw new Error(`${spec.id}: ragged map`);
    [...row].forEach((ch, x) => {
      walls[y * w + x] = ch === "#";
      if (ch === "S") source = { x, y, dir: spec.sourceDir, supply: spec.supply, interval: spec.interval };
      const t = spec.targets[ch];
      if (t) targets.push({ id: ch, label: t.label, x, y, sockets: t.sockets, quota: t.quota });
    });
  });
  if (!source) throw new Error(`${spec.id}: no wheel`);
  return {
    id: spec.id,
    name: spec.name,
    goal: spec.goal,
    hint: spec.hint,
    w,
    h,
    walls,
    source,
    targets: targets.sort((a, b) => a.id.localeCompare(b.id)),
    inventory: { straight: 0, elbow: 0, alternator: 0, ...spec.inventory },
    tickBudget: spec.tickBudget,
    fixed: (spec.fixed ?? []).map((p) => ({ ...p, fixed: true })),
    solution: spec.solution.map(([x, y, kind, rot]) => ({ x, y, kind, rot })),
  };
}

const N: Dir = 0;
const E: Dir = 1;
const S: Dir = 2;
const W: Dir = 3;

export const LEVEL_SPECS: LevelSpec[] = [
  {
    id: "tutorial",
    name: "First spark",
    goal: "Carry one pulse from the wheel to the cheese grater.",
    hint: "Straights start upright. Rotate them so the track runs left to right.",
    map: ["....", "S..A", "...."],
    sourceDir: E,
    supply: 1,
    interval: 1,
    targets: { A: { label: "Cheese grater", sockets: [W], quota: 1 } },
    inventory: { straight: 2 },
    tickBudget: 6,
    solution: [
      [1, 1, "straight", 1],
      [2, 1, "straight", 1],
    ],
  },
  {
    id: "straight-shot",
    name: "Straight shot",
    goal: "Send two pulses along the gap in the wall to the seed sorter.",
    hint: "A straight passes a pulse to the opposite side.",
    map: ["..#...", "..#...", "S....A", "...#..", "...#.."],
    sourceDir: E,
    supply: 2,
    interval: 2,
    targets: { A: { label: "Seed sorter", sockets: [W], quota: 2 } },
    inventory: { straight: 4 },
    tickBudget: 9,
    solution: [
      [1, 2, "straight", 1],
      [2, 2, "straight", 1],
      [3, 2, "straight", 1],
      [4, 2, "straight", 1],
    ],
  },
  {
    id: "round-the-corner",
    name: "Round the corner",
    goal: "The bedding fluffer is below the wheel's line. Turn the pulses down to it.",
    hint: "An elbow joins two neighbouring sides. Rotate it until the arc points where you need.",
    map: ["......", "S...#.", "......", "##....", "......", "...A.."],
    sourceDir: E,
    supply: 2,
    interval: 2,
    targets: { A: { label: "Bedding fluffer", sockets: [N], quota: 2 } },
    inventory: { straight: 6, elbow: 1 },
    tickBudget: 12,
    solution: [
      [1, 1, "straight", 1],
      [2, 1, "straight", 1],
      [3, 1, "elbow", 2],
      [3, 2, "straight", 0],
      [3, 3, "straight", 0],
      [3, 4, "straight", 0],
    ],
  },
  {
    id: "switchback",
    name: "Switchback",
    goal: "Snake through the walls and feed the water pump from below.",
    hint: "The pump's socket faces down. Come at it from the bottom row.",
    map: ["S..#.", "##.#.", "...#A", ".###.", "....."],
    sourceDir: E,
    supply: 2,
    interval: 3,
    targets: { A: { label: "Water pump", sockets: [S], quota: 2 } },
    inventory: { straight: 8, elbow: 5 },
    tickBudget: 18,
    solution: [
      [1, 0, "straight", 1],
      [2, 0, "elbow", 2],
      [2, 1, "straight", 0],
      [2, 2, "elbow", 3],
      [1, 2, "straight", 1],
      [0, 2, "elbow", 1],
      [0, 3, "straight", 0],
      [0, 4, "elbow", 0],
      [1, 4, "straight", 1],
      [2, 4, "straight", 1],
      [3, 4, "straight", 1],
      [4, 4, "elbow", 3],
      [4, 3, "straight", 0],
    ],
  },
  {
    id: "fork",
    name: "Fork in the wheel",
    goal: "Split four pulses evenly between the lamp and the fan.",
    hint: "An alternator sends its first arrival out of its left-hand side, the next out of the right, then repeats.",
    map: ["#.A.#", ".....", "S....", ".....", "#.B.#"],
    sourceDir: E,
    supply: 4,
    interval: 2,
    targets: {
      A: { label: "Lamp", sockets: [S], quota: 2 },
      B: { label: "Fan", sockets: [N], quota: 2 },
    },
    inventory: { straight: 3, alternator: 1 },
    tickBudget: 12,
    solution: [
      [1, 2, "straight", 1],
      [2, 2, "alternator", 0],
      [2, 1, "straight", 0],
      [2, 3, "straight", 0],
    ],
  },
  {
    id: "two-way-tally",
    name: "Two-way tally",
    goal: "Split the pulses, then turn each branch down into its device.",
    hint: "Place the alternator first, then bend each branch with an elbow.",
    map: ["#.S..#", "......", "......", "..##..", ".B..A."],
    sourceDir: S,
    supply: 4,
    interval: 2,
    targets: {
      A: { label: "Nut cracker", sockets: [N], quota: 2 },
      B: { label: "Tea kettle", sockets: [N], quota: 2 },
    },
    inventory: { straight: 4, elbow: 2, alternator: 1 },
    tickBudget: 14,
    solution: [
      [2, 1, "straight", 0],
      [2, 2, "alternator", 1],
      [3, 2, "straight", 1],
      [4, 2, "elbow", 2],
      [4, 3, "straight", 0],
      [1, 2, "elbow", 1],
      [1, 3, "straight", 0],
    ],
  },
  {
    id: "lopsided",
    name: "Lopsided order",
    goal: "Three pulses: the oven needs two, the bell needs one. Order matters.",
    hint: "The first pulse leaves the alternator on the left of its travel. Choose the side you enter from.",
    map: ["##..B.", "......", "A.....", ".#...#", "...#..", "S....#"],
    sourceDir: E,
    supply: 3,
    interval: 2,
    targets: {
      A: { label: "Acorn oven", sockets: [E], quota: 2 },
      B: { label: "Dinner bell", sockets: [S], quota: 1 },
    },
    inventory: { straight: 6, elbow: 2, alternator: 1 },
    tickBudget: 15,
    solution: [
      [1, 5, "straight", 1],
      [2, 5, "elbow", 3],
      [2, 4, "straight", 0],
      [2, 3, "straight", 0],
      [2, 2, "alternator", 3],
      [1, 2, "straight", 1],
      [3, 2, "straight", 1],
      [4, 2, "elbow", 3],
      [4, 1, "straight", 0],
    ],
  },
];

export const LEVELS: Level[] = LEVEL_SPECS.map(buildLevel);
export const levelById = (id: string) => LEVELS.find((l) => l.id === id);
