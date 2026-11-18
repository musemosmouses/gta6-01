// Pedestrians: the people of Surya Bay. They stroll the sidewalks between
// random waypoints, idle at corners, and run when they hear a gunshot or see
// the police coming. A pedestrian hit by a car goes down and stays down for
// a while; one shot or punched too hard does the same. Each one is a small
// box-built figure with a shirt colour of its own, so the streets read as
// people rather than props.

import * as THREE from 'three';

const SHIRTS = [0xd23b3b, 0x2e6fd8, 0xf2c230, 0x37c978, 0x8a5fd0, 0xe8e8e8, 0xe07b39, 0x3ec6c6, 0x7a5c3e];
const SKINS = [0xe8b88a, 0xc98d64, 0x8a5a3b, 0xf0c8a0];
const PANTS = [0x2a3a4a, 0x3a3a3a, 0x4a3a5a, 0x5a3a2a];

const torsoGeo = new THREE.BoxGeometry(0.62, 0.72, 0.36);
const headGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
const legGeo = new THREE.BoxGeometry(0.24, 0.62, 0.26);
const armGeo = new THREE.BoxGeometry(0.18, 0.6, 0.2);

export function buildPedMesh(rng) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: rng.pick(SHIRTS) });
  const skin = new THREE.MeshLambertMaterial({ color: rng.pick(SKINS) });
  const pants = new THREE.MeshLambertMaterial({ color: rng.pick(PANTS) });
  const torso = new THREE.Mesh(torsoGeo, shirt);
  torso.position.y = 1.05;
  group.add(torso);
  const head = new THREE.Mesh(headGeo, skin);
  head.position.y = 1.62;
  group.add(head);
  const legL = new THREE.Mesh(legGeo, pants);
  legL.position.set(-0.16, 0.31, 0);
  group.add(legL);
  const legR = new THREE.Mesh(legGeo, pants);
  legR.position.set(0.16, 0.31, 0);
  group.add(legR);
  const armL = new THREE.Mesh(armGeo, shirt);
  armL.position.set(-0.42, 1.05, 0);
  group.add(armL);
  const armR = new THREE.Mesh(armGeo, shirt);
  armR.position.set(0.42, 1.05, 0);
  group.add(armR);
  return { group, legL, legR, armL, armR };
}

export function createPedestrians(G) {
  const list = [];
  const MAX_PEDS = 26;

  function spawnPed(x, z) {
    const { group, legL, legR, armL, armR } = buildPedMesh(G.rng);
    group.position.set(x, 0, z);
    G.scene.add(group);
    const ped = {
      group,
      legL,
      legR,
      armL,
      armR,
      pos: group.position,
      heading: G.rng.range(0, Math.PI * 2),
      speed: 0,
      state: 'walk', // 'walk' | 'idle' | 'flee' | 'down' | 'passenger'
      target: null,
      idleUntil: 0,
      downUntil: 0,
      fleeFrom: null,
      walkPhase: G.rng.range(0, 6),
      isCop: false,
      isGang: false,
    };
    list.push(ped);
    return ped;
  }

  function pickTarget(ped) {
    const p = G.city.randomSidewalkPoint();
    ped.target = new THREE.Vector3(p.x, 0, p.z);
  }

  function knockDown(ped, seconds) {
    if (ped.state === 'down') return;
    ped.state = 'down';
    ped.downUntil = G.time + seconds;
    ped.group.rotation.x = Math.PI / 2;
    ped.group.position.y = 0.35;
  }

  function scare(x, z, radius) {
    for (const ped of list) {
      if (ped.state === 'down' || ped.isCop) continue;
      const d = Math.hypot(ped.pos.x - x, ped.pos.z - z);
      if (d < radius) {
        ped.state = 'flee';
        ped.fleeFrom = new THREE.Vector3(x, 0, z);
      }
    }
  }

  function nearestPed(pos, maxDist, includeDown) {
    let best = null;
    let bestD = maxDist;
    for (const ped of list) {
      if (ped.state === 'down' && !includeDown) continue;
      const d = Math.hypot(ped.pos.x - pos.x, ped.pos.z - pos.z);
      if (d < bestD) {
        bestD = d;
        best = ped;
      }
    }
    return best;
  }

  function update(dt) {
    while (list.length < MAX_PEDS) {
      const p = G.city.randomSidewalkPoint();
      if (p && G.player.pos.distanceTo(new THREE.Vector3(p.x, 0, p.z)) < 200) spawnPed(p.x, p.z);
      else break;
    }
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const ped = list[i];
      if (ped.state === 'down') {
        if (G.time > ped.downUntil) {
          ped.state = 'walk';
          ped.group.rotation.x = 0;
          ped.group.position.y = 0;
          ped.target = null;
        }
        continue;
      }
      if (ped.state === 'passenger') continue;
      if (ped.isCop) {
        // Cops are steered by police.update, which chases the player at
        // 5.2 m/s. Walking them here to random sidewalk targets at
        // 1.5 m/s dragged them out of the 2.2 m grab range and reset the
        // arrest every time. Only the far-recycle still applies, and it
        // must also drop the cop from the police list so no invisible
        // cop keeps chasing after its group is gone.
        if (ped.pos.distanceTo(G.player.pos) > 280) {
          G.scene.remove(ped.group);
          list.splice(i, 1);
          const ci = G.police.cops.indexOf(ped);
          if (ci !== -1) G.police.cops.splice(ci, 1);
        }
        continue;
      }
      let speed = 0;
      if (ped.state === 'flee' && ped.fleeFrom) {
        const dx = ped.pos.x - ped.fleeFrom.x;
        const dz = ped.pos.z - ped.fleeFrom.z;
        const d = Math.hypot(dx, dz) || 1;
        ped.heading = Math.atan2(dx / d, dz / d);
        speed = 4.2;
        if (d > 55) {
          ped.state = 'walk';
          ped.target = null;
        }
      } else {
        if (!ped.target) {
          if (G.time < ped.idleUntil) {
            speed = 0;
          } else if (G.rng.chance(0.12)) {
            ped.idleUntil = G.time + G.rng.range(2, 6);
          } else {
            pickTarget(ped);
          }
        }
        if (ped.target) {
          const dx = ped.target.x - ped.pos.x;
          const dz = ped.target.z - ped.pos.z;
          const d = Math.hypot(dx, dz);
          if (d < 1.5) {
            ped.target = null;
          } else {
            ped.heading = Math.atan2(dx / d, dz / d);
            speed = 1.5;
          }
        }
      }
      ped.speed = speed;
      if (speed > 0) {
        ped.pos.x += Math.sin(ped.heading) * speed * dt;
        ped.pos.z += Math.cos(ped.heading) * speed * dt;
        G.city.collideCircle(ped.pos, 0.5);
        ped.walkPhase += dt * speed * 2.4;
        const swing = Math.sin(ped.walkPhase) * 0.55;
        ped.legL.rotation.x = swing;
        ped.legR.rotation.x = -swing;
        ped.armL.rotation.x = -swing * 0.7;
        ped.armR.rotation.x = swing * 0.7;
      }
      ped.group.rotation.y = ped.heading;
      // Too far from the player for too long: recycle the pedestrian.
      if (ped.pos.distanceTo(G.player.pos) > 280) {
        G.scene.remove(ped.group);
        list.splice(i, 1);
      }
    }
  }

  return { list, spawnPed, knockDown, scare, nearestPed, update };
}
