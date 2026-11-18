// Traffic: AI cars that cruise the road loops. Each car owns a rectangular
// loop around one or two blocks and follows its waypoints at city speed,
// slowing when another car is ahead and waiting when the player blocks the
// road. Cars far behind the player are recycled to a fresh loop near the
// player, so the streets always feel busy without simulating the whole city.

import * as THREE from 'three';

export function createTraffic(G) {
  const cars = [];
  const MAX_TRAFFIC = 14;

  function makeLoop() {
    const vertical = G.rng.chance(0.5);
    const lineA = G.rng.pick(G.city.roadCenters);
    const lineB = lineA + (G.rng.chance(0.5) ? 56 : -56);
    const min = -G.city.half + 20;
    const max = G.city.half - 20;
    const a = G.rng.range(min, max - 120);
    const b = a + G.rng.range(90, 200);
    const pts = vertical
      ? [new THREE.Vector3(lineA, 0, a), new THREE.Vector3(lineA, 0, b), new THREE.Vector3(lineB, 0, b), new THREE.Vector3(lineB, 0, a)]
      : [new THREE.Vector3(a, 0, lineA), new THREE.Vector3(b, 0, lineA), new THREE.Vector3(b, 0, lineB), new THREE.Vector3(a, 0, lineB)];
    return { pts, i: G.rng.int(0, 3), dir: G.rng.chance(0.5) ? 1 : -1 };
  }

  function spawnTrafficCar() {
    const loop = makeLoop();
    const start = loop.pts[loop.i];
    const car = G.vehicles.spawnCar(start.x, start.z, 0, G.rng.pick(G.vehicles.COLORS), 'traffic');
    car.traffic = { loop, speed: G.rng.range(8, 11) };
    cars.push(car);
    return car;
  }

  function spawnParkedCars() {
    // A row of parked cars along the beach road and a few downtown, so there
    // is always something to steal near the spawn.
    const spots = [];
    for (let x = -240; x <= 240; x += 48) spots.push({ x, z: G.city.beachZ - 24, heading: Math.PI / 2 });
    for (let i = 0; i < 10; i += 1) {
      const p = G.city.randomRoadPoint();
      spots.push({ x: p.x + 4, z: p.z, heading: G.rng.chance(0.5) ? 0 : Math.PI / 2 });
    }
    for (const s of spots) {
      const car = G.vehicles.spawnCar(s.x, s.z, s.heading, G.rng.pick(G.vehicles.COLORS), 'parked');
      car.traffic = null;
    }
  }

  function carAhead(car, dist) {
    const fx = Math.sin(car.heading);
    const fz = Math.cos(car.heading);
    for (const other of G.vehicles.list) {
      if (other === car || !other.alive) continue;
      const dx = other.pos.x - car.pos.x;
      const dz = other.pos.z - car.pos.z;
      const along = dx * fx + dz * fz;
      const side = Math.abs(dx * fz - dz * fx);
      if (along > 0 && along < dist && side < 3.2) return true;
    }
    return false;
  }

  function update(dt) {
    const playerPos = G.player.pos;
    // Keep the streets busy near the player.
    while (cars.length < MAX_TRAFFIC) spawnTrafficCar();
    for (let i = cars.length - 1; i >= 0; i -= 1) {
      const car = cars[i];
      if (!car.alive) {
        cars.splice(i, 1);
        continue;
      }
      const t = car.traffic;
      if (!t) {
        cars.splice(i, 1);
        continue;
      }
      // Recycle cars that drifted far from the player onto a fresh loop.
      if (car.pos.distanceTo(playerPos) > 260) {
        const loop = makeLoop();
        const start = loop.pts[loop.i];
        car.pos.set(start.x, 0, start.z);
        car.traffic.loop = loop;
        car.speed = 0;
      }
      const target = t.loop.pts[t.loop.i];
      const dx = target.x - car.pos.x;
      const dz = target.z - car.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 4) {
        t.loop.i = (t.loop.i + t.loop.dir + 4) % 4;
      }
      const wantHeading = Math.atan2(dx, dz);
      let diff = wantHeading - car.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      car.heading += Math.max(-1.6 * dt, Math.min(1.6 * dt, diff));
      const blocked = carAhead(car, 11);
      const wantSpeed = blocked ? 0 : t.speed;
      car.speed += Math.max(-14 * dt, Math.min(14 * dt, wantSpeed - car.speed));
      const fx = Math.sin(car.heading);
      const fz = Math.cos(car.heading);
      car.pos.x += fx * car.speed * dt;
      car.pos.z += fz * car.speed * dt;
      G.city.collideCircle(car.pos, 2.2);
      car.group.rotation.y = car.heading;
      car.spin += car.speed * dt * 1.4;
      for (const wheel of car.wheels) wheel.rotation.x = car.spin;
    }
  }

  return { cars, spawnTrafficCar, spawnParkedCars, update };
}
