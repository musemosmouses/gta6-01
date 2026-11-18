// save.js — localStorage save / load for Surya Bay. Only plain numbers and
// strings go in; nothing the game needs at boot depends on a save existing.
const KEY = "suryabay-save-v3";

export function saveGame(S) {
  try {
    const data = {
      cash: Math.round(S.player.cash),
      missionIndex: S.missions.index,
      health: Math.round(S.player.health),
      armor: Math.round(S.player.armor),
      px: +S.player.pos.x.toFixed(1),
      pz: +S.player.pos.z.toFixed(1),
      carColor: S.player.carColor || 0xc0392b,
      muted: !!S.audio.muted,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (err) {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.cash !== "number" || typeof data.missionIndex !== "number") return null;
    return data;
  } catch (err) {
    return null;
  }
}

export function hasSave() {
  return loadGame() !== null;
}

export function clearSave() {
  try {
    window.localStorage.removeItem(KEY);
  } catch (err) {
    // Storage may be unavailable; the game plays on without it.
  }
}
