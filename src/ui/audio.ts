/** Sounds are synthesised at run time with Web Audio; no audio files ship. */

type Cue = "place" | "remove" | "emit" | "deliver" | "win" | "fail";

let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(ac: AudioContext, freq: number, start: number, dur: number, type: OscillatorType, gain: number) {
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, ac.currentTime + start);
  g.gain.exponentialRampToValueAtTime(gain, ac.currentTime + start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + start + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(ac.currentTime + start);
  osc.stop(ac.currentTime + start + dur + 0.02);
}

export function play(cue: Cue, muted: boolean) {
  if (muted) return;
  const ac = context();
  if (!ac) return;
  switch (cue) {
    case "place":
      tone(ac, 660, 0, 0.06, "triangle", 0.12);
      break;
    case "remove":
      tone(ac, 330, 0, 0.07, "triangle", 0.1);
      break;
    case "emit":
      tone(ac, 520, 0, 0.05, "sine", 0.05);
      break;
    case "deliver":
      tone(ac, 880, 0, 0.12, "sine", 0.12);
      tone(ac, 1320, 0.05, 0.12, "sine", 0.06);
      break;
    case "win":
      [523, 659, 784, 1046].forEach((f, i) => tone(ac, f, i * 0.09, 0.18, "triangle", 0.12));
      break;
    case "fail":
      tone(ac, 196, 0, 0.25, "sawtooth", 0.06);
      tone(ac, 147, 0.12, 0.3, "sawtooth", 0.05);
      break;
  }
}
