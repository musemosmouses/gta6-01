// vehicles.js — cars for Surya Bay: meshes built from boxes and cylinders,
// arcade driving physics, entering/exiting, and stealing.
// Car-vs-car contact is resolved by pushing positions apart only — never by
// multiplying speeds every frame, which pins cars together forever.
import * as THREE from "three";

const CAR_COLORS = [0xc23b2e, 0x2e6fc2, 0xe8b93b, 0x3fae6a, 0x8a5fc2, 0xd8d8d8, 0x222226, 0xe07b39, 0x2fae9e];

export function makeCarMesh(color, kind) {
  const g = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const dark = new THREE.MeshLambertMaterial({ color: 0x1c1e22 });
  const glass = new THREE.MeshLambertMaterial({ color: 0x9fc8e8 });
  const bodyGeo = new THREE.BoxGeometry(1, 1, 1);
  const isTruck = kind === "truck";
  const len = isTruck ? 5.4 : 4.2;
  const body = new THREE.Mesh(bodyGeo, paint);
  body.scale.set(1.9, 0.75, len);
  body.position.y = 0.65;
  body.castShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(bodyGeo, isTruck ? paint : glass);
  cabin.scale.set(1.7, 0.62, isTruck ? 1.4 : 2.0);
  cabin.position.set(0, 1.3, isTruck ? 1.4 : -0.2);
  cabin.castShadow = true;
  g.add(cabin);
  if (isTruck) {
    const bed = new THREE.Mesh(bodyGeo, dark);
    bed.scale.set(1.8, 0.5, 2.2);
    bed.position.set(0, 1.15, -1.3);
    g.add(bed);
  }
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141416 });
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.36, wz);
    g.add(w);
    wheels.push(w);
  }
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6c8 });
  for (const hx of [-0.6, 0.6]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.18, 0.1), headMat);
    h.position.set(hx, 0.62, len / 2 + 0.02);
    g.add(h);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xd21f1f });
  for (const tx of [-0.6, 0.6]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.18, 0.1), tailMat);
    t.position.set(tx, 0.62, -len / 2 - 0.02);
    g.add(t);
  }
  if (kind === "taxi") {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.5), new THREE.MeshBasicMaterial({ color: 0xffd23f }));
    sign.position.set(0, 1.78, -0.2);
    g.add(sign);
  }
  if (kind === "police") {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.22, 0.5), new THREE.MeshBasicMaterial({ color: 0x223344 }));
    bar.position.set(0, 1.72, -0.2);
    g.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.46), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
    red.position.set(-0.32, 1.86, -0.2);
    g.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.46), new THREE.MeshBasicMaterial({ color: 0x2040ff }));
    blue.position.set(0.32, 1.86, -0.2);
    g.add(blue);
    g.userData.lightRed = red;
    g.userData.lightBlue = blue;
  }
  g.userData.wheels = wheels;
  return g;
}

export function makeCar(G, opts) {
  const color = opts.color !== undefined ? opts.color : CAR_COLORS[G.rng.int(0, CAR_COLORS.length - 1)];
  const kind = opts.kind || "sedan";
  const mesh = makeCarMesh(color, kind);
  mesh.position.set(opts.x || 0, 0, opts.z || 0);
  mesh.rotation.y = opts.heading || 0;
  G.scene.add(mesh);
  const car = {
    mesh, kind, color,
    pos: mesh.position,
    heading: opts.heading || 0,
    speed: 0,
    steer: 0,
    driver: opts.driver || null, // 'player' | 'traffic' | 'police' | null
    isPolice: kind === "police",
    damage: 0,
    lastRam: -10,
    lastBump: -10,
    length: kind === "truck" ? 5.4 : 4.2,
    dead: false,
  };
  return car;
}

// Player driving: arcade physics with steering that bites harder at speed.
export function driveCar(G, car, dt, throttle, steerInput, handbrake) {
  const maxSpeed = 42;
  const maxReverse = 12;
  const accel = 26;
  if (throttle > 0) car.speed += accel * throttle * dt;
  else if (throttle < 0) car.speed += accel * 0.7 * throttle * dt;
  if (handbrake) car.speed *= Math.max(0, 1 - 2.4 * dt);
  else car.speed *= Math.max(0, 1 - 0.35 * dt);
  if (car.speed > maxSpeed) car.speed = maxSpeed;
  if (car.speed < -maxReverse) car.speed = -maxReverse;
  const steerTarget = steerInput * 0.55 * (car.speed >= 0 ? 1 : -1);
  car.steer += (steerTarget - car.steer) * Math.min(1, 8 * dt);
  const grip = handbrake ? 1.9 : 1.0;
  car.heading += car.steer * (car.speed / 9) * grip * dt * (car.speed >= 0 ? 1 : -1) * 0.9;
  const fx = Math.sin(car.heading);
  const fz = Math.cos(car.heading);
  car.pos.x += fx * car.speed * dt;
  car.pos.z += fz * car.speed * dt;
  car.mesh.rotation.y = car.heading;
  G.city.pushOut(car.pos, 1.6);
  const wheels = car.mesh.userData.wheels || [];
  for (const w of wheels) w.rotation.x += car.speed * dt * 1.4;
  if (Math.abs(car.speed) > 0.5) {
    G.audio.setEngine(true, Math.abs(car.speed) / maxSpeed);
  } else {
    G.audio.setEngine(false, 0);
  }
}

// Push two overlapping cars apart by position only. Speeds are left alone
// (a hard closing impact may shave a little speed, at most once a second).
export function separateCars(G, a, b) {
  const dx = b.pos.x - a.pos.x;
  const dz = b.pos.z - a.pos.z;
  const d = Math.hypot(dx, dz);
  const minD = 3.4;
  if (d >= minD || d < 0.001) return;
  const push = (minD - d) / 2;
  const nx = dx / d;
  const nz = dz / d;
  a.pos.x -= nx * push;
  a.pos.z -= nz * push;
  b.pos.x += nx * push;
  b.pos.z += nz * push;
  const closing = Math.abs(a.speed - b.speed);
  if (closing > 6 && G.time - a.lastBump > 1 && G.time - b.lastBump > 1) {
    a.lastBump = G.time;
    b.lastBump = G.time;
    a.speed *= 0.85;
    b.speed *= 0.85;
    if (a.driver === "player" || b.driver === "player") {
      G.audio.punch();
      G.shake = Math.max(G.shake, 0.25);
    }
  }
}

export function removeCar(G, car) {
  car.dead = true;
  G.scene.remove(car.mesh);
  const i = G.cars.indexOf(car);
  if (i >= 0) G.cars.splice(i, 1);
}
