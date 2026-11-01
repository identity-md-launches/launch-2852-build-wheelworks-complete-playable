import { levelById } from "./levels";
import { validateLayout, type Placement, PIECE_KINDS } from "./sim";

/** Versioned local save. Only progress and settings; validated on every load. */

export const SAVE_KEY = "wheelworks.save";
export const SAVE_VERSION = 1;

export type MotionPref = "system" | "reduce" | "full";

export interface SaveData {
  version: 1;
  solved: Record<string, number>; // level id -> best winning tick
  layouts: Record<string, Placement[]>; // level id -> last layout
  lastLevel: string;
  settings: { muted: boolean; motion: MotionPref };
}

export const defaultSave = (): SaveData => ({
  version: 1,
  solved: {},
  layouts: {},
  lastLevel: "tutorial",
  settings: { muted: true, motion: "system" },
});

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export function validateSave(raw: unknown): SaveData {
  const out = defaultSave();
  if (!isObj(raw) || raw.version !== SAVE_VERSION) return out;
  if (isObj(raw.solved)) {
    for (const [id, tick] of Object.entries(raw.solved)) {
      if (levelById(id) && Number.isInteger(tick) && (tick as number) > 0 && (tick as number) <= 200) out.solved[id] = tick as number;
    }
  }
  if (isObj(raw.layouts)) {
    for (const [id, list] of Object.entries(raw.layouts)) {
      const level = levelById(id);
      if (!level || !Array.isArray(list) || list.length > 40) continue;
      const pieces: Placement[] = [];
      let bad = false;
      for (const p of list) {
        if (!isObj(p) || !PIECE_KINDS.includes(p.kind as never)) {
          bad = true;
          break;
        }
        pieces.push({ x: Number(p.x), y: Number(p.y), kind: p.kind as Placement["kind"], rot: Number(p.rot) });
      }
      if (!bad && validateLayout(level, pieces) === null) out.layouts[id] = pieces;
    }
  }
  if (typeof raw.lastLevel === "string" && levelById(raw.lastLevel)) out.lastLevel = raw.lastLevel;
  if (isObj(raw.settings)) {
    if (typeof raw.settings.muted === "boolean") out.settings.muted = raw.settings.muted;
    if (raw.settings.motion === "system" || raw.settings.motion === "reduce" || raw.settings.motion === "full") out.settings.motion = raw.settings.motion;
  }
  return out;
}

export function loadSave(storage: Pick<Storage, "getItem"> | null): SaveData {
  try {
    const text = storage?.getItem(SAVE_KEY);
    if (!text || text.length > 50_000) return defaultSave();
    return validateSave(JSON.parse(text));
  } catch {
    return defaultSave();
  }
}

export function writeSave(storage: Pick<Storage, "setItem"> | null, data: SaveData): boolean {
  try {
    if (!storage) return false;
    storage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

/** Accessing localStorage itself can throw. Never overwrite a save we could not read. */
export function readBrowserSave(host: Pick<Window, "localStorage">): { storage: Storage | null; save: SaveData; available: boolean } {
  try {
    const storage = host.localStorage;
    const raw = storage.getItem(SAVE_KEY);
    const save = !raw || raw.length > 50_000 ? defaultSave() : validateSave(JSON.parse(raw));
    return { storage, save, available: true };
  } catch {
    return { storage: null, save: defaultSave(), available: false };
  }
}
