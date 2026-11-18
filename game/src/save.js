// save.js — localStorage save/load for Surya Bay. Plain JSON, one key,
// guarded so a blocked storage never breaks the game.
const KEY = "suryabay-save-v2";

export function saveGame(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch (err) {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch (err) {
    // Storage unavailable; nothing to clear.
  }
}
