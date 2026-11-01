import { alternatorPorts, pieceSides, type Dir, type PieceKind, type TargetDef } from "../game/sim";

/** All artwork is original inline SVG drawn for WHEELWORKS (see ASSETS.md). */

const EDGE: Record<Dir, [number, number]> = { 0: [50, 0], 1: [100, 50], 2: [50, 100], 3: [0, 50] };
const ARROW_ROT: Record<Dir, number> = { 0: 0, 1: 90, 2: 180, 3: 270 };

export function HamsterMark({ size = 40, spin = false }: { size?: number; spin?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <g className={spin ? "wheel-spin" : undefined} style={{ transformOrigin: "50px 50px" }}>
        <circle cx="50" cy="50" r="44" fill="none" stroke="#845025" strokeWidth="6" />
        <circle cx="50" cy="50" r="36" fill="none" stroke="#bf945b" strokeWidth="2" strokeDasharray="4 5" />
        {[0, 45, 90, 135].map((a) => (
          <line key={a} x1="50" y1="8" x2="50" y2="92" stroke="#bf945b" strokeWidth="2" transform={`rotate(${a} 50 50)`} />
        ))}
      </g>
      <Hamster />
    </svg>
  );
}

function Hamster() {
  return (
    <g>
      <path d="M27 62q-12-2-9 8" fill="none" stroke="#b97f4d" strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="50" cy="62" rx="24" ry="18" fill="#e9b872" stroke="#49372b" strokeWidth="3" />
      <ellipse cx="46" cy="66" rx="12" ry="9" fill="#fbe6c4" />
      <circle cx="66" cy="50" r="13" fill="#e9b872" stroke="#49372b" strokeWidth="3" />
      <circle cx="61" cy="39" r="5" fill="#f2a9a0" stroke="#49372b" strokeWidth="2.5" />
      <circle cx="69" cy="48" r="3" fill="#192d3b" /><circle cx="70" cy="47" r=".9" fill="#fff" />
      <path d="M73 53l13-3m-12 7 13 2m-15 2q3 3 5 0" fill="none" stroke="#49372b" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="78" cy="53" r="2.2" fill="#c0504d" />
      <ellipse cx="72" cy="57" rx="4" ry="2.6" fill="#f2a9a0" opacity="0.8" />
      <path d="M38 79 q3 4 7 0 M55 79 q3 4 7 0" fill="none" stroke="#49372b" strokeWidth="3" strokeLinecap="round" />
    </g>
  );
}

export function SourceTile({ dir, spin }: { dir: Dir; spin: boolean }) {
  const [ex, ey] = EDGE[dir];
  return (
    <svg viewBox="0 0 100 100" className="tile-svg" aria-hidden="true" focusable="false">
      <rect x="4" y="4" width="92" height="92" rx="14" fill="#fffcf5" stroke="#845025" strokeWidth="4" />
      <line x1="50" y1="50" x2={ex} y2={ey} stroke="#845025" strokeWidth="12" />
      <g transform="translate(14 14) scale(0.72)">
        <HamsterMark size={100} spin={spin} />
      </g>
      <g transform={`rotate(${ARROW_ROT[dir]} 50 50)`}>
        <path d="M50 2 l9 12 h-18 z" fill="#192d3b" />
      </g>
    </svg>
  );
}

function Socket({ d }: { d: Dir }) {
  return (
    <g transform={`rotate(${ARROW_ROT[d]} 50 50)`}>
      <rect x="34" y="0" width="32" height="12" rx="3" fill="#192d3b" />
      <rect x="42" y="0" width="16" height="7" fill="#ffd166" />
    </g>
  );
}

export function TargetTile({ target, got }: { target: TargetDef; got: number }) {
  const done = got >= target.quota;
  return (
    <svg viewBox="0 0 100 100" className="tile-svg" aria-hidden="true" focusable="false">
      <rect x="8" y="8" width="84" height="84" rx="10" fill={done ? "#e3f1e6" : "#fffcf5"} stroke="#192d3b" strokeWidth="4" />
      {target.sockets.map((d) => (
        <Socket key={d} d={d} />
      ))}
      <g transform="translate(16 24) scale(.44)"><DeviceSilhouette label={target.label} /></g>
      <text x="69" y="50" textAnchor="middle" fontSize="28" fontWeight="700" fill="#192d3b">{target.id}</text>
      <path d="M22 61h56" stroke="#d2c9b8" strokeWidth="2" />
      <text x="50" y="83" textAnchor="middle" fontSize="23" fontWeight="700" fill={done ? "#24634e" : "#192d3b"}>{got}/{target.quota}</text>
      {done && <path d="M70 18 l6 7 l12 -14" fill="none" stroke="#1f6b3d" strokeWidth="5" strokeLinecap="round" />}
    </svg>
  );
}

/** Compact, original workshop device family; label and quota remain independently legible. */
function DeviceSilhouette({ label }: { label: string }) {
  const name = label.toLowerCase();
  let shape;
  if (/lamp|lantern/.test(name)) shape = <><path d="M50 8L24 44h52L50 8zm0 36v35M28 82h44" /><circle cx="50" cy="22" r="3" /></>;
  else if (/bell|music/.test(name)) shape = <><path d="M25 65q9-12 9-32a16 16 0 0132 0q0 20 9 32zM39 75q11 15 22 0M50 10V4" /></>;
  else if (/fan|fluffer|bellows/.test(name)) shape = <><circle cx="50" cy="45" r="32" /><path d="M50 45Q20 6 37 18T50 45Q94 30 76 22T50 45Q69 87 80 66T50 45M50 77v12M30 90h40" /><circle cx="50" cy="45" r="5" /></>;
  else if (/kettle|pump/.test(name)) shape = <><path d="M28 35h39l8 39H20zM37 28h22M47 20v8M70 40q30-5 10 25M25 43L10 28M38 9q-6-8 0-12" /></>;
  else if (/oven|kiln/.test(name)) shape = <><rect x="17" y="21" width="66" height="61" rx="5" /><path d="M17 37h66M29 49h42v23H29zM30 13l6-8m12 8 6-8m12 8 6-8" /><circle cx="29" cy="29" r="2" /><circle cx="42" cy="29" r="2" /></>;
  else if (/grater|sorter/.test(name)) shape = <><path d="M32 16h36l10 68H22zM41 16V7h18v9M35 34h7m16 0h7M33 51h9m16 0h9M31 68h11m16 0h11" /></>;
  else if (/mill/.test(name)) shape = <><path d="M18 84V47h53v37M27 15h42L58 43H38zM18 84h65M44 47v37" /><circle cx="70" cy="59" r="17" /><path d="M70 47v24M58 59h24M61 50l18 18m0-18L61 68" /></>;
  else if (/winder/.test(name)) shape = <><path d="M15 80h70M25 80V20m50 60V20M20 20h10m40 0h10M25 45h50" /><path d="M30 53c-10-24 22-38 34-20s-2 37-17 28-12-25 0-25 14 15 4 15" /></>;
  else shape = <><path d="M20 83V66h60v17M27 58V20h46v38M17 20h66M50 20V7M38 47h24" /><circle cx="50" cy="47" r="17" /><path d="M50 35v24M38 47h24" /></>;
  return <g fill="none" stroke="#845025" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">{shape}</g>;
}

export function WallTile() {
  return (
    <svg viewBox="0 0 100 100" className="tile-svg" aria-hidden="true" focusable="false">
      <rect x="8" y="8" width="84" height="84" rx="6" fill="#132a3a" stroke="#78909b" strokeWidth="2" />
      <path d="M24 26l50 48m-48 0 48-48" stroke="#3e5969" strokeWidth="5" />
      {[[19,19],[81,19],[19,81],[81,81]].map(([x,y]) => <circle key={`${x},${y}`} cx={x} cy={y} r="3" fill="#a3a28f" />)}
    </svg>
  );
}

function Track({ from, to }: { from: Dir; to: Dir }) {
  const [x1, y1] = EDGE[from];
  const [x2, y2] = EDGE[to];
  const straight = (from + 2) % 4 === to;
  const d = straight ? `M${x1} ${y1} L${x2} ${y2}` : `M${x1} ${y1} Q50 50 ${x2} ${y2}`;
  return (
    <g>
      <path d={d} fill="none" stroke="#7a4b27" strokeWidth="30" strokeLinecap="butt" />
      <path d={d} fill="none" stroke="#dfb678" strokeWidth="22" strokeLinecap="butt" />
      <path d={d} fill="none" stroke="#7a4b27" strokeWidth="3" strokeDasharray="6 7" />
    </g>
  );
}

export function PieceArt({ kind, rot, nextOut, ghost }: { kind: PieceKind; rot: number; nextOut?: 0 | 1; ghost?: boolean }) {
  const op = ghost ? 0.45 : 1;
  if (kind === "alternator") {
    const p = alternatorPorts(rot);
    const nextDir = (nextOut ?? 0) === 0 ? p.first : p.second;
    const otherDir = nextDir === p.first ? p.second : p.first;
    return (
      <svg viewBox="0 0 100 100" className="tile-svg" aria-hidden="true" focusable="false" opacity={op}>
        <Track from={p.input} to={p.first} />
        <Track from={p.input} to={p.second} />
        <circle cx="50" cy="50" r="20" fill="#192d3b" />
        <circle cx="50" cy="50" r="15" fill="#fffcf5" />
        <g transform={`rotate(${ARROW_ROT[nextDir]} 50 50)`}>
          <path d="M50 30 l11 14 h-22 z" fill="#192d3b" />
        </g>
        <g transform={`rotate(${ARROW_ROT[otherDir]} 50 50)`}>
          <path d="M50 33 l7 9 h-14 z" fill="none" stroke="#192d3b" strokeWidth="2.5" />
        </g>
      </svg>
    );
  }
  const [a, b] = pieceSides(kind, rot);
  return (
    <svg viewBox="0 0 100 100" className="tile-svg" aria-hidden="true" focusable="false" opacity={op}>
      <Track from={a} to={b} />
    </svg>
  );
}

export function FaultMark() {
  return (
    <svg viewBox="0 0 100 100" className="tile-svg fault-mark" aria-hidden="true" focusable="false">
      <circle cx="50" cy="50" r="40" fill="none" stroke="#fff" strokeWidth="12" />
      <circle cx="50" cy="50" r="40" fill="none" stroke="#c0281c" strokeWidth="7" strokeDasharray="12 6" />
      <circle cx="50" cy="50" r="17" fill="#c0281c" />
      <rect x="47" y="38" width="6" height="15" rx="2" fill="#fff" />
      <circle cx="50" cy="59" r="3.5" fill="#fff" />
    </svg>
  );
}

export function PieceIcon({ kind, rot }: { kind: PieceKind; rot: number }) {
  return <PieceArt kind={kind} rot={rot} />;
}

export function CheckIcon() {
  return (
    <svg className="icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M4 10.5l4 4l8-9" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CrossIcon() {
  return (
    <svg className="icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M5 5l10 10M15 5L5 15" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}
