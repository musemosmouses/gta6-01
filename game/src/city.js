// city.js — Surya Bay itself: a seeded 12x12 road grid, buildings with
// varied heights and colors, a beach and sea on the south edge, a plaza
// with a fountain at the centre, and the landmarks missions use (spray
// garage, bank, safehouse, hospital). Also the collision helpers the
// player, cars and pedestrians all share.
import * as THREE from "three";
import { makeRng } from "./random.js";

export const GRID = 40; // distance between road centre lines
export const ROADS = [-220, -180, -140, -100, -60, -20, 20, 60, 100, 140, 180, 220];
export const HALF = 240; // playable half-extent; beach starts past +240 z

const PALETTE = [0xf2e6c9, 0xe8b48a, 0xd98c6a, 0x9fc3d8, 0xf5d76e, 0xffffff, 0xc9a0a0, 0x8fb8a0, 0xe0a458, 0x7fa8c9];

function facadeTexture() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, 128, 256);
  g.fillStyle = "#2c3e50";
  for (let y = 14; y < 250; y += 30) {
    for (let x = 12; x < 120; x += 26) {
      g.fillRect(x, y, 16, 20);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  return t;
}

function roadTexture() {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 128;
  const g = c.getContext("2d");
  g.fillStyle = "#3a3f45";
  g.fillRect(0, 0, 64, 128);
  g.fillStyle = "#f5d76e";
  g.fillRect(30, 8, 4, 48);
  g.fillRect(30, 72, 4, 48);
  g.fillStyle = "#e8e8e8";
  g.fillRect(2, 0, 2, 128);
  g.fillRect(60, 0, 2, 128);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 12);
  return t;
}

export function buildCity(S) {
  const rng = makeRng(S.seed);
  const scene = S.scene;
  const city = {
    colliders: [], // {minX, maxX, minZ, maxZ}
    circles: [], // {x, z, r} fountain, palms, lamps
    spray: { x: -180, z: -180 },
    bank: { x: 120, z: 120 },
    safehouse: { x: -180, z: 180 },
    hospital: { x: 180, z: -180 },
    fountain: { x: 0, z: 0, r: 6 },
    beachZ: 244,
    seaZ: 280,
  };

  // Ground: sun-baked grass.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(560, 560),
    new THREE.MeshLambertMaterial({ color: 0x79a85a })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 0);
  scene.add(ground);

  // Roads: dark strips with a dashed centre line, one per grid line.
  const roadTex = roadTexture();
  const roadMat = new THREE.MeshLambertMaterial({ map: roadTex });
  for (const v of ROADS) {
    const ns = new THREE.Mesh(new THREE.PlaneGeometry(9, 480), roadMat);
    ns.rotation.x = -Math.PI / 2;
    ns.position.set(v, 0.05, 0);
    scene.add(ns);
    const ew = new THREE.Mesh(new THREE.PlaneGeometry(9, 480), roadMat);
    ew.rotation.x = -Math.PI / 2;
    ew.rotation.z = Math.PI / 2;
    ew.position.set(0, 0.05, v);
    scene.add(ew);
  }

  // Beach sand, then the sea.
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(560, 40),
    new THREE.MeshLambertMaterial({ color: 0xe8d29a })
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.04, 262);
  scene.add(sand);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(560, 300),
    new THREE.MeshLambertMaterial({ color: 0x2e86c1 })
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, 0.03, 432);
  scene.add(sea);

  // Central plaza: pavement disc + fountain.
  const plaza = new THREE.Mesh(
    new THREE.CylinderGeometry(26, 26, 0.3, 24),
    new THREE.MeshLambertMaterial({ color: 0xcfc4ae })
  );
  plaza.position.set(0, 0.15, 0);
  scene.add(plaza);
  const basin = new THREE.Mesh(
    new THREE.CylinderGeometry(6, 6.5, 1.2, 20),
    new THREE.MeshLambertMaterial({ color: 0x9aa5ad })
  );
  basin.position.set(0, 0.6, 0);
  scene.add(basin);
  const water = new THREE.Mesh(
    new THREE.CylinderGeometry(5.4, 5.4, 0.3, 20),
    new THREE.MeshLambertMaterial({ color: 0x4fc3e8 })
  );
  water.position.set(0, 1.1, 0);
  scene.add(water);
  city.circles.push({ x: 0, z: 0, r: 6.5 });

  // Buildings: one or two per block, seeded heights and colors.
  const facade = facadeTexture();
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
  const lampHeadMat = new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0x554411 });
  for (let ix = 0; ix < ROADS.length - 1; ix++) {
    for (let iz = 0; iz < ROADS.length - 1; iz++) {
      const cx = (ROADS[ix] + ROADS[ix + 1]) / 2;
      const cz = (ROADS[iz] + ROADS[iz + 1]) / 2;
      // Keep the plaza block and the landmark corners clear of random blocks.
      if (Math.abs(cx) < 30 && Math.abs(cz) < 30) continue;
      if (cz > 225) continue; // beach strip stays open
      const roll = rng.next();
      if (roll < 0.16) {
        // Park: grass + palms, no building.
        plantPalms(S, rng, cx, cz, 3);
        continue;
      }
      const count = roll < 0.6 ? 1 : 2;
      for (let b = 0; b < count; b++) {
        // Twin buildings share a block, so each must fit in half of it:
        // a block is 31 wide and the pair sits at +/-7 from its centre.
        const maxSide = count === 1 ? 22 : 16;
        const w = rng.range(10, maxSide);
        const d = rng.range(10, maxSide);
        const h = rng.range(8, count === 1 ? 46 : 26);
        const ox = count === 1 ? 0 : (b === 0 ? -7 : 7);
        const oz = count === 1 ? 0 : (b === 0 ? -7 : 7);
        const bx = cx + ox;
        const bz = cz + oz;
        const tex = facade.clone();
        tex.needsUpdate = true;
        tex.repeat.set(Math.max(1, Math.round(w / 10)), Math.max(1, Math.round(h / 12)));
        const color = rng.pick(PALETTE);
        const mat = new THREE.MeshLambertMaterial({ map: tex, color });
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        mesh.position.set(bx, h / 2, bz);
        scene.add(mesh);
        const roof = new THREE.Mesh(
          new THREE.BoxGeometry(w + 0.6, 0.8, d + 0.6),
          new THREE.MeshLambertMaterial({ color: 0x5a4a3a })
        );
        roof.position.set(bx, h + 0.4, bz);
        scene.add(roof);
        city.colliders.push({ minX: bx - w / 2, maxX: bx + w / 2, minZ: bz - d / 2, maxZ: bz + d / 2 });
      }
    }
  }

  // Landmarks: spray garage (mint green), bank (tall glass blue),
  // safehouse (small, orange roof), hospital (white + red cross).
  addLandmark(S, city, -180, -180, 20, 10, 16, 0x7fd8a0, "spray");
  addLandmark(S, city, 120, 120, 22, 52, 18, 0x7fb2d8, "bank");
  addLandmark(S, city, -180, 180, 14, 7, 12, 0xf2e6c9, "safehouse");
  addLandmark(S, city, 180, -180, 20, 12, 16, 0xffffff, "hospital");

  // Street lamps along the main avenues.
  for (const v of [-180, -60, 60, 180]) {
    for (let t = -200; t <= 200; t += 80) {
      addLamp(S, city, v + 6, t, lampMat, lampHeadMat);
      addLamp(S, city, t, v + 6, lampMat, lampHeadMat);
    }
  }

  // Palms along the beach.
  plantPalms(S, rng, 0, 255, 14);

  S.city = city;
  return city;
}

function addLandmark(S, city, x, z, w, h, d, color, kind) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color })
  );
  mesh.position.set(x, h / 2, z);
  S.scene.add(mesh);
  city.colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
  if (kind === "hospital") {
    const crossMat = new THREE.MeshLambertMaterial({ color: 0xd23c3c });
    const c1 = new THREE.Mesh(new THREE.BoxGeometry(4, 1.4, 0.4), crossMat);
    c1.position.set(x, h + 1.2, z + d / 2 + 0.2);
    S.scene.add(c1);
    const c2 = new THREE.Mesh(new THREE.BoxGeometry(1.4, 4, 0.4), crossMat);
    c2.position.set(x, h + 1.2, z + d / 2 + 0.2);
    S.scene.add(c2);
  }
  if (kind === "spray") {
    // Green ground ring marks the pay-and-spray bay.
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(7, 9, 24),
      new THREE.MeshLambertMaterial({ color: 0x2ecc71, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x + 16, 0.08, z);
    S.scene.add(ring);
    city.sprayBay = { x: x + 16, z };
  }
  if (kind === "safehouse") {
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(11, 4, 4),
      new THREE.MeshLambertMaterial({ color: 0xe67e22 })
    );
    roof.position.set(x, h + 2, z);
    roof.rotation.y = Math.PI / 4;
    S.scene.add(roof);
  }
}

function addLamp(S, city, x, z, poleMat, headMat) {
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 5, 6), poleMat);
  pole.position.set(x, 2.5, z);
  S.scene.add(pole);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), headMat);
  head.position.set(x, 5.1, z);
  S.scene.add(head);
}

function plantPalms(S, rng, cx, cz, n) {
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a45 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2e9e5b });
  for (let i = 0; i < n; i++) {
    const x = cx + rng.range(-14, 14);
    const z = cz + rng.range(-14, 14);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 6, 6), trunkMat);
    trunk.position.set(x, 3, z);
    S.scene.add(trunk);
    const top = new THREE.Mesh(new THREE.SphereGeometry(2.2, 8, 6), leafMat);
    top.position.set(x, 6.6, z);
    top.scale.y = 0.6;
    S.scene.add(top);
    S.city?.circles.push({ x, z, r: 0.8 });
  }
}

// Push a circle (x, z, radius r) out of every building AABB and round
// collider. Returns the corrected position and whether it hit anything.
export function collideCircle(S, x, z, r) {
  let hit = false;
  const city = S.city;
  for (const b of city.colliders) {
    const cx = Math.max(b.minX, Math.min(x, b.maxX));
    const cz = Math.max(b.minZ, Math.min(z, b.maxZ));
    const dx = x - cx;
    const dz = z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        x = cx + (dx / d) * r;
        z = cz + (dz / d) * r;
      } else {
        // Centre inside the box: push out along the smallest penetration.
        const pl = x - (b.minX - r);
        const pr = b.maxX + r - x;
        const pt = z - (b.minZ - r);
        const pb = b.maxZ + r - z;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) x = b.minX - r;
        else if (m === pr) x = b.maxX + r;
        else if (m === pt) z = b.minZ - r;
        else z = b.maxZ + r;
      }
    }
  }
  for (const c of city.circles) {
    const dx = x - c.x;
    const dz = z - c.z;
    const rr = r + c.r;
    const d2 = dx * dx + dz * dz;
    if (d2 < rr * rr && d2 > 0.0001) {
      hit = true;
      const d = Math.sqrt(d2);
      x = c.x + (dx / d) * rr;
      z = c.z + (dz / d) * rr;
    }
  }
  // Keep everything inside the playable area.
  const lim = 236;
  if (x < -lim) { x = -lim; hit = true; }
  if (x > lim) { x = lim; hit = true; }
  if (z < -lim) { z = -lim; hit = true; }
  if (z > 276) { z = 276; hit = true; }
  return { x, z, hit };
}

export function onRoad(x, z) {
  for (const v of ROADS) {
    if (Math.abs(x - v) < 5.5 || Math.abs(z - v) < 5.5) return true;
  }
  return false;
}

// A random point on a road, with the road's axis and a driving direction.
export function randomRoadPoint(rng) {
  const v = rng.pick(ROADS);
  const t = rng.range(-220, 220);
  if (rng.chance(0.5)) return { x: v, z: t, axis: "z", dir: rng.chance(0.5) ? 1 : -1 };
  return { x: t, z: v, axis: "x", dir: rng.chance(0.5) ? 1 : -1 };
}
