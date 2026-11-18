// hud.js — the HUD of Surya Bay: health/armor bars, cash, wanted stars,
// objective line, speed, a canvas 2D minimap, toasts, the start screen
// and the pause screen. All DOM lives in index.html; this module drives it.
export function makeHud(G) {
  const el = (id) => document.getElementById(id);
  const H = {
    stars: 0,
    toastTimer: 0,
    hintTimer: 0,
  };
  const minimap = el("minimap");
  const mctx = minimap ? minimap.getContext("2d") : null;

  H.setStars = function (n) {
    H.stars = n;
    const s = el("stars");
    if (s) s.textContent = "★".repeat(n) + "☆".repeat(5 - n);
  };

  H.toast = function (msg) {
    const t = el("toast");
    if (!t) return;
    t.textContent = msg;
    t.style.opacity = "1";
    H.toastTimer = 4;
  };

  H.setHint = function (msg) {
    const h = el("hint");
    if (!h) return;
    h.textContent = msg;
    h.style.opacity = "1";
    H.hintTimer = 3;
  };

  H.showWasted = function () {
    const w = el("wasted");
    if (w) w.style.display = "flex";
  };
  H.hideWasted = function () {
    const w = el("wasted");
    if (w) w.style.display = "none";
  };

  H.showMenu = function () {
    const m = el("menu");
    if (m) m.style.display = "flex";
  };
  H.hideMenu = function () {
    const m = el("menu");
    if (m) m.style.display = "none";
  };
  H.showPause = function () {
    const p = el("pause");
    if (p) p.style.display = "flex";
  };
  H.hidePause = function () {
    const p = el("pause");
    if (p) p.style.display = "none";
  };

  H.drawMinimap = function () {
    if (!mctx) return;
    const S = 180;
    const scale = S / 700;
    const toX = (x) => (x + 350) * scale;
    const toZ = (z) => (z + 350) * scale;
    mctx.clearRect(0, 0, S, S);
    // Sea and beach along the south edge.
    mctx.fillStyle = "#2e7fb8";
    mctx.fillRect(0, toZ(372), S, S - toZ(372));
    mctx.fillStyle = "#e6cf9e";
    mctx.fillRect(0, toZ(312), S, toZ(372) - toZ(312));
    // City ground.
    mctx.fillStyle = "#3a3f45";
    mctx.fillRect(0, 0, S, toZ(312));
    // Roads.
    mctx.strokeStyle = "#555a61";
    mctx.lineWidth = 2;
    for (const a of G.city.avenues) {
      mctx.beginPath();
      mctx.moveTo(toX(a), 0);
      mctx.lineTo(toX(a), toZ(312));
      mctx.stroke();
      mctx.beginPath();
      mctx.moveTo(0, toZ(a));
      mctx.lineTo(S, toZ(a));
      mctx.stroke();
    }
    // Spray garage and hospital.
    mctx.fillStyle = "#2f6fb8";
    mctx.fillRect(toX(G.city.garage.x) - 3, toZ(G.city.garage.z) - 3, 6, 6);
    mctx.fillStyle = "#f2f2f2";
    mctx.fillRect(toX(G.city.hospital.x) - 3, toZ(G.city.hospital.z) - 3, 6, 6);
    // Traffic cars as grey dots.
    mctx.fillStyle = "#bbbbbb";
    for (const car of G.cars) {
      if (car.dead) continue;
      mctx.fillRect(toX(car.pos.x) - 1, toZ(car.pos.z) - 1, 2, 2);
    }
    // Mission marker: pulsing yellow diamond.
    if (G.missions.marker) {
      const pulse = 4 + Math.sin(G.time * 4) * 1.5;
      mctx.fillStyle = "#ffd23f";
      const mx = toX(G.missions.marker.x);
      const mz = toZ(G.missions.marker.z);
      mctx.beginPath();
      mctx.moveTo(mx, mz - pulse);
      mctx.lineTo(mx + pulse, mz);
      mctx.lineTo(mx, mz + pulse);
      mctx.lineTo(mx - pulse, mz);
      mctx.closePath();
      mctx.fill();
    }
    // Police: blue dots with a red ring.
    for (const car of G.police.cars) {
      mctx.fillStyle = "#2e6fc2";
      mctx.beginPath();
      mctx.arc(toX(car.pos.x), toZ(car.pos.z), 3, 0, Math.PI * 2);
      mctx.fill();
      mctx.strokeStyle = "#ff2020";
      mctx.beginPath();
      mctx.arc(toX(car.pos.x), toZ(car.pos.z), 4.5, 0, Math.PI * 2);
      mctx.stroke();
    }
    for (const cop of G.police.cops) {
      mctx.fillStyle = "#2e6fc2";
      mctx.fillRect(toX(cop.pos.x) - 2, toZ(cop.pos.z) - 2, 4, 4);
    }
    // Player arrow, rotated by heading — at the car while driving.
    const p = G.player;
    const px = toX(p.car ? p.car.pos.x : p.pos.x);
    const pz = toZ(p.car ? p.car.pos.z : p.pos.z);
    mctx.save();
    mctx.translate(px, pz);
    mctx.rotate(Math.atan2(Math.sin(p.heading), Math.cos(p.heading)) + Math.PI);
    mctx.fillStyle = "#ffffff";
    mctx.beginPath();
    mctx.moveTo(0, -6);
    mctx.lineTo(4.5, 5);
    mctx.lineTo(-4.5, 5);
    mctx.closePath();
    mctx.fill();
    mctx.restore();
    // North label.
    mctx.fillStyle = "#dddddd";
    mctx.font = "bold 10px sans-serif";
    mctx.fillText("N", S - 12, 12);
  };

  H.update = function (dt) {
    const p = G.player;
    const hb = el("health-fill");
    if (hb) hb.style.width = Math.max(0, p.health) + "%";
    const ab = el("armor-fill");
    if (ab) ab.style.width = Math.max(0, p.armor) + "%";
    const cash = el("cash");
    if (cash) cash.textContent = "$" + Math.floor(p.cash);
    const obj = el("objective");
    if (obj) {
      const step = G.missions.currentStep();
      let text = G.missions.objectiveText();
      if (step) {
        const ex = p.car ? p.car.pos.x : p.pos.x;
        const ez = p.car ? p.car.pos.z : p.pos.z;
        const d = Math.hypot(ex - step.at.x, ez - step.at.z);
        text += "  •  " + Math.round(d) + "m";
        if (step.hold && d < step.r) {
          text += "  •  " + Math.max(0, step.hold - G.missions.grabTimer).toFixed(1) + "s";
        }
      }
      obj.textContent = text;
    }
    const speed = el("speed");
    if (speed) {
      if (!p.onFoot && p.car) {
        speed.textContent = Math.round(Math.abs(p.car.speed) * 3.6) + " km/h";
        speed.style.display = "block";
      } else {
        speed.style.display = "none";
      }
    }
    const ammo = el("ammo");
    if (ammo) {
      ammo.textContent = p.armed ? ("AMMO " + p.ammo + " / " + p.magSize + (p.reloading > 0 ? " — reloading…" : "")) : "";
    }
    const cross = el("crosshair");
    if (cross) cross.style.display = p.armed && p.onFoot ? "block" : "none";
    if (H.toastTimer > 0) {
      H.toastTimer -= dt;
      if (H.toastTimer <= 0) {
        const t = el("toast");
        if (t) t.style.opacity = "0";
      }
    }
    if (H.hintTimer > 0) {
      H.hintTimer -= dt;
      if (H.hintTimer <= 0) {
        const h = el("hint");
        if (h) h.style.opacity = "0";
      }
    }
    H.drawMinimap();
  };

  return H;
}
