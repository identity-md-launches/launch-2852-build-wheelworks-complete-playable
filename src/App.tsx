import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LEVELS, levelById } from "./game/levels";
import {
  canPlace,
  cellAt,
  distinctRotations,
  initialState,
  layoutFrom,
  step,
  usedCounts,
  type Layout,
  type Level,
  type PieceKind,
  type Placement,
  type SimState,
} from "./game/sim";
import { challengeFromSettlement, explorerUrl, loadFeed, offlineChallenge, type Challenge, type FeedState } from "./game/challenge";
import { SHARE_PREFIX, encodeChallengeShare, encodeLevelShare, readShareFromHash } from "./game/share";
import { loadSave, writeSave, type MotionPref, type SaveData } from "./game/storage";
import { Board } from "./ui/Board";
import { CheckIcon, CrossIcon, HamsterMark, PieceIcon } from "./ui/art";
import { play } from "./ui/audio";

type Tool = PieceKind | "remove";
type Mode = "levels" | "challenge";

const TICK_MS = 480;
const FEED_POLL_MS = 60_000;
const TOOL_LABEL: Record<Tool, string> = { straight: "Straight", elbow: "Elbow", alternator: "Alternator", remove: "Remove" };
const storage = typeof window !== "undefined" ? window.localStorage : null;

function useSystemReducedMotion() {
  const [reduce, setReduce] = useState(() => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    const on = () => setReduce(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduce;
}

const shortHash = (h: string) => `${h.slice(0, 8)}…${h.slice(-6)}`;
const fmt = (n: number) => n.toLocaleString("en-US");

export default function App() {
  const [save, setSave] = useState<SaveData>(() => loadSave(storage));
  const [mode, setMode] = useState<Mode>("levels");
  const [levelId, setLevelId] = useState(save.lastLevel);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [placements, setPlacements] = useState<Placement[]>(() => save.layouts[save.lastLevel] ?? []);
  const [sim, setSim] = useState<SimState>(() => initialState(levelById(save.lastLevel)!));
  const [running, setRunning] = useState(false);
  const [tickStartedAt, setTickStartedAt] = useState(0);
  const [tool, setTool] = useState<Tool | null>(null);
  const [toolRot, setToolRot] = useState<Record<PieceKind, number>>({ straight: 0, elbow: 0, alternator: 0 });
  const [focus, setFocus] = useState({ x: 0, y: 0 });
  const [notice, setNotice] = useState<string>("");
  const [shareText, setShareText] = useState("");
  const [linkError, setLinkError] = useState("");
  const [feed, setFeed] = useState<FeedState>({ status: "loading" });
  const systemReduce = useSystemReducedMotion();
  const reducedMotion = save.settings.motion === "reduce" || (save.settings.motion === "system" && systemReduce);
  const muted = save.settings.muted;

  const level: Level = mode === "challenge" && challenge ? challenge.level : levelById(levelId)!;
  const layout: Layout = useMemo(() => layoutFrom([...level.fixed, ...placements]), [level, placements]);
  const used = usedCounts(layout);

  useEffect(() => writeSave(storage, save), [save]);

  /* ----- open a share link (once, on load) ----- */
  const openedLink = useRef(false);
  useEffect(() => {
    if (openedLink.current) return;
    openedLink.current = true;
    const parsed = readShareFromHash(window.location.hash);
    if (!parsed) return;
    if (!parsed.ok) {
      setLinkError(`That share link could not be opened: ${parsed.reason}`);
      return;
    }
    const v = parsed.value;
    if (v.kind === "level") {
      setMode("levels");
      setLevelId(v.level.id);
      setPlacements(v.placements);
      setSim(initialState(v.level));
    } else {
      setMode("challenge");
      setChallenge(v.challenge);
      challengePieces.current = v.placements;
      setPlacements(v.placements);
      setSim(initialState(v.challenge.level));
    }
    setNotice("Opened a shared board. A share link only rebuilds the board; it does not show that anyone solved it.");
  }, []);

  /* ----- live settlement feed (never touches an active challenge) ----- */
  useEffect(() => {
    let alive = true;
    const pull = async () => {
      if (document.visibilityState === "hidden") return;
      const st = await loadFeed(window.fetch.bind(window), () => Date.now());
      if (alive) setFeed(st);
    };
    void pull();
    const id = window.setInterval(pull, FEED_POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  /* ----- simulation clock: fixed tick length, one step per tick ----- */
  const simRef = useRef(sim);
  simRef.current = sim;
  const doStep = useCallback(() => {
    const before = simRef.current;
    if (before.outcome !== "running") return;
    const next = step(level, layout, before);
    simRef.current = next;
    setSim(next);
    setTickStartedAt(performance.now());
    if (next.emitted > before.emitted) play("emit", muted);
    const deliveredNow = Object.keys(next.delivered).some((k) => next.delivered[k] > before.delivered[k]);
    if (next.outcome === "won") {
      play("win", muted);
      setRunning(false);
      if (mode === "levels") {
        setSave((s) => ({ ...s, solved: { ...s.solved, [level.id]: Math.min(s.solved[level.id] ?? Infinity, next.tick) } }));
      }
    } else if (next.outcome === "failed") {
      play("fail", muted);
      setRunning(false);
    } else if (deliveredNow) play("deliver", muted);
  }, [level, layout, muted, mode]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(doStep, TICK_MS);
    return () => window.clearInterval(id);
  }, [running, doStep]);

  /* ----- editing ----- */
  const resetSim = useCallback(
    (why?: string) => {
      setRunning(false);
      const s = initialState(level);
      simRef.current = s;
      setSim(s);
      if (why) setNotice(why);
    },
    [level],
  );

  const challengePieces = useRef<Placement[]>([]);
  const commit = (next: Placement[]) => {
    const dirty = sim.tick > 0;
    setPlacements(next);
    if (mode === "challenge") challengePieces.current = next;
    if (mode === "levels") setSave((s) => ({ ...s, layouts: { ...s.layouts, [level.id]: next } }));
    if (dirty) resetSim("Layout changed, so the machine went back to tick 0.");
  };

  const pieceAt = (x: number, y: number) => placements.find((p) => p.x === x && p.y === y);

  const rotateAt = (x: number, y: number) => {
    const p = pieceAt(x, y);
    if (!p) {
      setNotice(cellAt(level, layout, x, y).type === "piece" ? "That part is bolted down." : "There is no part here to rotate.");
      return;
    }
    const rot = (p.rot + 1) % distinctRotations(p.kind);
    setToolRot((r) => ({ ...r, [p.kind]: rot }));
    commit(placements.map((q) => (q === p ? { ...q, rot } : q)));
    play("place", muted);
    setNotice("");
  };

  const removeAt = (x: number, y: number) => {
    const p = pieceAt(x, y);
    if (!p) return;
    commit(placements.filter((q) => q !== p));
    play("remove", muted);
    setNotice("");
  };

  const onCell = (x: number, y: number) => {
    const existing = pieceAt(x, y);
    if (tool === null) {
      if (existing) rotateAt(x, y);
      else setNotice("Pick a part in the parts tray first.");
      return;
    }
    if (tool === "remove") {
      if (existing) removeAt(x, y);
      else setNotice("Nothing to remove here.");
      return;
    }
    if (existing && existing.kind === tool) return rotateAt(x, y);
    const err = canPlace(level, layout, x, y, tool);
    if (err) {
      setNotice(err);
      return;
    }
    const next = placements.filter((q) => q !== existing).concat({ x, y, kind: tool, rot: toolRot[tool] });
    commit(next);
    play("place", muted);
    setNotice("");
  };

  /* ----- navigation ----- */
  const clearHash = () => {
    if (window.location.hash) history.replaceState(null, "", window.location.pathname + window.location.search);
  };

  const openLevel = (id: string) => {
    const l = levelById(id)!;
    clearHash();
    setMode("levels");
    setLevelId(id);
    setPlacements(save.layouts[id] ?? []);
    setRunning(false);
    setSim(initialState(l));
    setFocus({ x: 0, y: 0 });
    setTool(null);
    setNotice("");
    setShareText("");
    setSave((s) => ({ ...s, lastLevel: id }));
  };

  const startChallenge = (c: Challenge) => {
    clearHash();
    setChallenge(c);
    setTool(null);
    setMode("challenge");
    challengePieces.current = [];
    setPlacements([]);
    setRunning(false);
    setSim(initialState(c.level));
    setFocus({ x: 0, y: 0 });
    setShareText("");
    setNotice(c.kind === "chain" ? "Challenge locked to this settlement. Feed updates will not change it." : "Offline workshop challenge loaded.");
  };

  const showChallengeTab = () => {
    setRunning(false);
    setMode("challenge");
    setShareText("");
    if (challenge) {
      setPlacements(challengePieces.current);
      setSim(initialState(challenge.level));
    }
  };

  const share = async () => {
    const code = mode === "challenge" && challenge ? encodeChallengeShare(challenge, placements) : encodeLevelShare(level.id, placements);
    const url = `${window.location.origin}${window.location.pathname}${SHARE_PREFIX}${code}`;
    history.replaceState(null, "", `${SHARE_PREFIX}${code}`);
    setShareText(url);
    try {
      await navigator.clipboard.writeText(url);
      setNotice("Share link copied. It rebuilds this board and layout; it is not proof of a solve.");
    } catch {
      setNotice("Share link ready below. Copy it from the field.");
    }
  };

  const setSetting = (patch: Partial<SaveData["settings"]>) => setSave((s) => ({ ...s, settings: { ...s.settings, ...patch } }));

  /* ----- derived UI ----- */
  const levelIndex = LEVELS.findIndex((l) => l.id === level.id);
  const nextLevel = mode === "levels" ? LEVELS[levelIndex + 1] : undefined;
  const budget = level.tickBudget;
  const status =
    sim.outcome === "won"
      ? `Solved at tick ${sim.tick} of ${budget}. Every device reached its quota.`
      : sim.outcome === "failed"
        ? `Run failed at tick ${sim.tick}. ${sim.failReason ?? ""}`
        : running
          ? `Running: tick ${sim.tick} of ${budget}.`
          : sim.tick > 0
            ? `Paused at tick ${sim.tick} of ${budget}.`
            : `Ready. Tick budget ${budget}, ${level.source.supply} ${level.source.supply === 1 ? "pulse" : "pulses"} in the wheel.`;

  const tutorialHints = level.id === "tutorial" && mode === "levels" ? ["1,1", "2,1"] : [];
  const coach = level.id === "tutorial" && mode === "levels" ? tutorialSteps(tool, placements, sim) : null;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <HamsterMark size={36} spin={running && !reducedMotion} />
          <span className="brand-name">Wheelworks</span>
        </div>
        <div className="settings">
          <button type="button" className="btn btn-quiet" onClick={() => setSetting({ muted: !muted })}>
            {muted ? "Unmute sound" : "Mute sound"}
          </button>
        </div>
      </header>

      <main id="main">
        <h1 className="sr-only">Wheelworks, a hamster-powered routing puzzle</h1>
        <nav className="modes" aria-label="Game mode">
          <button type="button" className={`tab${mode === "levels" ? " tab-on" : ""}`} aria-current={mode === "levels" ? "page" : undefined} onClick={() => {
              if (mode !== "levels") openLevel(save.lastLevel);
            }}>
            Workshop levels
          </button>
          <button type="button" className={`tab${mode === "challenge" ? " tab-on" : ""}`} aria-current={mode === "challenge" ? "page" : undefined} onClick={showChallengeTab}>
            Squeekchain challenge
          </button>
        </nav>

        {linkError && (
          <p className="banner banner-bad" role="alert">
            {linkError}
          </p>
        )}

        {mode === "levels" && (
          <ol className="level-pick" aria-label="Levels">
            {LEVELS.map((l, i) => {
              const solved = save.solved[l.id] !== undefined;
              return (
                <li key={l.id}>
                  <button
                    type="button"
                    className={`chip${l.id === level.id ? " chip-on" : ""}${solved ? " chip-done" : ""}`}
                    aria-current={l.id === level.id ? "true" : undefined}
                    aria-label={`${i === 0 ? "Tutorial" : `Level ${i}`}: ${l.name}${solved ? ", solved" : ""}`}
                    title={l.name}
                    onClick={() => openLevel(l.id)}
                  >
                    {i === 0 ? "Learn" : i}
                    {solved && <CheckIcon />}
                  </button>
                </li>
              );
            })}
          </ol>
        )}

        {mode === "challenge" && (
          <ChallengePanel feed={feed} challenge={challenge} onStart={startChallenge} />
        )}

        {(mode === "levels" || challenge) && (
          <div className="play">
              <section className="level-head" aria-labelledby="level-title">
                <h2 id="level-title">{mode === "challenge" ? `Challenge: ${level.name}` : level.name}</h2>
                <p className="goal">{level.goal}</p>
              <ul className="targets" aria-label="Device quotas">
                {level.targets.map((t) => {
                  const got = sim.delivered[t.id] ?? 0;
                  const done = got >= t.quota;
                  return (
                    <li key={t.id} className={done ? "target-done" : undefined}>
                      <span className="badge" aria-hidden="true">
                        {t.id}
                      </span>
                      {t.label}: <strong>{got} of {t.quota}</strong>
                      {done ? " (met)" : ""}
                    </li>
                  );
                })}
              </ul>
              </section>

              <div className="board-wrap">

              <Board
                level={level}
                layout={layout}
                sim={sim}
                tickMs={TICK_MS}
                tickStartedAt={tickStartedAt}
                reducedMotion={reducedMotion}
                running={running}
                highlight={tutorialHints.filter((k) => !layout[k])}
                onCell={onCell}
                onRotate={rotateAt}
                onRemove={removeAt}
                onFocusCell={(x, y) => setFocus({ x, y })}
                focus={focus}
              />
              </div>

              <section className="run" aria-label="Machine controls">
              <div className="controls">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={sim.outcome !== "running"}
                  onClick={() => {
                    if (running) setRunning(false);
                    else {
                      setRunning(true);
                      doStep();
                    }
                  }}
                >
                  {running ? "Pause" : sim.tick > 0 && sim.outcome === "running" ? "Resume" : "Start"}
                </button>
                <button type="button" className="btn" disabled={running || sim.outcome !== "running"} onClick={doStep}>
                  Step
                </button>
                <button type="button" className="btn" disabled={sim.tick === 0 && !running} onClick={() => resetSim("Machine reset to tick 0. Your parts stay in place.")}>
                  Reset
                </button>
              </div>

              <p className={`status status-${sim.outcome}`} role="status" aria-live="polite">
                {sim.outcome === "won" && <CheckIcon />}
                {sim.outcome === "failed" && <CrossIcon />}
                {status}
              </p>
              {sim.outcome !== "running" && (
                <div className="after">
                  <button type="button" className="btn" onClick={() => resetSim()}>
                    {sim.outcome === "won" ? "Run it again" : "Reset and try again"}
                  </button>
                  {sim.outcome === "won" && nextLevel && (
                    <button type="button" className="btn btn-primary" onClick={() => openLevel(nextLevel.id)}>
                      Next: {nextLevel.name}
                    </button>
                  )}
                  {sim.outcome === "won" && mode === "levels" && !nextLevel && (
                    <button type="button" className="btn btn-primary" onClick={showChallengeTab}>
                      Try the Squeekchain challenge
                    </button>
                  )}
                </div>
              )}
              </section>

              <section className="tray" aria-labelledby="tray-title">
                <h3 id="tray-title" className="sr-only">Parts tray</h3>
                <p className="hint-line">Pick a part, then tap a floor tile. Tap a placed part to rotate it.</p>
                <div className="tools" role="group" aria-label="Choose a tool">
                  {(["straight", "elbow", "alternator"] as PieceKind[]).filter((k) => level.inventory[k] > 0).map((k) => {
                    const left = level.inventory[k] - used[k];
                    return (
                      <button
                        key={k}
                        type="button"
                        aria-pressed={tool === k}
                        className={`tool${tool === k ? " tool-on" : ""}`}
                        onClick={() => setTool(k)}
                      >
                        <span className="tool-icon">
                          <PieceIcon kind={k} />
                        </span>
                        <span className="tool-name">{TOOL_LABEL[k]}</span>
                        <span className="tool-count">
                          {left} of {level.inventory[k]} left
                        </span>
                      </button>
                    );
                  })}
                  <button type="button" aria-pressed={tool === "remove"} className={`tool${tool === "remove" ? " tool-on" : ""}`} onClick={() => setTool("remove")}>
                    <span className="tool-icon tool-x">
                      <CrossIcon />
                    </span>
                    <span className="tool-name">Remove</span>
                    <span className="tool-count">Take a part back</span>
                  </button>
                </div>
                <div className="tray-actions">
                  <button type="button" className="btn btn-quiet" disabled={placements.length === 0} onClick={() => commit([])}>
                    Clear all parts
                  </button>
                  <button type="button" className="btn btn-quiet" onClick={share}>
                    Copy share link
                  </button>
                </div>
                <p className="notice" aria-live="polite">
                  {notice}
                </p>
                {shareText && (
                  <label className="share-field">
                    <span>Share link</span>
                    <input readOnly value={shareText} onFocus={(e) => e.currentTarget.select()} />
                  </label>
                )}
              </section>

              {coach && (
                <section className="coach" aria-labelledby="coach-title">
                  <h3 id="coach-title">Tutorial</h3>
                  <ol>
                    {coach.map((s, i) => (
                      <li key={i} className={s.done ? "done" : undefined}>
                        <span className="tick" aria-hidden="true">
                          {s.done ? <CheckIcon /> : i + 1}
                        </span>
                        <span>
                          {s.text}
                          {s.done && <span className="sr-only"> (done)</span>}
                        </span>
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              <section className="rules" aria-labelledby="hint-title">
                <h3 id="hint-title">Workshop notes</h3>
                <p>{level.hint}</p>
                <details>
                  <summary>How parts and ticks work</summary>
                  <ul>
                    <li>Straight: passes a pulse to the opposite side.</li>
                    <li>Elbow: joins two neighbouring sides, either way.</li>
                    <li>Alternator: one input. The first pulse leaves on the left of its travel (solid arrow), the next on the right (outline arrow), then repeat.</li>
                    <li>Devices only accept pulses through their socket (the notch on their edge).</li>
                    <li>Each tick: the wheel emits, pulses move one tile, parts route them, collisions are checked, then devices collect.</li>
                    <li>Off the board, into a wall, onto bare floor, into a closed side or into another pulse ends the run.</li>
                    <li>Keys on the board: arrows move, Enter places or rotates, R rotates, Delete removes.</li>
                  </ul>
                </details>
                <label className="motion">
                  <span>Motion</span>
                  <select value={save.settings.motion} onChange={(e) => setSetting({ motion: e.target.value as MotionPref })}>
                    <option value="system">Follow my system</option>
                    <option value="reduce">Reduced: no gliding or spinning</option>
                    <option value="full">Full animation</option>
                  </select>
                </label>
                <details>
                  <summary>Machine log ({sim.events.length})</summary>
                  {sim.events.length === 0 ? <p>No ticks yet. Press Start or Step.</p> : (
                    <ol className="log">
                      {sim.events.map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ol>
                  )}
                </details>
              </section>
          </div>
        )}
      </main>
      <footer className="foot">
        <p>
          Wheelworks is a fan-made puzzle for the Squeekchain community. Energy pulses are fictional. Progress stays in this browser.
        </p>
      </footer>
    </div>
  );
}

function tutorialSteps(tool: Tool | null, placements: Placement[], sim: SimState) {
  const a = placements.find((p) => p.x === 1 && p.y === 1);
  const b = placements.find((p) => p.x === 2 && p.y === 1);
  const flat = (p?: Placement) => !!p && p.kind === "straight" && p.rot % 2 === 1;
  return [
    { text: "Pick Straight in the parts tray.", done: tool === "straight" || placements.length > 0 },
    { text: "Tap the dashed tile next to the wheel to place a straight.", done: !!a || !!b },
    { text: "Tap that straight again to rotate it so the track runs left to right.", done: flat(a) || flat(b) },
    { text: "Fill the second dashed tile the same way.", done: flat(a) && flat(b) },
    { text: "Press Start, then watch the pulse travel. Pause and Step work at any time.", done: sim.tick > 0 },
    { text: "Deliver the pulse to the grater to finish.", done: sim.outcome === "won" },
  ];
}

function ChallengePanel({ feed, challenge, onStart }: { feed: FeedState; challenge: Challenge | null; onStart: (c: Challenge) => void }) {
  const active = challenge?.settlement;
  const latest = feed.status === "ready" ? feed.settlement : null;
  const newer = latest && challenge?.kind === "chain" && active && latest.transactionHash !== active.transactionHash;
  const linkMatches = challenge?.fromLink && feed.status === "ready" && feed.snapshot.settlements.some((s) => s.transactionHash === active?.transactionHash && s.workAdded === active?.workAdded);

  return (
    <section className="chain" aria-labelledby="chain-title">
      <h2 id="chain-title" className="chain-title">
        A board picked by a real Squeekchain settlement
      </h2>
      <p className="fine">
        Pulses in the workshop are fictional. The settlement is real Sepolia testnet data: its transaction hash picks the board and its work added picks the energy tier.
      </p>

      {challenge && (
        <div className="source-card" aria-label="Active challenge source">
          {challenge.kind === "chain" && active ? (
            <>
              <p>
                <strong>Playing round {fmt(active.settledThroughRound)}</strong>, {challenge.tier.name.toLowerCase()} ({challenge.tier.supply} pulses) from {fmt(active.workAdded)} chain work units.
              </p>
              <p className="mono-line">
                Seed tx {shortHash(active.transactionHash)}
                {active.ethereumBlockNumber > 0 && <> in Sepolia block {fmt(active.ethereumBlockNumber)}</>}.{" "}
                {explorerUrl(active.transactionHash) && (
                  <a href={explorerUrl(active.transactionHash)!} target="_blank" rel="noopener noreferrer">
                    View the transaction on Sepolia Etherscan
                  </a>
                )}
              </p>
              {challenge.fromLink && (
                <p className="fine">{linkMatches ? "Opened from a share link. It matches a settlement in the live feed." : "Opened from a share link. Not re-checked against the live feed; use the explorer link to verify it."}</p>
              )}
            </>
          ) : (
            <p>
              <strong>Offline workshop challenge.</strong> An authored board, not linked to any transaction or chain data.
            </p>
          )}
        </div>
      )}

      {feed.status === "loading" && <p className="fine">Reading the public settlement feed…</p>}
      {feed.status === "ready" && latest && (!challenge || newer || challenge.kind === "offline") && (
        <div className="source-card">
          <p>
            Latest safe settlement: round {fmt(latest.settledThroughRound)}, {fmt(latest.workAdded)} work units, tx {shortHash(latest.transactionHash)}.
          </p>
          {newer && <p className="fine">Your current run stays on round {fmt(active!.settledThroughRound)} until you switch.</p>}
          <button type="button" className="btn btn-primary" onClick={() => onStart(challengeFromSettlement(latest))}>
            {challenge ? `Switch to round ${fmt(latest.settledThroughRound)}` : `Start round ${fmt(latest.settledThroughRound)} challenge`}
          </button>
        </div>
      )}
      {feed.status === "unavailable" && (!challenge || challenge.kind === "offline") && (
        <div className="source-card">
          <p>
            <strong>No live settlement.</strong> {feed.reason}
          </p>
          {!challenge && (
            <button type="button" className="btn btn-primary" onClick={() => onStart(offlineChallenge())}>
              Play the offline workshop challenge
            </button>
          )}
        </div>
      )}
    </section>
  );
}
