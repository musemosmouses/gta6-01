// Cars: a box-built car mesh, arcade driving physics, and the enter/exit
// rules. A car is a group with a body, a cabin, four wheels and headlights;
// its physics is deliberately simple — throttle, brake, reverse, steering
// that bites harder the slower you go, and a handbrake that lets the tail
// step out — because a game that feels right at 30 km/h matters more than a
// suspension model nobody sees. Stealing a car with a driver inside sends
// the driver running and raises the wanted level.

import * as THREE from 'three';

export const CAR_COLORS = [0xd23b3b, 0x2e6fd8, 0xf2c230, 0x37c978, 0x8a5fd0, 0xe8e8e8, 0x22262b, 0xe07b39, 0x3ec6c6];
export const POLICE_COLOR = 0x1c2733;

const bodyGeo = new THREE.BoxGeometry(2.0, 0.62, 4.4);
const cabinGeo = new THREE.BoxGeometry(1.7, 0.55, 2.2);
const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
const lightGeo = new THREE.BoxGeometry(0.34, 0.18, 0.08);
const glassMat = new THREE.MeshLambertMaterial({ color: 0x18242e });
const wheelMat = new THREE.MeshLambertMaterial({ color: 0x14161a });
const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2e2e });

export function buildCarMesh(color, isPolice) {
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const body = new THREE.Mesh(bodyGeo, paint);
  body.position.y = 0.55;
  group.add(body);
  const cabin = new THREE.Mesh(cabinGeo, isPolice ? paint : glassMat);
  cabin.position.set(0, 1.08, -0.25);
  group.add(cabin);
  if (isPolice) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.2, 4.42), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    stripe.position.y = 0.62;
    group.add(stripe);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.22, 0.5), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    bar.position.set(0, 1.42, -0.25);
    group.add(bar);
    const bar2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.5), new THREE.MeshBasicMaterial({ color: 0x2244ff }));
    bar2.position.set(0.35, 1.42, -0.25);
    group.add(bar2);
  }
  const wheels = [];
  const wheelSpots = [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]];
  for (const [x, z] of wheelSpots) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.36, z);
    group.add(wheel);
    wheels.push(wheel);
  }
  const headL = new THREE.Mesh(lightGeo, headMat);
  headL.position.set(-0.6, 0.62, 2.22);
  group.add(headL);
  const headR = new THREE.Mesh(lightGeo, headMat);
  headR.position.set(0.6, 0.62, 2.22);
  group.add(headR);
  const tailL = new THREE.Mesh(lightGeo, tailMat);
  tailL.position.set(-0.6, 0.62, -2.22);
  group.add(tailL);
  const tailR = new THREE.Mesh(lightGeo, tailMat);
  tailR.position.set(0.6, 0.62, -2.22);
  group.add(tailR);
  return { group, wheels };
}

export function createVehicles(G) {
  const list = [];
  const { scene } = G;

  function spawnCar(x, z, heading, color, kind) {
    const isPolice = kind === 'police';
    const { group, wheels } = buildCarMesh(color, isPolice);
    group.position.set(x, 0, z);
    group.rotation.y = heading;
    scene.add(group);
    const car = {
      group,
      wheels,
      pos: group.position,
      heading,
      speed: 0,
      steer: 0,
      color,
      kind, // 'parked' | 'traffic' | 'police' | 'player'
      driver: null,
      isPlayer: false,
      health: 100,
      maxSpeed: kind === 'police' ? 36 : 30,
      accel: 15,
      brake: 30,
      alive: true,
      spin: 0,
    };
    list.push(car);
    return car;
  }

  function removeCar(car) {
    car.alive = false;
    scene.remove(car.group);
    const i = list.indexOf(car);
    if (i !== -1) list.splice(i, 1);
  }

  // One physics step for a driven car. input: {forward 0..1, back 0..1,
  // steer -1..1, handbrake bool}. Returns the speed after the step.
  function driveStep(car, input, dt) {
    const forward = input.forward || 0;
    const back = input.back || 0;
    const handbrake = !!input.handbrake;
    if (forward > 0) car.speed += car.accel * forward * dt;
    if (back > 0) {
      if (car.speed > 0.5) car.speed -= car.brake * back * dt;
      else car.speed -= car.accel * 0.6 * back * dt;
    }
    if (!forward && !back) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 8 * dt);
    if (handbrake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 22 * dt);
    car.speed = Math.max(-9, Math.min(car.maxSpeed, car.speed));
    const grip = handbrake ? 0.45 : 1;
    const steerTarget = (input.steer || 0) * (1 - Math.min(Math.abs(car.speed) / car.maxSpeed, 0.55) * 0.6);
    car.steer += (steerTarget - car.steer) * Math.min(1, dt * 8);
    car.heading += car.steer * (car.speed / 2.9) * grip * dt * (car.speed < 0 ? -1 : 1);
    const fx = Math.sin(car.heading);
    const fz = Math.cos(car.heading);
    car.pos.x += fx * car.speed * dt;
    car.pos.z += fz * car.speed * dt;
    G.city.collideCircle(car.pos, 2.2);
    car.group.rotation.y = car.heading;
    car.spin += car.speed * dt * 1.4;
    for (const wheel of car.wheels) wheel.rotation.x = car.spin;
    return car.speed;
  }

  // Circle-vs-circle push so cars do not drive through each other.
  function separateCars() {
    for (let a = 0; a < list.length; a += 1) {
      for (let b = a + 1; b < list.length; b += 1) {
        const A = list[a];
        const B = list[b];
        const dx = B.pos.x - A.pos.x;
        const dz = B.pos.z - A.pos.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < 16 && d2 > 0.0001) {
          const d = Math.sqrt(d2);
          const push = (4 - d) / 2;
          const nx = dx / d;
          const nz = dz / d;
          A.pos.x -= nx * push;
          A.pos.z -= nz * push;
          B.pos.x += nx * push;
          B.pos.z += nz * push;
          // A hard hit slows both cars — but only on a real closing
          // impact, and at most once a second per car. (Was: speeds
          // *= 0.6 on EVERY frame the cars overlapped, so a police car
          // glued to the player's bumper pinned them both to ~4 m/s
          // forever: each frame's acceleration was cut 40% before the
          // next frame. The police.js ram tax was only the smaller half
          // of the same pin.) Bumper-to-bumper cars at matched speed
          // have ~zero closing speed and take no cut at all.
          const avx = Math.sin(A.heading) * A.speed;
          const avz = Math.cos(A.heading) * A.speed;
          const bvx = Math.sin(B.heading) * B.speed;
          const bvz = Math.cos(B.heading) * B.speed;
          const closing = (avx - bvx) * nx + (avz - bvz) * nz;
          const hit = Math.abs(A.speed) + Math.abs(B.speed);
          if (hit > 12 && closing > 6) {
            const now = G.time;
            if (now - (A.lastHitAt || -99) > 1 && now - (B.lastHitAt || -99) > 1) {
              A.speed *= 0.6;
              B.speed *= 0.6;
              A.lastHitAt = now;
              B.lastHitAt = now;
              if (A.isPlayer || B.isPlayer) G.audio.crash();
            }
          }
        }
      }
    }
  }

  function nearestCar(pos, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const car of list) {
      if (car.kind === 'police') continue;
      const d = Math.hypot(car.pos.x - pos.x, car.pos.z - pos.z);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  // E near a car: get in (stealing a driven car spooks its driver and is a
  // crime); E while driving: get out beside the car.
  function tryEnterOrExit() {
    const player = G.player;
    if (!player.onFoot) {
      const car = player.car;
      if (!car) return;
      player.car = null;
      player.onFoot = true;
      car.isPlayer = false;
      car.speed = 0;
      const side = car.pos.clone();
      side.x += Math.cos(car.heading) * 3;
      side.z -= Math.sin(car.heading) * 3;
      player.pos.copy(G.city.collideCircle(side, 0.8));
      player.group.visible = true;
      player.group.position.copy(player.pos);
      G.hud.flash('Out of the car');
      return;
    }
    const car = nearestCar(player.pos, 5);
    if (!car) {
      G.hud.flash('No car nearby — find one on the street');
      return;
    }
    if (car.driver) {
      const driver = car.driver;
      car.driver = null;
      driver.state = 'flee';
      driver.fleeFrom = player.pos.clone();
      G.police.addHeat(1, 'stole a car');
      G.hud.flash('You stole the car! The driver ran off.');
      G.audio.sirenBlip();
    } else if (car.kind === 'parked') {
      G.police.addHeat(1, 'stole a parked car');
      G.hud.flash('You stole a parked car!');
    }
    player.car = car;
    player.onFoot = false;
    car.isPlayer = true;
    car.kind = 'player';
    player.group.visible = false;
    G.audio.click();
  }

  return { list, spawnCar, removeCar, driveStep, separateCars, nearestCar, tryEnterOrExit, COLORS: CAR_COLORS, POLICE_COLOR };
}
