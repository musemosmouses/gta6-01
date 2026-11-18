// The HUD: health and armour bars, cash, wanted stars, the mission
// objective line, a speed readout, toast messages, a damage flash, and the
// minimap — a 2D top-down canvas that draws the roads, the beach, the
// buildings, the mission marker, the player, the police and the traffic.
// The start, pause and busted overlays live here too, as DOM the game
// shows and hides.

export function createHud(G, callbacks) {
  const el = (id) => document.getElementById(id);
  const hud = el('hud');
  const healthFill = el('healthFill');
  const armorFill = el('armorFill');
  const cashEl = el('cash');
  const wantedEl = el('wanted');
  const objectiveEl = el('objective');
  const speedEl = el('speed');
  const toastEl = el('toast');
  const flashEl = el('flash');
  const mapCanvas = el('minimap');
  const mapCtx = mapCanvas.getContext('2d');
  const statusEl = el('status');
  let toastUntil = 0;
  let mapUntil = 0;

  el('playButton').addEventListener('click', () => callbacks.onPlay(false));
  el('continueButton').addEventListener('click', () => callbacks.onPlay(true));
  el('resumeButton').addEventListener('click', callbacks.onResume);
  el('saveButton').addEventListener('click', () => {
    if (G.save.write()) flash('Game saved');
    else flash('Save failed — storage is off');
  });
  el('quitButton').addEventListener('click', callbacks.onQuit);
  el('bustedButton').addEventListener('click', callbacks.onBusted);

  function setObjective(text) {
    objectiveEl.textContent = text;
  }

  function setWanted(stars) {
    let html = '';
    for (let i = 0; i < 5; i += 1) {
      html += i < stars ? '★' : '<span class="off">★</span>';
    }
    wantedEl.innerHTML = html;
  }

  function flash(message) {
    toastEl.textContent = message;
    toastEl.style.opacity = '1';
    toastUntil = G.time + 2.6;
    statusEl.textContent = message;
  }

  function damageFlash() {
    flashEl.style.opacity = '0.4';
    setTimeout(() => {
      flashEl.style.opacity = '0';
    }, 130);
  }

  function showStart(hasSave) {
    hud.classList.add('hidden');
    el('startScreen').classList.remove('hidden');
    el('pauseScreen').classList.add('hidden');
    el('bustedScreen').classList.add('hidden');
    el('continueButton').classList.toggle('hidden', !hasSave);
  }

  function showPause() {
    el('pauseScreen').classList.remove('hidden');
  }

  function hidePause() {
    el('pauseScreen').classList.add('hidden');
  }

  function showBusted(text) {
    el('bustedText').textContent = text;
    el('bustedScreen').classList.remove('hidden');
  }

  function hideBusted() {
    el('bustedScreen').classList.add('hidden');
  }

  function showHud() {
    hud.classList.remove('hidden');
    el('startScreen').classList.add('hidden');
    el('pauseScreen').classList.add('hidden');
    el('bustedScreen').classList.add('hidden');
  }

  function drawMinimap() {
    const S = mapCanvas.width;
    const half = G.city.half + 80;
    const toMap = (x, z) => [((x + half) / (half * 2)) * S, ((z + half) / (half * 2)) * S];
    mapCtx.clearRect(0, 0, S, S);
    // Sea and sand along the bottom edge.
    const [bx0, by0] = toMap(-half, G.city.beachZ);
    const [, by1] = toMap(half, G.city.seaZ);
    mapCtx.fillStyle = '#e6cf9a';
    mapCtx.fillRect(0, by0, S, by1 - by0);
    mapCtx.fillStyle = '#1e6f9e';
    mapCtx.fillRect(0, by1, S, S - by1);
    // Roads.
    mapCtx.strokeStyle = '#3a3f45';
    mapCtx.lineWidth = 3;
    for (const c of G.city.roadCenters) {
      const [x0, y0] = toMap(c, -half);
      const [x1, y1] = toMap(c, half);
      mapCtx.beginPath();
      mapCtx.moveTo(x0, y0);
      mapCtx.lineTo(x1, y1);
      mapCtx.stroke();
      const [x2, y2] = toMap(-half, c);
      const [x3, y3] = toMap(half, c);
      mapCtx.beginPath();
      mapCtx.moveTo(x2, y2);
      mapCtx.lineTo(x3, y3);
      mapCtx.stroke();
    }
    // Buildings.
    mapCtx.fillStyle = '#6b7280';
    for (const b of G.city.buildings) {
      const [x, y] = toMap(b.x - b.w / 2, b.z - b.d / 2);
      const w = (b.w / (half * 2)) * S;
      const h = (b.d / (half * 2)) * S;
      mapCtx.fillRect(x, y, Math.max(1, w), Math.max(1, h));
    }
    // Spray garage.
    const [sx, sy] = toMap(G.police.sprayPos.x, G.police.sprayPos.z);
    mapCtx.fillStyle = '#37c978';
    mapCtx.fillRect(sx - 3, sy - 3, 6, 6);
    // Mission marker: a pulsing yellow diamond.
    const marker = G.missions.marker;
    if (marker) {
      const [mx, my] = toMap(marker.pos.x, marker.pos.z);
      const r = 5 + Math.sin(G.time * 5) * 1.5;
      mapCtx.fillStyle = '#ffd23e';
      mapCtx.beginPath();
      mapCtx.moveTo(mx, my - r);
      mapCtx.lineTo(mx + r, my);
      mapCtx.lineTo(mx, my + r);
      mapCtx.lineTo(mx - r, my);
      mapCtx.closePath();
      mapCtx.fill();
    }
    // Police blips.
    mapCtx.fillStyle = '#ff3b30';
    for (const car of G.police.policeCars) {
      const [px, py] = toMap(car.pos.x, car.pos.z);
      mapCtx.beginPath();
      mapCtx.arc(px, py, 3, 0, Math.PI * 2);
      mapCtx.fill();
    }
    // Traffic dots.
    mapCtx.fillStyle = '#f2c230';
    for (const car of G.traffic.cars) {
      const [px, py] = toMap(car.pos.x, car.pos.z);
      mapCtx.fillRect(px - 1, py - 1, 2, 2);
    }
    // The player: a white arrow that turns with the heading.
    const [px, py] = toMap(G.player.pos.x, G.player.pos.z);
    mapCtx.save();
    mapCtx.translate(px, py);
    mapCtx.rotate(Math.atan2(Math.sin(G.player.heading), Math.cos(G.player.heading)) * -1 + Math.PI);
    mapCtx.fillStyle = '#ffffff';
    mapCtx.beginPath();
    mapCtx.moveTo(0, -6);
    mapCtx.lineTo(4.5, 5);
    mapCtx.lineTo(-4.5, 5);
    mapCtx.closePath();
    mapCtx.fill();
    mapCtx.restore();
  }

  function update() {
    const player = G.player;
    healthFill.style.width = `${Math.max(0, player.health)}%`;
    armorFill.style.width = `${Math.max(0, player.armor)}%`;
    cashEl.textContent = `$${player.cash.toLocaleString('en-US')}`;
    if (player.onFoot) {
      speedEl.classList.add('hidden');
    } else {
      speedEl.classList.remove('hidden');
      const kmh = Math.round(Math.abs(player.car ? player.car.speed : 0) * 3.6);
      speedEl.innerHTML = `${kmh} <small>km/h</small>`;
    }
    if (toastUntil > 0 && G.time > toastUntil) {
      toastEl.style.opacity = '0';
      toastUntil = 0;
    }
    if (G.time >= mapUntil) {
      mapUntil = G.time + 0.12;
      drawMinimap();
    }
  }

  return {
    setObjective,
    setWanted,
    flash,
    damageFlash,
    showStart,
    showPause,
    hidePause,
    showBusted,
    hideBusted,
    showHud,
    update,
  };
}
