// Wanted and police. Crimes add heat; heat becomes stars; stars bring the
// Bay Police. Police cars spawn on the roads and chase the player, ramming
// the player's car; at two stars and above, cops on foot join the chase and
// try to grab the player. Stay out of sight and out of trouble and the stars
// decay; drive into the spray garage and the heat is washed away for a fee.
// Getting caught means waking up at the hospital, lighter in the wallet.

import * as THREE from 'three';

export function createPolice(G) {
  let stars = 0;
  let heat = 0;
  let lastCrimeAt = -1000;
  let lastDecayAt = 0;
  const policeCars = [];
  const cops = [];
  const MAX_POLICE_CARS = 5;

  // The spray garage: drive in, pay, leave clean.
  const sprayPos = new THREE.Vector3(-40, 0, 296);
  const sprayGroup = new THREE.Group();
  {
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(16, 9, 12),
      new THREE.MeshLambertMaterial({ color: 0x3f6fb5 }),
    );
    base.position.set(sprayPos.x, 4.5, sprayPos.z);
    sprayGroup.add(base);
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(10, 2.4, 0.6),
      new THREE.MeshBasicMaterial({ color: 0xffd23e }),
    );
    sign.position.set(sprayPos.x, 8.4, sprayPos.z - 6.2);
    sprayGroup.add(sign);
    const door = new THREE.Mesh(
      new THREE.PlaneGeometry(9, 6),
      new THREE.MeshLambertMaterial({ color: 0x22262b }),
    );
    door.position.set(sprayPos.x, 3, sprayPos.z - 6.05);
    sprayGroup.add(door);
    G.scene.add(sprayGroup);
    G.city.colliders.push({ minX: sprayPos.x - 8, maxX: sprayPos.x + 8, minZ: sprayPos.z - 6, maxZ: sprayPos.z + 6 });
  }

  function setStars(n) {
    stars = Math.max(0, Math.min(5, n));
    G.hud.setWanted(stars);
  }

  function addHeat(amount, reason) {
    if (G.state !== 'play') return;
    heat += amount;
    lastCrimeAt = G.time;
    const want = Math.min(5, Math.ceil(heat / 2));
    if (want > stars) {
      setStars(want);
      G.hud.flash(reason ? `${reason} — wanted level ${want}` : `Wanted level ${want}`);
      G.audio.sirenBlip();
    }
  }

  function clearWanted() {
    heat = 0;
    setStars(0);
    for (const car of policeCars) G.vehicles.removeCar(car);
    policeCars.length = 0;
    for (const cop of cops) {
      G.scene.remove(cop.group);
      const i = G.peds.list.indexOf(cop);
      if (i !== -1) G.peds.list.splice(i, 1);
    }
    cops.length = 0;
  }

  function spawnPoliceCar() {
    const p = G.city.randomRoadPoint();
    const car = G.vehicles.spawnCar(p.x, p.z, 0, G.vehicles.POLICE_COLOR, 'police');
    policeCars.push(car);
    return car;
  }

  function spawnCop() {
    const near = G.city.randomSidewalkPoint();
    const cop = G.peds.spawnPed(near.x, near.z);
    cop.isCop = true;
    cop.state = 'walk';
    cops.push(cop);
    return cop;
  }

  function bustPlayer() {
    G.state = 'busted';
    const lost = Math.min(G.player.cash, Math.max(200, Math.floor(G.player.cash * 0.1)));
    G.player.cash -= lost;
    clearWanted();
    G.player.health = 100;
    G.player.armor = 0;
    G.hud.showBusted(`The Bay Police caught up with you. You lost $${lost} in fines.`);
    G.audio.busted();
  }

  function update(dt) {
    // Decay: quiet for a while and out of sight, and the heat cools off.
    if (stars > 0 && G.time - lastCrimeAt > 25 && G.time - lastDecayAt > 12) {
      let nearest = Infinity;
      for (const car of policeCars) nearest = Math.min(nearest, car.pos.distanceTo(G.player.pos));
      for (const cop of cops) nearest = Math.min(nearest, cop.pos.distanceTo(G.player.pos));
      if (nearest > 50) {
        heat = Math.max(0, heat - 2);
        setStars(Math.min(5, Math.ceil(heat / 2)));
        lastDecayAt = G.time;
      }
    }

    // Spray garage: drive in with heat and leave clean for $100. The
    // trigger radius (12) clears the garage collider, which ejects a car
    // to ~10.2 m on east/west approaches — the old radius of 9 could
    // never be reached from those sides.
    if (stars > 0 && !G.player.onFoot && G.player.car) {
      const d = Math.hypot(G.player.car.pos.x - sprayPos.x, G.player.car.pos.z - sprayPos.z);
      if (d < 12) {
        if (G.player.cash >= 100) {
          G.player.cash -= 100;
          clearWanted();
          G.player.car.group.children[0].material = new THREE.MeshLambertMaterial({ color: G.rng.pick(G.vehicles.COLORS) });
          G.hud.flash('Fresh paint, clean record. -$100');
          G.audio.pickup();
        } else {
          G.hud.flash('Spray garage: $100 to clear your wanted level');
        }
      }
    }

    // Police cars: one per star, chasing and ramming.
    const wantCars = Math.min(stars, MAX_POLICE_CARS);
    while (policeCars.length < wantCars) spawnPoliceCar();
    while (policeCars.length > wantCars) {
      const car = policeCars.pop();
      G.vehicles.removeCar(car);
    }
    const playerPos = G.player.onFoot ? G.player.pos : G.player.car.pos;
    for (const car of policeCars) {
      if (!car.alive) continue;
      const dx = playerPos.x - car.pos.x;
      const dz = playerPos.z - car.pos.z;
      const dist = Math.hypot(dx, dz) || 1;
      const wantHeading = Math.atan2(dx / dist, dz / dist);
      let diff = wantHeading - car.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      car.heading += Math.max(-2.2 * dt, Math.min(2.2 * dt, diff));
      const targetSpeed = dist > 90 ? 36 : 30;
      car.speed += Math.max(-18 * dt, Math.min(18 * dt, targetSpeed - car.speed));
      const fx = Math.sin(car.heading);
      const fz = Math.cos(car.heading);
      car.pos.x += fx * car.speed * dt;
      car.pos.z += fz * car.speed * dt;
      G.city.collideCircle(car.pos, 2.2);
      car.group.rotation.y = car.heading;
      car.spin += car.speed * dt * 1.4;
      for (const wheel of car.wheels) wheel.rotation.x = car.spin;
      if (dist > 320) {
        const p = G.city.randomRoadPoint();
        car.pos.set(p.x, 0, p.z);
        car.speed = 0;
      }
      // Ram: one shove per cooldown window, then the player's car can
      // pull away again. (Was: speed *= 0.85 every frame while glued,
      // which pinned the player to ~6 km/h no matter how hard they drove.)
      if (G.player.car && dist < 4.5) {
        G.player.shake = Math.max(G.player.shake || 0, 0.35);
        if (G.time - (car.lastRam || 0) > 1.5) {
          car.lastRam = G.time;
          G.player.car.speed *= 0.85;
          G.audio.crash();
        }
      }
    }

    // Cops on foot at two stars and above.
    const wantCops = stars >= 2 ? Math.min(4, stars) : 0;
    while (cops.length < wantCops) spawnCop();
    while (cops.length > wantCops) {
      const cop = cops.pop();
      G.scene.remove(cop.group);
      const i = G.peds.list.indexOf(cop);
      if (i !== -1) G.peds.list.splice(i, 1);
    }
    for (const cop of cops) {
      if (cop.state === 'down') continue;
      const dx = playerPos.x - cop.pos.x;
      const dz = playerPos.z - cop.pos.z;
      const d = Math.hypot(dx, dz) || 1;
      cop.heading = Math.atan2(dx / d, dz / d);
      const speed = d > 3 ? 5.2 : 0;
      cop.pos.x += Math.sin(cop.heading) * speed * dt;
      cop.pos.z += Math.cos(cop.heading) * speed * dt;
      cop.group.rotation.y = cop.heading;
      cop.walkPhase += dt * speed * 2.4;
      const swing = Math.sin(cop.walkPhase) * 0.55;
      cop.legL.rotation.x = swing;
      cop.legR.rotation.x = -swing;
      // A cop on top of the player for a while makes the arrest. A brief
      // break in contact decays the grab instead of wiping it, so a cop
      // the crowd jostles for a step does not restart the whole arrest.
      if (d < 2.2) {
        cop.grabTime = (cop.grabTime || 0) + dt;
        G.player.health -= 6 * dt;
        if (cop.grabTime > 2.5) bustPlayer();
      } else {
        cop.grabTime = Math.max(0, (cop.grabTime || 0) - dt * 2);
      }
    }
    G.audio.siren(stars > 0 && policeCars.length > 0);
  }

  return {
    get stars() {
      return stars;
    },
    get heat() {
      return heat;
    },
    sprayPos,
    policeCars,
    cops,
    addHeat,
    clearWanted,
    setStars,
    update,
  };
}
