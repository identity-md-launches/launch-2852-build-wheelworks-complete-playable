import { alternatorPorts, pieceSides, type Dir, type PieceKind, type TargetDef } from "../game/sim";

/** All artwork is original inline SVG drawn for WHEELWORKS (see ASSETS.md). */

const EDGE: Record<Dir, [number, number]> = { 0: [50, 0], 1: [100, 50], 2: [50, 100], 3: [0, 50] };
const ARROW_ROT: Record<Dir, number> = { 0: 0, 1: 90, 2: 180, 3: 270 };

export function HamsterMark({ size = 40, spin = false }: { size?: number; spin?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <g className={spin ? "wheel-spin" : undefined} style={{ transformOrigin: "50px 50px" }}>
        <circle cx="50" cy="50" r="44" fill="none" stroke="#8a5a12" strokeWidth="6" />
        <circle cx="50" cy="50" r="36" fill="none" stroke="#c99a3b" strokeWidth="2" strokeDasharray="4 5" />
        {[0, 45, 90, 135].map((a) => (
          <line key={a} x1="50" y1="8" x2="50" y2="92" stroke="#c99a3b" strokeWidth="2" transform={`rotate(${a} 50 50)`} />
        ))}
      </g>
      <Hamster />
    </svg>
  );
}

function Hamster() {
  return (
    <g>
      <ellipse cx="50" cy="62" rx="24" ry="18" fill="#e9b872" stroke="#4a2f17" strokeWidth="3" />
      <ellipse cx="46" cy="66" rx="12" ry="9" fill="#fbe6c4" />
      <circle cx="66" cy="50" r="13" fill="#e9b872" stroke="#4a2f17" strokeWidth="3" />
      <circle cx="61" cy="39" r="5" fill="#f2a9a0" stroke="#4a2f17" strokeWidth="2.5" />
      <circle cx="69" cy="48" r="2.6" fill="#2b2118" />
      <circle cx="78" cy="53" r="2.2" fill="#c0504d" />
      <ellipse cx="72" cy="57" rx="4" ry="2.6" fill="#f2a9a0" opacity="0.8" />
      <path d="M38 79 q3 4 7 0 M55 79 q3 4 7 0" fill="none" stroke="#4a2f17" strokeWidth="3" strokeLinecap="round" />
    </g>
  );
}

export function SourceTile({ dir, spin }: { dir: Dir; spin: boolean }) {
  const [ex, ey] = EDGE[dir];
  return (
    <svg viewBox="0 0 100 100" className="tile-svg" aria-hidden="true" focusable="false">
      <rect x="4" y="4" width="92" height="92" rx="14" fill="#f6efe1" stroke="#8a5a12" strokeWidth="4" />
      <line x1="50" y1="50" x2={ex} y2={ey} stroke="#8a5a12" strokeWidth="12" />
      <g transform="translate(14 14) scale(0.72)">
        <HamsterMark size={100} spin={spin} />
      </g>
      <g transform={`rotate(${ARROW_ROT[dir]} 50 50)`}>
        <path d="M50 2 l9 12 h-18 z" fill="#2b2118" />
      </g>
    </svg>
  );
}

function Socket({ d }: { d: Dir }) {
  return (
    <g transform={`rotate(${ARROW_ROT[d]} 50 50)`}>
      <rect x="34" y="0" width="32" height="12" rx="3" fill="#2b2118" />
      <rect x="42" y="0" width="16" height="7" fill="#ffd166" />
    </g>
  );
}

export function TargetTile({ target, got }: { target: TargetDef; got: number }) {
  const done = got >= target.quota;
  return (
    <svg viewBox="0 0 100 100" className="tile-svg" aria-hidden="true" focusable="false">
      <rect x="8" y="8" width="84" height="84" rx="10" fill={done ? "#e3f1e6" : "#f6efe1"} stroke="#2b2118" strokeWidth="4" />
      {target.sockets.map((d) => (
        <Socket key={d} d={d} />
      ))}
      <circle cx="50" cy="40" r="17" fill="#fff" stroke="#2b2118" strokeWidth="3" />
      <text x="50" y="47" textAnchor="middle" fontSize="26" fontWeight="700" fill="#2b2118">
        {target.id}
      </text>
      <text x="50" y="80" textAnchor="middle" fontSize="21" fontWeight="700" fill="#2b2118">
        {got}/{target.quota}
      </text>
      {done && <path d="M70 18 l6 7 l12 -14" fill="none" stroke="#1f6b3d" strokeWidth="5" strokeLinecap="round" />}
    </svg>
  );
}

export function WallTile() {
  return (
    <svg viewBox="0 0 100 100" className="tile-svg" aria-hidden="true" focusable="false">
      <rect x="2" y="2" width="96" height="96" rx="6" fill="#5a4636" />
      <g stroke="#3b2d22" strokeWidth="4">
        <line x1="2" y1="34" x2="98" y2="34" />
        <line x1="2" y1="66" x2="98" y2="66" />
        <line x1="50" y1="2" x2="50" y2="34" />
        <line x1="26" y1="34" x2="26" y2="66" />
        <line x1="74" y1="34" x2="74" y2="66" />
        <line x1="50" y1="66" x2="50" y2="98" />
      </g>
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
      <path d={d} fill="none" stroke="#5c3b0c" strokeWidth="30" strokeLinecap="butt" />
      <path d={d} fill="none" stroke="#d9a441" strokeWidth="22" strokeLinecap="butt" />
      <path d={d} fill="none" stroke="#5c3b0c" strokeWidth="3" strokeDasharray="6 7" />
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
        <circle cx="50" cy="50" r="20" fill="#2b2118" />
        <circle cx="50" cy="50" r="15" fill="#f6efe1" />
        <g transform={`rotate(${ARROW_ROT[nextDir]} 50 50)`}>
          <path d="M50 30 l11 14 h-22 z" fill="#2b2118" />
        </g>
        <g transform={`rotate(${ARROW_ROT[otherDir]} 50 50)`}>
          <path d="M50 33 l7 9 h-14 z" fill="none" stroke="#2b2118" strokeWidth="2.5" />
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

export function PieceIcon({ kind }: { kind: PieceKind }) {
  return <PieceArt kind={kind} rot={kind === "straight" ? 1 : kind === "elbow" ? 2 : 0} />;
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
