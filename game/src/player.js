// player.js — Raka, the player, on foot and behind the wheel.
// All player state lives on this ONE object, with its methods attached to
// it: nothing ever spreads or copies it, so health, cash and position can
// never drift apart between two copies.
import * as THREE from "three";

export function makePlayer(G) {
  const g = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0x1f7a6d });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2b3242 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98d64 });
  const hair = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
  const box = new THREE.BoxGeometry(1, 1, 1);
  function part(mat, w, h, d, x, y, z) {
    const m = new THREE.Mesh(box, mat);
    m.scale.set(w, h, d);
    m.position.set(x, y, z);
    m.castShadow = true;
    g.add(m);
    return m;
  }
  const torso = part(jacket, 0.62, 0.72, 0.36, 0, 1.15, 0);
  const head = part(skin, 0.42, 0.42, 0.4, 0, 1.72, 0);
  part(hair, 0.44, 0.16, 0.42, 0, 1.95, 0);
  const legL = part(pants, 0.24, 0.78, 0.28, -0.16, 0.39, 0);
  const legR = part(pants, 0.24, 0.78, 0.28, 0.16, 0.39, 0);
  const armL = part(jacket, 0.2, 0.66, 0.24, -0.42, 1.15, 0);
  const armR = part(jacket, 0.2, 0.66, 0.24, 0.42, 1.15, 0);
  // Pistol in the right hand, hidden until armed.
  const gun = new THREE.Mesh(box, new THREE.MeshLambertMaterial({ color: 0x222222 }));
  gun.scale.set(0.09, 0.12, 0.42);
  gun.position.set(0.42, 0.95, 0.22);
  gun.visible = false;
  g.add(gun);
  G.scene.add(g);

  const P = {
    mesh: g,
    pos: g.position,
    heading: 0,
    camYaw: 0,
    camPitch: 0.32,
    camDist: 7,
    velY: 0,
    onGround: true,
    health: 100,
    maxHealth: 100,
    armor: 0,
    maxArmor: 100,
    cash: 50,
    earned: 0,
    onFoot: true,
    car: null,
    armed: false,
    ammo: 12,
    magSize: 12,
    reloading: 0,
    shootCooldown: 0,
    punchCooldown: 0,
    hurtCooldown: 0,
    walkPhase: 0,
    dead: false,
    parts: { torso, head, legL, legR, armL, armR, gun },
  };
  P.pos.set(0, 0, 120);
  g.rotation.y = P.heading;

  P.update = function (dt) {
    if (P.dead) return;
    const input = G.input;
    if (P.reloading > 0) P.reloading -= dt;
    if (P.shootCooldown > 0) P.shootCooldown -= dt;
    if (P.punchCooldown > 0) P.punchCooldown -= dt;
    if (P.hurtCooldown > 0) P.hurtCooldown -= dt;

    // Camera: mouse when locked, arrows as a fallback.
    const mouse = input.takeMouse();
    if (input.isLocked()) {
      P.camYaw -= mouse.dx * 0.0032;
      P.camPitch += mouse.dy * 0.0024;
    }
    if (input.down("ArrowLeft")) P.camYaw += 2.4 * dt;
    if (input.down("ArrowRight")) P.camYaw -= 2.4 * dt;
    P.camPitch = Math.max(-0.15, Math.min(1.1, P.camPitch));

    if (P.onFoot) {
      P.updateOnFoot(dt, input);
    }
    // Camera boom: behind the player or behind the car.
    P.updateCamera(dt);
    // Walk-cycle swing, only while moving on foot.
    const moving = P.onFoot && (input.down("KeyW") || input.down("KeyA") || input.down("KeyS") || input.down("KeyD"));
    if (moving) P.walkPhase += dt * 9;
    const swing = moving ? Math.sin(P.walkPhase) * 0.5 : 0;
    P.parts.legL.rotation.x = swing;
    P.parts.legR.rotation.x = -swing;
    P.parts.armL.rotation.x = -swing * 0.8;
    P.parts.armR.rotation.x = swing * 0.8;
    P.parts.gun.visible = P.armed && P.onFoot;
  };

  P.updateOnFoot = function (dt, input) {
    const run = input.down("ShiftLeft") || input.down("ShiftRight");
    const speed = run ? 10 : 6;
    const axis = input.moveAxis();
    const sin = Math.sin(P.camYaw);
    const cos = Math.cos(P.camYaw);
    // Forward is the camera's view direction (sin, cos); right is its
    // 90-degree turn (-cos, sin). W moves away from the camera.
    let mx = axis.z * sin - axis.x * cos;
    let mz = axis.z * cos + axis.x * sin;
    const len = Math.hypot(mx, mz);
    if (len > 0.01) {
      mx /= len;
      mz /= len;
      P.pos.x += mx * speed * dt;
      P.pos.z += mz * speed * dt;
      P.heading = Math.atan2(mx, mz);
      g.rotation.y = P.heading;
    }
    // Jump with simple gravity.
    if (input.hit("Space") && P.onGround) {
      P.velY = 7;
      P.onGround = false;
    }
    if (!P.onGround) {
      P.velY -= 22 * dt;
      P.pos.y += P.velY * dt;
      if (P.pos.y <= 0) {
        P.pos.y = 0;
        P.velY = 0;
        P.onGround = true;
      }
    }
    G.city.pushOut(P.pos, 0.6);
    // Enter cars is handled in the main loop (E is exclusive per frame:
    // one press either enters or exits, never both).
    if (input.hit("KeyQ")) P.toggleWeapon();
    if (input.hit("KeyR")) P.reload();
    if (input.hit("KeyF")) P.punch();
    if ((input.hitButton(0) || input.hit("KeyG")) && P.armed) P.shoot();
  };

  P.updateCamera = function (dt) {
    const cam = G.camera;
    let target;
    let dist = P.camDist;
    if (!P.onFoot && P.car) {
      target = P.car.pos;
      dist = 10;
      // Chase camera sits behind the car: its offset is the opposite of
      // the car's forward direction, so camYaw follows the car's heading.
      const wantYaw = P.car.heading;
      let d = wantYaw - P.camYaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      P.camYaw += d * Math.min(1, 3.5 * dt);
    } else {
      target = P.pos;
    }
    const cx = target.x - Math.sin(P.camYaw) * Math.cos(P.camPitch) * dist;
    const cz = target.z - Math.cos(P.camYaw) * Math.cos(P.camPitch) * dist;
    const cy = (target.y + 1.8) + Math.sin(P.camPitch) * dist;
    // Keep the camera out of buildings: pull it in until it is clear.
    let clearDist = dist;
    for (let d = dist; d > 2; d -= 0.5) {
      const px = target.x - Math.sin(P.camYaw) * Math.cos(P.camPitch) * d;
      const pz = target.z - Math.cos(P.camYaw) * Math.cos(P.camPitch) * d;
      if (!G.city.hitsBuilding(px, pz, 0.4)) {
        clearDist = d;
        break;
      }
      clearDist = d;
    }
    const fx = target.x - Math.sin(P.camYaw) * Math.cos(P.camPitch) * clearDist;
    const fz = target.z - Math.cos(P.camYaw) * Math.cos(P.camPitch) * clearDist;
    const fy = (target.y + 1.8) + Math.sin(P.camPitch) * clearDist;
    cam.position.set(fx, Math.max(0.6, fy), fz);
    cam.lookAt(target.x, target.y + 1.4, target.z);
    if (G.shake > 0) {
      cam.position.x += (Math.random() - 0.5) * G.shake;
      cam.position.y += (Math.random() - 0.5) * G.shake;
      G.shake = Math.max(0, G.shake - dt * 1.4);
    }
  };

  P.tryEnterCar = function () {
    let best = null;
    let bestD = 4.5;
    for (const car of G.cars) {
      const d = Math.hypot(car.pos.x - P.pos.x, car.pos.z - P.pos.z);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    if (!best) return;
    P.onFoot = false;
    P.car = best;
    best.driver = "player";
    best.speed = 0;
    g.visible = false;
    G.audio.ensure();
    if (best.driverBefore !== "player") {
      if (best.isPolice) {
        G.police.addCrime(2, "stole a police car");
        G.hud.toast("You stole a police car! The whole force is coming.");
      } else {
        G.police.addCrime(1, "stole a car");
        G.hud.toast("Car stolen — the cops noticed.");
      }
    }
    G.audio.pickup();
  };

  P.exitCar = function () {
    if (!P.car) return;
    const car = P.car;
    car.driver = null;
    // Remember this car was yours: getting back in is not a new theft.
    car.driverBefore = "player";
    const sideX = Math.sin(car.heading + Math.PI / 2);
    P.pos.set(car.pos.x + sideX * 2.2, 0, car.pos.z + Math.cos(car.heading + Math.PI / 2) * 2.2);
    G.city.pushOut(P.pos, 0.6);
    P.onFoot = true;
    P.car = null;
    g.visible = true;
    G.audio.setEngine(false, 0);
  };

  P.toggleWeapon = function () {
    P.armed = !P.armed;
    G.hud.toast(P.armed ? "Pistol out — left click or G to fire, R to reload." : "Pistol holstered.");
  };

  P.reload = function () {
    if (!P.armed || P.ammo === P.magSize || P.reloading > 0) return;
    P.reloading = 1.1;
    P.ammo = P.magSize;
    G.hud.toast("Reloaded.");
  };

  P.punch = function () {
    if (P.punchCooldown > 0) return;
    P.punchCooldown = 0.45;
    G.audio.punch();
    const fx = Math.sin(P.heading);
    const fz = Math.cos(P.heading);
    for (const ped of G.peds.list) {
      if (ped.state === "down") continue;
      const dx = ped.pos.x - P.pos.x;
      const dz = ped.pos.z - P.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 2.4 && dx * fx + dz * fz > 0) {
        ped.hurt(25, P.heading);
        G.hud.toast("You punched a local. Careful — that counts.");
      }
    }
    for (const gang of G.missions.gang) {
      if (gang.health <= 0) continue;
      const dx = gang.pos.x - P.pos.x;
      const dz = gang.pos.z - P.pos.z;
      if (Math.hypot(dx, dz) < 2.4) {
        gang.health -= 25;
        gang.flash = 0.2;
        G.audio.punch();
        if (gang.health <= 0) G.missions.onGangDown(gang);
      }
    }
  };

  P.shoot = function () {
    if (P.shootCooldown > 0 || P.reloading > 0) return;
    if (P.ammo <= 0) {
      G.hud.toast("Click — empty. Press R to reload.");
      G.audio.denied();
      P.shootCooldown = 0.3;
      return;
    }
    P.ammo--;
    P.shootCooldown = 0.28;
    G.audio.gunshot();
    G.shake = Math.max(G.shake, 0.12);
    const dir = new THREE.Vector3(Math.sin(P.camYaw), -0.08, Math.cos(P.camYaw)).normalize();
    const origin = new THREE.Vector3(P.pos.x, P.pos.y + 1.5, P.pos.z);
    // Tracer line that fades out.
    const end = origin.clone().addScaledVector(dir, 60);
    const geo = new THREE.BufferGeometry().setFromPoints([origin, end]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 }));
    G.scene.add(line);
    G.effects.push({ mesh: line, life: 0.09, max: 0.09, fade: true });
    // Hitscan: nearest living ped / gang member / cop near the shot line.
    let best = null;
    let bestD = 60;
    const targets = [];
    for (const ped of G.peds.list) if (ped.state !== "down") targets.push({ pos: ped.pos, hit: () => ped.hurt(34, P.heading) });
    for (const gang of G.missions.gang) if (gang.health > 0) targets.push({ pos: gang.pos, hit: () => { gang.health -= 34; gang.flash = 0.2; if (gang.health <= 0) G.missions.onGangDown(gang); } });
    for (const cop of G.police.cops) targets.push({ pos: cop.pos, hit: () => { cop.health -= 34; if (cop.health <= 0) G.police.onCopDown(cop); } });
    for (const t of targets) {
      const to = new THREE.Vector3(t.pos.x - origin.x, 1.2 - origin.y, t.pos.z - origin.z);
      const along = to.dot(dir);
      if (along < 1 || along > bestD) continue;
      const perp = to.clone().addScaledVector(dir, -along).length();
      if (perp < 1.6) {
        bestD = along;
        best = t;
      }
    }
    if (best) best.hit();
    G.police.addCrime(1, "fired a gun");
    G.peds.fleeFrom(P.pos.x, P.pos.z, 40);
  };

  P.hurt = function (n) {
    if (P.hurtCooldown > 0 || P.dead) return;
    P.hurtCooldown = 0.5;
    let left = n;
    if (P.armor > 0) {
      const absorbed = Math.min(P.armor, left * 0.6);
      P.armor -= absorbed;
      left -= absorbed;
    }
    P.health -= left;
    G.shake = Math.max(G.shake, 0.3);
    if (P.health <= 0) {
      P.health = 0;
      P.die();
    }
  };

  P.heal = function (n) {
    P.health = Math.min(P.maxHealth, P.health + n);
  };

  P.addCash = function (n) {
    P.cash += n;
    P.earned += n;
  };

  P.die = function () {
    P.dead = true;
    G.audio.denied();
    G.hud.showWasted();
  };

  P.respawn = function () {
    const h = G.city.hospital;
    P.pos.set(h.x, 0, h.z + 6);
    P.health = P.maxHealth;
    P.armor = 0;
    P.dead = false;
    P.onFoot = true;
    if (P.car) {
      P.car.driver = null;
      P.car = null;
    }
    g.visible = true;
    P.heading = 0;
    P.camYaw = 0;
    G.hud.toast("You woke up at St. Surya Hospital.");
  };

  return P;
}
