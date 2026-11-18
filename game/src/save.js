// Save and load: one localStorage slot holding the money, the story progress
// and the player's health and armour. Saving never throws — a private window
// just keeps the run for this visit only.

const SAVE_KEY = 'suryabay-save-v1';

export function createSave(G) {
  function write() {
    const data = {
      cash: G.player.cash,
      mission: G.missions.index,
      health: Math.round(G.player.health),
      armor: Math.round(G.player.armor),
      pos: { x: G.player.pos.x, z: G.player.pos.z },
      savedAt: Date.now(),
    };
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  }

  function read() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (typeof data !== 'object' || data === null) return null;
      return data;
    } catch {
      return null;
    }
  }

  function clear() {
    try {
      window.localStorage.removeItem(SAVE_KEY);
    } catch {
      // Nothing to clear.
    }
  }

  return { write, read, clear };
}
