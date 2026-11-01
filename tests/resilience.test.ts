import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultSave, readBrowserSave, writeSave } from "../src/game/storage";
import { play } from "../src/ui/audio";

afterEach(() => vi.unstubAllGlobals());
describe("storage resilience", () => {
  it("starts muted and honors an existing opt-in", () => {
    expect(defaultSave().settings.muted).toBe(true);
    const data = { ...defaultSave(), solved: { tutorial: 3 }, settings: { muted: false, motion: "system" } };
    const storage = { getItem: () => JSON.stringify(data), setItem: vi.fn() } as unknown as Storage;
    const loaded = readBrowserSave({ localStorage: storage });
    expect(loaded.available).toBe(true);
    expect(loaded.save.settings.muted).toBe(false);
    expect(loaded.save.solved).toEqual({ tutorial: 3 });
    expect(storage.setItem).not.toHaveBeenCalled();
  });
  it("catches the localStorage getter and getItem independently", () => {
    const host = Object.defineProperty({}, "localStorage", { get() { throw new Error("blocked"); } });
    expect(readBrowserSave(host as Pick<Window, "localStorage">).available).toBe(false);
    expect(readBrowserSave({ localStorage: { getItem() { throw new Error("blocked"); } } as unknown as Storage }).storage).toBeNull();
  });
  it("reports denied writes rather than pretending to save", () => {
    expect(writeSave({ setItem() { throw new Error("quota"); } }, defaultSave())).toBe(false);
    expect(writeSave(null, defaultSave())).toBe(false);
    const setItem = vi.fn();
    expect(writeSave({ setItem }, defaultSave())).toBe(true);
    expect(JSON.parse(setItem.mock.calls[0][1]).version).toBe(1);
  });
});
describe("audio isolation", () => {
  it("muted playback creates no audio context", () => {
    const ctor = vi.fn(() => { throw new Error("blocked"); });
    vi.stubGlobal("window", { AudioContext: ctor });
    expect(() => play("win", true)).not.toThrow();
    expect(ctor).not.toHaveBeenCalled();
  });
  it("construction, resume and playback failures do not escape", async () => {
    const dispatchEvent = vi.fn();
    vi.stubGlobal("window", { AudioContext: class { constructor() { throw new Error("blocked"); } }, dispatchEvent });
    expect(() => play("win", false)).not.toThrow();
    expect(dispatchEvent).toHaveBeenCalledOnce();
    vi.stubGlobal("window", { AudioContext: class {
      state = "suspended";
      resume() { return Promise.reject(new Error("resume denied")); }
      createOscillator() { throw new Error("playback denied"); }
    }, dispatchEvent });
    expect(() => play("win", false)).not.toThrow();
    await Promise.resolve();
    expect(dispatchEvent.mock.calls.length).toBeGreaterThanOrEqual(3);
  });
});
