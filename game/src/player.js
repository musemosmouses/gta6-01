// The player: Raka, on foot and behind the wheel. On foot he walks and runs
// with a third-person camera the mouse steers; in a car the camera swings
// behind the vehicle and the same keys drive it. Left click fires the pistol
// (a hitscan ray from the camera), F throws a punch, Q switches between
// fists and pistol. Health and armour pickups dot the city, and a traffic
// car that clips him on foot hurts — the streets are not safe.

import * as THREE from 'three';
import { buildPedMesh } from './pedestrians.js';

export function createPlayer(G) {
  const { group, legL, legR, armL, armR } = buildPedMesh(G.rng);
  // Raka stands out: a bright orange shirt and a cap.
  group.children[0].material = new THREE.MeshLambertMaterial({ color: 0xe07b39 });
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.14, 0.44), new THREE.MeshLambertMaterial({ color: 0x22262b }));
  cap.position.y = 1.86;
  group.add(cap);
  group.position.set(9, 0, 120);
  G.scene.add(group);

  const player = {
    group,
    legL,
    legR,
    armL,
    armR,
    pos: group.position,
    heading: 0,
    camYaw: 0,
    camPitch: -0.32,
    camOffset: 0,
    health: 100,
    armor: 0,
    cash: 50,
    onFoot: true,
    car: null,
    weapon: 'pistol',
    hasPackage: false,
    shake: 0,
    walkPhase: 0,
    fireCooldown: 0,
    speed: 0,
  };

  const raycaster = new THREE.Raycaster();
  raycaster.far = 70;
  const tracers = [];
  const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 });
  for (let i = 0; i < 3; i += 1) {
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const line = new THREE.Line(geo, tracerMat.clone());
    line.visible = false;
    G.scene.add(line);
    tracers.push({ line, until: 0 });
  }

  // Health crosses and armour vests, scattered near the roads.
  const pickups = [];
  const crossMat = new THREE.MeshBasicMaterial({ color: 0x37c978 });
  const vestMat = new THREE.MeshBasicMaterial({ color: 0x4aa3ff });
  const pickupGeo = new THREE.BoxGeometry(0.9, 0.9, 0.9);
  function spawnPickup(kind) {
    const p = G.city.randomRoadPoint();
    const mesh = new THREE.Mesh(pickupGeo, kind === 'health' ? crossMat : vestMat);
    mesh.position.set(p.x + 5, 1, p.z + 5);
    G.scene.add(mesh);
    pickups.push({ mesh, kind, respawnAt: 0 });
  }
  for (let i = 0; i < 5; i += 1) spawnPickup('health');
  for (let i = 0; i < 3; i += 1) spawnPickup('armor');

  function damage(amount, source) {
    if (G.state !== 'play' || player.health <= 0) return;
    const absorbed = Math.min(player.armor, amount * 0.6);
    player.armor -= absorbed;
    player.health -= (amount - absorbed);
    G.hud.damageFlash();
    if (player.health <= 0) {
      player.health = 100;
      player.armor = 0;
      player.cash = Math.max(0, player.cash - 100);
      // The hospital door is on the sidewalk beside the road (x=9), not
      // in the middle of it — a respawn on the road centre gets clipped
      // by the first passing traffic car.
      const hospital = new THREE.Vector3(9, 0, 40);
      player.pos.copy(hospital);
      player.group.position.copy(hospital);
      if (player.car) {
        player.car.isPlayer = false;
        player.car = null;
      }
      player.onFoot = true;
      player.group.visible = true;
      G.hud.flash(`You were taken out by ${source || 'the city'} — woke up at the hospital, -$100`);
      G.audio.busted();
    }
  }

  function shoot() {
    if (player.fireCooldown > 0 || player.weapon !== 'pistol') return;
    player.fireCooldown = 0.25;
    G.audio.shoot(false);
    const camera = G.camera;
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    raycaster.set(camera.position, dir);
    const targets = [];
    for (const ped of G.peds.list) {
      if (ped.state !== 'down') targets.push(ped.group);
    }
    const hits = raycaster.intersectObjects(targets, true);
    const from = camera.position.clone().add(dir.clone().multiplyScalar(1.2));
    let end = from.clone().add(dir.clone().multiplyScalar(60));
    if (hits.length > 0) {
      const hit = hits[0];
      end = hit.point.clone();
      let ped = null;
      let obj = hit.object;
      while (obj && !ped) {
        ped = G.peds.list.find((p) => p.group === obj);
        obj = obj.parent;
      }
      if (ped) {
        G.peds.knockDown(ped, 8);
        G.peds.scare(ped.pos.x, ped.pos.z, 25);
        if (ped.isCop || ped.isGang) G.police.addHeat(1, 'you shot a cop');
        else G.police.addHeat(1, 'you shot someone');
      }
    }
    const tracer = tracers.find((t) => G.time >= t.until) || tracers[0];
    tracer.line.geometry.setFromPoints([from, end]);
    tracer.line.visible = true;
    tracer.line.material.opacity = 0.9;
    tracer.until = G.time + 0.09;
    G.peds.scare(player.pos.x, player.pos.z, 30);
  }

  function punch() {
    G.audio.punch();
    const fx = Math.sin(player.heading);
    const fz = Math.cos(player.heading);
    const target = G.peds.nearestPed(player.pos, 2.4, false);
    if (!target) return;
    const dx = target.pos.x - player.pos.x;
    const dz = target.pos.z - player.pos.z;
    if (dx * fx + dz * fz < 0) return; // Behind the player.
    G.peds.knockDown(target, 5);
    target.pos.x += dx * 0.4;
    target.pos.z += dz * 0.4;
    if (target.isCop) G.police.addHeat(1, 'you punched a cop');
    else G.police.addHeat(1, 'you punched someone');
    G.peds.scare(target.pos.x, target.pos.z, 18);
  }

  function update(dt) {
    player.fireCooldown = Math.max(0, player.fireCooldown - dt);
    player.shake = Math.max(0, player.shake - dt * 1.4);
    for (const t of tracers) {
      if (t.line.visible && G.time >= t.until) t.line.visible = false;
    }

    const mouse = G.input.takeMouse();
    player.camYaw -= mouse.dx * 0.0032;
    player.camPitch = Math.max(-1.1, Math.min(0.5, player.camPitch - mouse.dy * 0.0024));
    const actions = G.input.takeActions();
    for (const action of actions) {
      if (action === 'interact') G.vehicles.tryEnterOrExit();
      else if (action === 'punch') punch();
      else if (action === 'weapon') {
        player.weapon = player.weapon === 'pistol' ? 'fists' : 'pistol';
        G.hud.flash(player.weapon === 'pistol' ? 'Pistol ready' : 'Fists up');
      }
    }
    if (G.input.mouseDown && player.onFoot) {
      if (!player._wasDown) shoot();
      player._wasDown = true;
    } else {
      player._wasDown = false;
    }

    const move = G.input.moveVector();
    if (player.onFoot) {
      const speed = move.run ? 10 : 6;
      const sin = Math.sin(player.camYaw);
      const cos = Math.cos(player.camYaw);
      // Forward is away from the camera (-sin, -cos); right is (cos, -sin).
      const mx = -sin * move.forward + cos * move.strafe;
      const mz = -cos * move.forward - sin * move.strafe;
      const len = Math.hypot(mx, mz);
      if (len > 0.01) {
        const nx = mx / len;
        const nz = mz / len;
        player.pos.x += nx * speed * dt;
        player.pos.z += nz * speed * dt;
        const wantHeading = Math.atan2(nx, nz);
        let diff = wantHeading - player.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        player.heading += Math.max(-10 * dt, Math.min(10 * dt, diff));
        player.walkPhase += dt * speed * 1.6;
        const swing = Math.sin(player.walkPhase) * 0.6;
        legL.rotation.x = swing;
        legR.rotation.x = -swing;
        armL.rotation.x = -swing * 0.7;
        armR.rotation.x = swing * 0.7;
        player.speed = speed;
      } else {
        player.speed = 0;
        legL.rotation.x *= 0.8;
        legR.rotation.x *= 0.8;
        armL.rotation.x *= 0.8;
        armR.rotation.x *= 0.8;
      }
      G.city.collideCircle(player.pos, 0.8);
      group.rotation.y = player.heading;
      G.audio.engineOff();
      // Traffic that clips the player on foot hurts — once per car per
      // second, so one brush with a bumper is not a death sentence.
      for (const car of G.vehicles.list) {
        if (car.kind === 'traffic' || car.kind === 'police') {
          const d = Math.hypot(car.pos.x - player.pos.x, car.pos.z - player.pos.z);
          if (d < 1.9 && Math.abs(car.speed) > 3 && G.time - (car.lastHitPlayer || 0) > 1.2) {
            car.lastHitPlayer = G.time;
            damage(Math.min(20, 5 + Math.abs(car.speed) * 0.8), 'a car');
            player.shake = 0.5;
            player.pos.x += (player.pos.x - car.pos.x) * 0.8;
            player.pos.z += (player.pos.z - car.pos.z) * 0.8;
            G.audio.crash();
          }
        }
      }
    } else if (player.car) {
      const car = player.car;
      const steer = (move.strafe || 0);
      G.vehicles.driveStep(car, {
        forward: move.forward > 0 ? 1 : 0,
        back: move.forward < 0 ? 1 : 0,
        steer,
        handbrake: G.input.held('Space'),
      }, dt);
      player.pos.copy(car.pos);
      player.heading = car.heading;
      player.speed = Math.abs(car.speed);
      G.audio.engine(car.speed, move.forward > 0 ? 1 : 0);
    }

    // Pickups: walk or drive over one to collect it.
    for (const pk of pickups) {
      if (pk.respawnAt > 0) {
        if (G.time >= pk.respawnAt) {
          pk.respawnAt = 0;
          pk.mesh.visible = true;
        }
        continue;
      }
      pk.mesh.rotation.y += dt;
      pk.mesh.position.y = 1 + Math.sin(G.time * 3 + pk.mesh.position.x) * 0.15;
      const d = Math.hypot(pk.mesh.position.x - player.pos.x, pk.mesh.position.z - player.pos.z);
      if (d < 2.2) {
        if (pk.kind === 'health') {
          player.health = Math.min(100, player.health + 40);
          G.hud.flash('Health +40');
        } else {
          player.armor = Math.min(100, player.armor + 50);
          G.hud.flash('Armour +50');
        }
        G.audio.pickup();
        pk.mesh.visible = false;
        pk.respawnAt = G.time + 60;
      }
    }

    // Third-person camera.
    const camera = G.camera;
    const shakeX = player.shake > 0 ? (Math.random() - 0.5) * player.shake * 0.7 : 0;
    const shakeY = player.shake > 0 ? (Math.random() - 0.5) * player.shake * 0.7 : 0;
    if (player.onFoot) {
      const dist = 7;
      const cx = player.pos.x + Math.sin(player.camYaw) * Math.cos(player.camPitch) * dist;
      const cz = player.pos.z + Math.cos(player.camYaw) * Math.cos(player.camPitch) * dist;
      const cy = 2.2 + Math.sin(-player.camPitch) * dist * 0.9 + 1.4;
      camera.position.set(cx + shakeX, Math.max(1.2, cy) + shakeY, cz);
      camera.lookAt(player.pos.x, player.pos.y + 1.7, player.pos.z);
    } else if (player.car) {
      const car = player.car;
      player.camOffset += mouse.dx * 0.002;
      player.camOffset *= 0.94;
      const behind = car.heading + Math.PI + player.camOffset;
      const dist = 9.5;
      camera.position.set(
        car.pos.x + Math.sin(behind) * dist + shakeX,
        3.6 + shakeY,
        car.pos.z + Math.cos(behind) * dist,
      );
      camera.lookAt(car.pos.x, 1.4, car.pos.z);
    }
  }

  // The returned object IS the player state: methods are attached to it
  // directly, never spread into a copy, so the flags the loop reads (onFoot,
  // car, health, cash) are the same ones the loop writes.
  player.damage = damage;
  player.shoot = shoot;
  player.punch = punch;
  player.update = update;
  return player;
}
