// pedestrians.js — walkers on Surya Bay's sidewalks. They wander between
// nearby points, flee gunfire and police chases, and fall (then get up)
// when a car hits them at speed.
import * as THREE from "three";

const SHIRTS = [0xe84a5f, 0x3fae6a, 0x2e6fc2, 0xe8b93b, 0x8a5fc2, 0xe07b39, 0x2fae9e, 0xd8d8d8];

export function makePedestrians(G) {
  const P = { list: [] };

  function makeMesh(shirt) {
    const g = new THREE.Group();
    const box = new THREE.BoxGeometry(1, 1, 1);
    const body = new THREE.Mesh(box, new THREE.MeshLambertMaterial({ color: shirt }));
    body.scale.set(0.55, 0.68, 0.32);
    body.position.y = 1.12;
    body.castShadow = true;
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 8, 6), new THREE.MeshLambertMaterial({ color: 0xc98d64 }));
    head.position.y = 1.66;
    head.castShadow = true;
    g.add(head);
    const legs = new THREE.Mesh(box, new THREE.MeshLambertMaterial({ color: 0x2b3242 }));
    legs.scale.set(0.44, 0.72, 0.26);
    legs.position.y = 0.36;
    g.add(legs);
    return g;
  }

  P.spawn = function (x, z) {
    const mesh = makeMesh(SHIRTS[G.rng.int(0, SHIRTS.length - 1)]);
    mesh.position.set(x, 0, z);
    G.scene.add(mesh);
    const ped = {
      mesh, pos: mesh.position,
      heading: G.rng.angle(),
      speed: G.rng.range(1.2, 2.2),
      target: { x, z },
      state: "walk", // walk | flee | down
      downTimer: 0,
      fleeTimer: 0,
      walkPhase: G.rng.range(0, 6),
      health: 100,
    };
    ped.hurt = (n, h) => P.hurt(ped, n, h);
    P.list.push(ped);
    return ped;
  };

  P.init = function (n) {
    for (let i = 0; i < n; i++) {
      // Sidewalks sit just off a road: offset 8 studs from a road line.
      const spot = G.city.randomRoadPoint(G.rng);
      const x = spot.alongX ? spot.x + G.rng.pick([-8, 8]) : spot.x;
      const z = spot.alongX ? spot.z : spot.z + G.rng.pick([-8, 8]);
      if (Math.abs(x) > 305 || Math.abs(z) > 305) continue;
      P.spawn(x, z);
    }
  };

  P.fleeFrom = function (x, z, radius) {
    for (const ped of P.list) {
      if (ped.state === "down") continue;
      const d = Math.hypot(ped.pos.x - x, ped.pos.z - z);
      if (d < radius) {
        ped.state = "flee";
        ped.fleeTimer = 3 + G.rng.range(0, 2);
        ped.heading = Math.atan2(ped.pos.x - x, ped.pos.z - z);
      }
    }
  };

  P.hurt = function (ped, n, fromHeading) {
    ped.health -= n;
    if (ped.health <= 0) {
      ped.state = "down";
      ped.downTimer = 4;
      ped.mesh.rotation.x = -Math.PI / 2;
      ped.mesh.position.y = 0.3;
      G.police.addCrime(1, "hurt a pedestrian");
    } else {
      ped.state = "flee";
      ped.fleeTimer = 4;
      ped.heading = fromHeading;
    }
  };

  P.update = function (dt) {
    for (const ped of P.list) {
      if (ped.state === "down") {
        ped.downTimer -= dt;
        if (ped.downTimer <= 0) {
          ped.state = "flee";
          ped.fleeTimer = 5;
          ped.health = 100;
          ped.mesh.rotation.x = 0;
          ped.mesh.position.y = 0;
        }
        continue;
      }
      let speed = ped.speed;
      if (ped.state === "flee") {
        speed = 5.5;
        ped.fleeTimer -= dt;
        if (ped.fleeTimer <= 0) ped.state = "walk";
      } else {
        const dx = ped.target.x - ped.pos.x;
        const dz = ped.target.z - ped.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 2) {
          ped.target = {
            x: Math.max(-300, Math.min(300, ped.pos.x + G.rng.range(-60, 60))),
            z: Math.max(-300, Math.min(300, ped.pos.z + G.rng.range(-60, 60))),
          };
        } else {
          ped.heading = Math.atan2(dx, dz);
        }
      }
      ped.pos.x += Math.sin(ped.heading) * speed * dt;
      ped.pos.z += Math.cos(ped.heading) * speed * dt;
      ped.mesh.rotation.y = ped.heading;
      ped.walkPhase += dt * speed * 3;
      G.city.pushOut(ped.pos, 0.5);
      // A fast car that touches a ped knocks them down.
      for (const car of G.cars) {
        if (car.dead || Math.abs(car.speed) < 6) continue;
        const d = Math.hypot(car.pos.x - ped.pos.x, car.pos.z - ped.pos.z);
        if (d < 2.2) {
          P.hurt(ped, 100, car.heading);
          G.hud.toast("You hit a pedestrian! Wanted level up.");
          break;
        }
      }
    }
  };

  return P;
}
