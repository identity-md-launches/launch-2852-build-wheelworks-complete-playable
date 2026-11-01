import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { DIR_NAMES, alternatorPorts, cellAt, key, pieceSides, type Layout, type Level, type SimState } from "../game/sim";
import { FaultMark, PieceArt, SourceTile, TargetTile, WallTile } from "./art";

const PIECE_NAME = { straight: "straight conveyor", elbow: "elbow", alternator: "alternator" } as const;

function describeCell(level: Level, layout: Layout, sim: SimState, x: number, y: number): string {
  const c = cellAt(level, layout, x, y);
  const pos = `Column ${x + 1}, row ${y + 1}`;
  const fault = sim.faults.find((f) => f.x === x && f.y === y);
  const faultText = fault ? `. Fault here: ${fault.message}` : "";
  switch (c.type) {
    case "wall":
      return `${pos}: wall${faultText}`;
    case "source":
      return `${pos}: hamster wheel, pushes pulses ${DIR_NAMES[level.source.dir]}${faultText}`;
    case "target":
      return `${pos}: device ${c.target.id}, ${c.target.label}, socket on ${c.target.sockets.map((d) => DIR_NAMES[d]).join(" and ")} side, ${sim.delivered[c.target.id] ?? 0} of ${c.target.quota} pulses${faultText}`;
    case "piece": {
      const p = c.piece;
      let shape: string;
      if (p.kind === "alternator") {
        const ports = alternatorPorts(p.rot);
        const next = (sim.alt[key(x, y)] ?? 0) === 0 ? ports.first : ports.second;
        shape = `input ${DIR_NAMES[ports.input]}, outputs ${DIR_NAMES[ports.first]} then ${DIR_NAMES[ports.second]}, next ${DIR_NAMES[next]}`;
      } else {
        shape = pieceSides(p.kind, p.rot)
          .map((d) => DIR_NAMES[d])
          .join(" to ");
      }
      return `${pos}: ${PIECE_NAME[p.kind]}, ${shape}${p.fixed ? ", bolted" : ""}${faultText}`;
    }
    default:
      return `${pos}: empty floor${faultText}`;
  }
}

export interface BoardProps {
  level: Level;
  layout: Layout;
  sim: SimState;
  tickMs: number;
  tickStartedAt: number;
  reducedMotion: boolean;
  running: boolean;
  highlight: string[];
  onCell: (x: number, y: number) => void;
  onRotate: (x: number, y: number) => void;
  onRemove: (x: number, y: number) => void;
  onFocusCell: (x: number, y: number) => void;
  focus: { x: number; y: number };
}

export function Board(props: BoardProps) {
  const { level, layout, sim, focus } = props;
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const wantFocus = useRef(false);

  useEffect(() => {
    if (wantFocus.current) {
      refs.current[focus.y * level.w + focus.x]?.focus();
      wantFocus.current = false;
    }
  }, [focus, level.w]);

  const onKey = (e: KeyboardEvent, x: number, y: number) => {
    const moves: Record<string, [number, number]> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
    if (moves[e.key]) {
      e.preventDefault();
      const nx = Math.min(level.w - 1, Math.max(0, x + moves[e.key][0]));
      const ny = Math.min(level.h - 1, Math.max(0, y + moves[e.key][1]));
      wantFocus.current = true;
      props.onFocusCell(nx, ny);
    } else if (e.key === "r" || e.key === "R") {
      e.preventDefault();
      props.onRotate(x, y);
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      props.onRemove(x, y);
    }
  };

  const cells = [];
  for (let y = 0; y < level.h; y++) {
    for (let x = 0; x < level.w; x++) {
      const c = cellAt(level, layout, x, y);
      const fault = sim.faults.some((f) => f.x === x && f.y === y);
      const hl = props.highlight.includes(key(x, y));
      let art = null;
      if (c.type === "wall") art = <WallTile />;
      else if (c.type === "source") art = <SourceTile dir={level.source.dir} spin={props.running && !props.reducedMotion} />;
      else if (c.type === "target") art = <TargetTile target={c.target} got={sim.delivered[c.target.id] ?? 0} />;
      else if (c.type === "piece") art = <PieceArt kind={c.piece.kind} rot={c.piece.rot} nextOut={sim.alt[key(x, y)]} />;
      const isFocus = focus.x === x && focus.y === y;
      cells.push(
        <button
          key={key(x, y)}
          ref={(el) => {
            refs.current[y * level.w + x] = el;
          }}
          type="button"
          className={`cell cell-${c.type}${hl ? " cell-hint" : ""}${c.type === "piece" && c.piece.fixed ? " cell-fixed" : ""}`}
          tabIndex={isFocus ? 0 : -1}
          aria-label={describeCell(level, layout, sim, x, y)}
          onClick={() => {
            props.onFocusCell(x, y);
            props.onCell(x, y);
          }}
          onKeyDown={(e) => onKey(e, x, y)}
        >
          {art}
          {fault && <FaultMark />}
        </button>,
      );
    }
  }

  return (
    <div className="board-frame">
      <div
        className="board"
        role="group"
        aria-label={`Workshop board, ${level.w} columns by ${level.h} rows. Arrow keys move, Enter places or rotates, R rotates, Delete removes.`}
        style={{ gridTemplateColumns: `repeat(${level.w}, 1fr)`, aspectRatio: `${level.w} / ${level.h}` }}
      >
        {cells}
        <PulseLayer {...props} />
      </div>
    </div>
  );
}

function PulseLayer({ level, sim, tickMs, tickStartedAt, reducedMotion }: BoardProps) {
  const [now, setNow] = useState(() => performance.now());
  const progress = reducedMotion ? 1 : Math.min(1, Math.max(0, (now - tickStartedAt) / tickMs));

  useEffect(() => {
    if (reducedMotion) return;
    let raf = 0;
    const loop = () => {
      const t = performance.now();
      setNow(t);
      if (t - tickStartedAt < tickMs) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [tickStartedAt, tickMs, reducedMotion, sim]);

  const dots = sim.lastMoves.map((m) => {
    let tx = m.tx;
    let ty = m.ty;
    const off = m.tx < 0 || m.ty < 0 || m.tx >= level.w || m.ty >= level.h;
    if (off || m.fate === "fault") {
      // Stop at the edge the pulse crossed so the failure point is visible.
      tx = (m.fx + m.tx) / 2;
      ty = (m.fy + m.ty) / 2;
    }
    const x = (m.fx + (tx - m.fx) * progress) * 100 + 50;
    const y = (m.fy + (ty - m.fy) * progress) * 100 + 50;
    const fading = m.fate === "delivered" && progress >= 1;
    if (fading) return null;
    return (
      <g key={m.id}>
        <circle cx={x} cy={y} r="17" fill={m.fate === "fault" ? "#c0281c" : "#ffd166"} stroke="#2b2118" strokeWidth="4" />
        <text x={x} y={y + 7} textAnchor="middle" fontSize="21" fontWeight="700" fill={m.fate === "fault" ? "#fff" : "#2b2118"}>
          {m.id}
        </text>
      </g>
    );
  });

  return (
    <svg className="pulse-layer" viewBox={`0 0 ${level.w * 100} ${level.h * 100}`} aria-hidden="true" focusable="false">
      {dots}
    </svg>
  );
}
