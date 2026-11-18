// police.js — the wanted system of Surya Bay.
// Crimes raise stars; police cars chase and ram, foot cops chase and grab.
// Three rules learned the hard way:
//  - a ram slows the player only on a real closing impact, at most once
//    per 1.5 s per car — never a per-frame speed tax;
//  - cars are separated by position only, never by multiplying speeds;
//  - a cop's grab builds while close and DECAYS when the player pulls
//    away, instead of resetting to zero.
import * as THREE from "three";
import { makeCar, separateCars, removeCar } from "./vehicles.js";

export function makePolice(G) {
  const P = {
    wanted: 0,
    cars: [],
    cops: [],
    crimeCooldown: 0,
    quietTimer: 0,
    lastSeen: 0,
  };

  function makeCopMesh() {
    const g = new THREE.Group();
    const box = new THREE.BoxGeometry(1, 1, 1);
    const navy = new THREE.MeshLambertMaterial({ color: 0x1d2f57 });
    const skin = new THREE.MeshLambertMaterial({ color: 0xc98d64 });
    const body = new THREE.Mesh(box, navy);
    body.scale.set(0.58, 0.7, 0.34);
    body.position.y = 1.12;
    body.castShadow = true;
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 8, 6), skin);
    head.position.y = 1.66;
    g.add(head);
    const cap = new THREE.Mesh(box, navy);
    cap.scale.set(0.44, 0.12, 0.44);
    cap.position.y = 1.86;
    g.add(cap);
    const legs = new THREE.Mesh(box, new THREE.MeshLambertMaterial({ color: 0x14181f }));
    legs.scale.set(0.46, 0.74, 0.28);
    legs.position.y = 0.37;
    g.add(legs);
    return g;
  }

  P.addCrime = function (n, reason) {
    if (n <= 0) return;
    const now = G.time;
    if (now - (P.lastCrimeAt || -100) < 2 && P.lastCrimeReason === reason) {
      // Same crime spammed within 2 s counts once.
      return;
    }
    P.lastCrimeAt = now;
    P.lastCrimeReason = reason;
    P.wanted = Math.min(5, P.wanted + n);
    P.quietTimer = 0;
    G.hud.setStars(P.wanted);
  };

  P.spawnPoliceCar = function () {
    // Reinforcements arrive near where the player IS — the car when
    // driving, not the spot where they got in.
    const ex = G.player.car ? G.player.car.pos.x : G.player.pos.x;
    const ez = G.player.car ? G.player.car.pos.z : G.player.pos.z;
    const a = G.rng.angle();
    const x = ex + Math.sin(a) * 90;
    const z = ez + Math.cos(a) * 90;
    const car = makeCar(G, {
      x: Math.max(-300, Math.min(300, x)),
      z: Math.max(-300, Math.min(300, z)),
      kind: "police", color: 0xf2f2f2, driver: "police",
      heading: Math.atan2(ex - x, ez - z),
    });
    car.cruise = 30;
    P.cars.push(car);
    G.cars.push(car);
    return car;
  };

  P.spawnCop = function () {
    const ex = G.player.car ? G.player.car.pos.x : G.player.pos.x;
    const ez = G.player.car ? G.player.car.pos.z : G.player.pos.z;
    const a = G.rng.angle();
    const x = ex + Math.sin(a) * 26;
    const z = ez + Math.cos(a) * 26;
    const mesh = makeCopMesh();
    mesh.position.set(x, 0, z);
    G.scene.add(mesh);
    const cop = {
      mesh, pos: mesh.position,
      heading: 0, speed: 0,
      grabTime: 0, health: 100, flash: 0,
    };
    P.cops.push(cop);
    return cop;
  };

  P.onCopDown = function (cop) {
    cop.health = 0;
    cop.mesh.rotation.x = -Math.PI / 2;
    cop.mesh.position.y = 0.3;
    P.addCrime(2, "downed a cop");
    G.hud.toast("You dropped a cop. That will not be forgotten.");
    setTimeout(() => {
      G.scene.remove(cop.mesh);
      const i = P.cops.indexOf(cop);
      if (i >= 0) P.cops.splice(i, 1);
    }, 5000);
  };

  P.clearWanted = function (why) {
    P.wanted = 0;
    G.hud.setStars(0);
    if (why) G.hud.toast(why);
  };

  P.update = function (dt) {
    const player = G.player;
    // Chase the car the player is driving, not the spot where they got in:
    // player.pos does not move while the player is behind the wheel. This
    // one position feeds the pursuit, the ram, the cops, the star decay
    // and the spray-garage trigger below.
    const px = player.car ? player.car.pos.x : player.pos.x;
    const pz = player.car ? player.car.pos.z : player.pos.z;

    // Desired force matches the wanted level.
    const wantCars = P.wanted >= 2 ? Math.min(P.wanted - 1, 4) : 0;
    const wantCops = P.wanted >= 1 ? Math.min(P.wanted, 3) : 0;
    while (P.cars.length < wantCars) P.spawnPoliceCar();
    while (P.cops.length < wantCops) P.spawnCop();
    // Surplus police give up and drive off when the heat drops.
    while (P.cars.length > wantCars) {
      const car = P.cars[P.cars.length - 1];
      // Never touch the car the player is driving.
      if (car.driver === "player") break;
      P.cars.pop();
      // A stood-down car leaves the city instead of freezing mid-road.
      removeCar(G, car);
    }
    while (P.cops.length > wantCops) {
      const cop = P.cops.pop();
      G.scene.remove(cop.mesh);
    }

    // Police cars: pursue the player, ram on a cooldown.
    let anyNear = false;
    for (const car of P.cars) {
      if (car.dead) continue;
      const dx = px - car.pos.x;
      const dz = pz - car.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 55) anyNear = true;
      // The player's own stolen police car is never driven by its own AI:
      // it would fight the player's steering and drag the car toward the
      // spot where it was stolen.
      if (car.driver !== "player") {
        const wantHeading = Math.atan2(dx, dz);
        let d = wantHeading - car.heading;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        car.heading += Math.max(-2.2 * dt, Math.min(2.2 * dt, d));
        const targetSpeed = dist > 8 ? car.cruise : car.cruise * 0.55;
        car.speed += (targetSpeed - car.speed) * Math.min(1, 1.8 * dt);
        car.pos.x += Math.sin(car.heading) * car.speed * dt;
        car.pos.z += Math.cos(car.heading) * car.speed * dt;
        car.mesh.rotation.y = car.heading;
        G.city.pushOut(car.pos, 1.6);
      }
      // Flash the light bar.
      const blink = Math.floor(G.time * 6) % 2 === 0;
      if (car.mesh.userData.lightRed) car.mesh.userData.lightRed.visible = blink;
      if (car.mesh.userData.lightBlue) car.mesh.userData.lightBlue.visible = !blink;
      // Ram: only on a real closing impact, at most once per 1.5 s.
      // Never rams the car the player is driving (that is this car).
      if (player.car && player.car !== car && dist < 4.2) {
        const closing = Math.abs(car.speed - player.car.speed);
        if (closing > 4 && G.time - car.lastRam > 1.5) {
          car.lastRam = G.time;
          player.car.speed *= 0.7;
          player.car.damage += 4;
          player.hurt(4);
          G.audio.punch();
          G.shake = Math.max(G.shake, 0.4);
          G.hud.toast("Police rammed you!");
        }
      }
      if (!player.car && dist < 3.2) {
        // A police car that reaches the player on foot nudges them over.
        // The shove fires only when the hit lands (hurt's own cooldown),
        // never once per frame — otherwise the player is flung away.
        if (!player.dead && player.hurtCooldown <= 0) {
          player.hurt(6);
          player.pos.x += (px - car.pos.x) / (dist || 1) * 2;
          player.pos.z += (pz - car.pos.z) / (dist || 1) * 2;
        }
      }
    }
    // Police cars never overlap: positional separation only.
    for (let i = 0; i < P.cars.length; i++) {
      for (let j = i + 1; j < P.cars.length; j++) {
        separateCars(G, P.cars[i], P.cars[j]);
      }
    }

    // Foot cops: run at the player; a grab builds while close and decays
    // while the player pulls away. Three seconds held means busted.
    for (const cop of P.cops) {
      if (cop.health <= 0) continue;
      const dx = px - cop.pos.x;
      const dz = pz - cop.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 55) anyNear = true;
      cop.heading = Math.atan2(dx, dz);
      const speed = dist > 60 ? 0 : 7.2;
      cop.pos.x += Math.sin(cop.heading) * speed * dt;
      cop.pos.z += Math.cos(cop.heading) * speed * dt;
      cop.mesh.rotation.y = cop.heading;
      G.city.pushOut(cop.pos, 0.5);
      if (dist < 2.4) {
        cop.grabTime += dt;
        if (cop.grabTime >= 2.5) {
          P.busted();
          return;
        }
      } else {
        // Decay, don't reset: a half-held player who slips away keeps
        // most of the cop's grip for a moment.
        cop.grabTime = Math.max(0, cop.grabTime - dt * 2);
      }
    }

    // Siren while any police car is active.
    G.audio.setSiren(P.cars.length > 0);

    // Stars decay when the player stays out of sight and quiet.
    if (P.wanted > 0) {
      if (anyNear) {
        P.quietTimer = 0;
      } else {
        P.quietTimer += dt;
        if (P.quietTimer > 18) {
          P.wanted -= 1;
          P.quietTimer = 0;
          G.hud.setStars(P.wanted);
          G.hud.toast("The heat is cooling off… " + P.wanted + " star" + (P.wanted === 1 ? "" : "s") + " left.");
        }
      }
    }

    // Spray garage: drive into the bay and the heat is gone for $100.
    // The trigger radius (14) is wider than the garage collider's push-out,
    // so the trigger can always be reached.
    const gr = G.city.garage;
    const gd = Math.hypot(px - gr.x, pz - gr.z);
    if (gd < gr.r && P.wanted > 0 && player.car && Math.abs(player.car.speed) < 6) {
      if (player.cash >= 100) {
        player.cash -= 100;
        P.clearWanted("Sprayed clean — $100, no more stars.");
        G.audio.cash();
        const bodyMesh = player.car.mesh.children[0];
        if (bodyMesh && bodyMesh.material && bodyMesh.material.color) {
          bodyMesh.material.color.setHex([0xc23b2e, 0x2e6fc2, 0xe8b93b, 0x3fae6a][G.rng.int(0, 3)]);
        }
      } else if (G.time - (P.sprayMsgAt || -100) > 5) {
        P.sprayMsgAt = G.time;
        G.hud.toast("Spray costs $100 — you are short.");
        G.audio.denied();
      }
    }
  };

  P.busted = function () {
    const player = G.player;
    const fine = Math.min(player.cash, 200);
    player.cash -= fine;
    P.clearWanted("BUSTED! You lost $" + fine + " and woke up at the hospital.");
    if (player.car) {
      player.car.driver = null;
      player.car = null;
    }
    player.respawn();
  };

  return P;
}
