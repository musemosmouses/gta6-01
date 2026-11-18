// input.js — keyboard + mouse for Surya Bay.
// Keys are read, never drained: every system sees the same `tapped` set
// until the frame ends, so a menu and the game can never eat each other's input.
// Mouse look uses pointer lock; arrow keys rotate the camera as a fallback
// (and as the only camera control when pointer lock is unavailable).
export function makeInput(canvas) {
  const keys = new Set();
  const tapped = new Set();
  const buttons = new Set();
  const tappedButtons = new Set();
  let mouseDX = 0;
  let mouseDY = 0;
  let locked = false;

  function onKeyDown(e) {
    if (e.repeat) return;
    keys.add(e.code);
    tapped.add(e.code);
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
      e.preventDefault();
    }
  }
  function onKeyUp(e) {
    keys.delete(e.code);
  }
  function onMouseMove(e) {
    if (locked) {
      mouseDX += e.movementX || 0;
      mouseDY += e.movementY || 0;
    }
  }
  function onMouseDown(e) {
    buttons.add(e.button);
    tappedButtons.add(e.button);
  }
  function onMouseUp(e) {
    buttons.delete(e.button);
  }
  function onLockChange() {
    locked = document.pointerLockElement === canvas;
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mousedown", onMouseDown);
  window.addEventListener("mouseup", onMouseUp);
  document.addEventListener("pointerlockchange", onLockChange);

  function requestLock() {
    if (!locked && canvas.requestPointerLock) {
      try {
        const p = canvas.requestPointerLock();
        if (p && p.catch) p.catch(() => {});
      } catch (err) {
        // Pointer lock is a nicety; arrow keys still turn the camera.
      }
    }
  }

  function down(code) {
    return keys.has(code);
  }
  function hit(code) {
    return tapped.has(code);
  }
  function hitButton(button) {
    return tappedButtons.has(button);
  }
  // WASD / arrows drive: x = strafe right, z = forward.
  function moveAxis() {
    let x = 0;
    let z = 0;
    if (keys.has("KeyW") || keys.has("ArrowUp")) z += 1;
    if (keys.has("KeyS") || keys.has("ArrowDown")) z -= 1;
    if (keys.has("KeyD")) x += 1;
    if (keys.has("KeyA")) x -= 1;
    const len = Math.hypot(x, z) || 1;
    return { x: x / len, z: z / len };
  }
  function takeMouse() {
    const dx = mouseDX;
    const dy = mouseDY;
    mouseDX = 0;
    mouseDY = 0;
    return { dx, dy };
  }
  function endFrame() {
    tapped.clear();
    tappedButtons.clear();
  }
  function isLocked() {
    return locked;
  }
  return { down, hit, hitButton, moveAxis, takeMouse, endFrame, requestLock, isLocked };
}
