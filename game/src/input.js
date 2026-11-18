// Keyboard and mouse input for Surya Bay. Held keys are read every frame as a
// movement vector; one-shot presses (enter a car, punch, switch weapon, pause,
// mute, confirm) are queued as named actions and taken once by the loop, so a
// press between two frames is never lost and never counted twice. The mouse
// turns the camera: pointer lock when the browser grants it, click-and-drag
// otherwise, so the game still steers in a headless window.

export const ACTION_CONFIRM = 'confirm';
export const ACTION_PAUSE = 'pause';
export const ACTION_INTERACT = 'interact';
export const ACTION_PUNCH = 'punch';
export const ACTION_WEAPON = 'weapon';
export const ACTION_MUTE = 'mute';

const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'Space']);
const ONE_SHOT = new Map([
  ['Enter', ACTION_CONFIRM],
  ['Space', ACTION_CONFIRM],
  ['KeyP', ACTION_PAUSE],
  ['Escape', ACTION_PAUSE],
  ['KeyE', ACTION_INTERACT],
  ['KeyF', ACTION_PUNCH],
  ['KeyQ', ACTION_WEAPON],
  ['KeyM', ACTION_MUTE],
]);

export function createInput(canvas) {
  const keys = new Set();
  const queued = [];
  let mouseDX = 0;
  let mouseDY = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let locked = false;

  window.addEventListener('keydown', (event) => {
    if (event.target && (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA')) return;
    if (MOVE_KEYS.has(event.code) || ONE_SHOT.has(event.code)) event.preventDefault();
    keys.add(event.code);
    const action = ONE_SHOT.get(event.code);
    if (action && !event.repeat) queued.push(action);
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go on blur.
  window.addEventListener('blur', () => {
    keys.clear();
    dragging = false;
  });

  canvas.addEventListener('click', () => {
    if (document.pointerLockElement !== canvas) {
      try {
        const p = canvas.requestPointerLock();
        if (p && p.catch) p.catch(() => {});
      } catch {
        // Pointer lock is a nicety; drag-to-look below still works.
      }
    }
  });
  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === canvas;
  });
  document.addEventListener('mousemove', (event) => {
    if (locked) {
      mouseDX += event.movementX || 0;
      mouseDY += event.movementY || 0;
    } else if (dragging) {
      mouseDX += event.clientX - lastX;
      mouseDY += event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;
    }
  });
  canvas.addEventListener('pointerdown', (event) => {
    if (event.button === 0) {
      dragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
    }
  });
  window.addEventListener('pointerup', () => {
    dragging = false;
  });

  return {
    keys,
    /** True while the code is held down. */
    held(code) {
      return keys.has(code);
    },
    /** -1..1 forward/back, -1..1 left/right, from WASD or arrows. */
    moveVector() {
      const f = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
      const s = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
      return { forward: f, strafe: s, run: keys.has('ShiftLeft') || keys.has('ShiftRight') };
    },
    /** Mouse travel since the last call, in pixels. */
    takeMouse() {
      const out = { dx: mouseDX, dy: mouseDY };
      mouseDX = 0;
      mouseDY = 0;
      return out;
    },
    /** True while the left mouse button is held (dragging or locked). */
    get mouseDown() {
      return dragging || locked;
    },
    /** The one-shot actions queued since the last call. */
    takeActions() {
      const out = queued.slice();
      queued.length = 0;
      return out;
    },
    /** Queue a one-shot action from another system (touch buttons, tests). */
    queue(action) {
      queued.push(action);
    },
  };
}

