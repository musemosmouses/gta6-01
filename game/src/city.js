// Surya Bay itself: a seeded procedural coastal city. A 12x12 grid of blocks,
// each holding one to three buildings with canvas-painted facades, roads with
// dashed centre lines, lamps and palms, a sandy beach and the sea along the
// south edge, a pier and a lighthouse for a landmark. Everything is built from
// shared geometries and a handful of materials, so the whole city is a few
// hundred cheap meshes. The module also answers the questions the other
// systems ask: where the roads are, what blocks movement, and where a car or
// a pedestrian may stand.

import * as THREE from 'three';

export const CITY_PITCH = 56;
export const CITY_BLOCK = 44;
export const CITY_ROAD = 12;
export const CITY_GRID = 12;
export const CITY_HALF = (CITY_GRID * CITY_PITCH) / 2; // 336
export const BEACH_Z = CITY_HALF + 32;
export const SEA_Z = CITY_HALF + 64;

const PALETTES = [
  { base: '#e8d9b0', roof: '#7a5c3e', windows: '#2e4a63' },
  { base: '#d98a6a', roof: '#5d3a2e', windows: '#274b5f' },
  { base: '#7fb3a8', roof: '#3e5a55', windows: '#22384a' },
  { base: '#f2ede0', roof: '#6b6b6b', windows: '#33506b' },
];
const HEIGHT_ROWS = [6, 10, 16];

function facadeTexture(palette, rows, rng) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = palette.base;
  ctx.fillRect(0, 0, 128, 256);
  // A faint vertical shade so faces read as separate walls.
  const shade = ctx.createLinearGradient(0, 0, 128, 0);
  shade.addColorStop(0, 'rgba(0,0,0,0.10)');
  shade.addColorStop(0.5, 'rgba(255,255,255,0.06)');
  shade.addColorStop(1, 'rgba(0,0,0,0.14)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, 128, 256);
  const cols = 4;
  const cellW = 128 / cols;
  const cellH = 256 / rows;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const lit = rng.chance(0.22);
      ctx.fillStyle = lit ? '#ffd98a' : palette.windows;
      ctx.fillRect(c * cellW + 7, r * cellH + 7, cellW - 14, cellH - 14);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(c * cellW + 7, r * cellH + 7, cellW - 14, 4);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createCity(rng) {
  const group = new THREE.Group();
  group.name = 'SuryaBayCity';
  const colliders = [];
  const buildings = [];
  const roadCenters = [];
  const clouds = [];
  let seaMesh = null;

  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const facadeMats = [];
  const roofMats = [];
  PALETTES.forEach((palette) => {
    HEIGHT_ROWS.forEach((rows) => {
      const tex = facadeTexture(palette, rows, rng);
      facadeMats.push(new THREE.MeshLambertMaterial({ map: tex }));
    });
    roofMats.push(new THREE.MeshLambertMaterial({ color: palette.roof }));
  });
  const facadeFor = (paletteIndex, height) => {
    const rowClass = height <= 16 ? 0 : height <= 34 ? 1 : 2;
    return facadeMats[paletteIndex * HEIGHT_ROWS.length + rowClass];
  };

  // Ground: one big sidewalk slab, then the road network on top of it.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_HALF * 2 + 160, CITY_HALF * 2 + 160),
    new THREE.MeshLambertMaterial({ color: 0x9aa0a3 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 40);
  ground.receiveShadow = false;
  group.add(ground);

  const roadMat = new THREE.MeshLambertMaterial({ color: 0x2f3338 });
  const lineMat = new THREE.MeshLambertMaterial({ color: 0xd8d8d8 });
  for (let i = 0; i <= CITY_GRID; i += 1) {
    const c = -CITY_HALF + i * CITY_PITCH;
    roadCenters.push(c);
    const alongX = new THREE.Mesh(new THREE.PlaneGeometry(CITY_HALF * 2, CITY_ROAD), roadMat);
    alongX.rotation.x = -Math.PI / 2;
    alongX.position.set(0, 0.02, c);
    group.add(alongX);
    const alongZ = new THREE.Mesh(new THREE.PlaneGeometry(CITY_ROAD, CITY_HALF * 2), roadMat);
    alongZ.rotation.x = -Math.PI / 2;
    alongZ.position.set(c, 0.02, 0);
    group.add(alongZ);
    // Dashed centre lines, one dash per half block.
    for (let d = -CITY_HALF + 14; d < CITY_HALF; d += 28) {
      const dashX = new THREE.Mesh(new THREE.PlaneGeometry(10, 0.5), lineMat);
      dashX.rotation.x = -Math.PI / 2;
      dashX.position.set(d, 0.04, c);
      group.add(dashX);
      const dashZ = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 10), lineMat);
      dashZ.rotation.x = -Math.PI / 2;
      dashZ.position.set(c, 0.04, d);
      group.add(dashZ);
    }
  }

  // Beach and sea along the south edge, plus a wooden pier and a lighthouse.
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_HALF * 2 + 160, SEA_Z - CITY_HALF),
    new THREE.MeshLambertMaterial({ color: 0xe6cf9a }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.01, CITY_HALF + (SEA_Z - CITY_HALF) / 2);
  group.add(sand);
  seaMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_HALF * 2 + 400, 560),
    new THREE.MeshLambertMaterial({ color: 0x1e6f9e }),
  );
  seaMesh.rotation.x = -Math.PI / 2;
  seaMesh.position.set(0, -0.4, SEA_Z + 280);
  group.add(seaMesh);

  const pierMat = new THREE.MeshLambertMaterial({ color: 0x8a6b48 });
  const pier = new THREE.Mesh(boxGeo, pierMat);
  pier.scale.set(10, 1, 90);
  pier.position.set(-120, 0.5, SEA_Z + 30);
  group.add(pier);
  colliders.push({ minX: -125, maxX: -115, minZ: SEA_Z - 15, maxZ: SEA_Z + 75 });

  const lightMat = new THREE.MeshLambertMaterial({ color: 0xf2f2f2 });
  const lightTop = new THREE.MeshLambertMaterial({ color: 0xd23b3b });
  const lighthouse = new THREE.Group();
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(4, 5.5, 34, 10), lightMat);
  tower.position.y = 17;
  lighthouse.add(tower);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 5, 10), lightTop);
  cap.position.y = 36;
  lighthouse.add(cap);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(2.2, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
  lamp.position.y = 40;
  lighthouse.add(lamp);
  lighthouse.position.set(150, 0, BEACH_Z + 6);
  group.add(lighthouse);
  colliders.push({ minX: 144, maxX: 156, minZ: BEACH_Z, maxZ: BEACH_Z + 12 });

  // Buildings, block by block. The centre is downtown (taller), the edges are low.
  const parkMat = new THREE.MeshLambertMaterial({ color: 0x5d8a4a });
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2f });
  const palmMat = new THREE.MeshLambertMaterial({ color: 0x3f8f4f });
  const lampPoleMat = new THREE.MeshLambertMaterial({ color: 0x3a3f45 });
  const lampHeadMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  const trunkGeo = new THREE.CylinderGeometry(0.5, 0.8, 7, 6);
  const frondGeo = new THREE.SphereGeometry(2.6, 7, 5);
  const poleGeo = new THREE.CylinderGeometry(0.18, 0.22, 7, 6);
  const headGeo = new THREE.SphereGeometry(0.55, 8, 6);

  function addPalm(x, z, scale) {
    const palm = new THREE.Group();
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 3.5;
    palm.add(trunk);
    for (let k = 0; k < 3; k += 1) {
      const frond = new THREE.Mesh(frondGeo, palmMat);
      frond.scale.set(1.4, 0.5, 1.4);
      frond.position.set(Math.cos(k * 2.1) * 1.2, 7.2, Math.sin(k * 2.1) * 1.2);
      palm.add(frond);
    }
    palm.position.set(x, 0, z);
    palm.scale.setScalar(scale);
    group.add(palm);
  }

  for (let i = 0; i < CITY_GRID; i += 1) {
    for (let j = 0; j < CITY_GRID; j += 1) {
      const cx = -CITY_HALF + CITY_PITCH / 2 + i * CITY_PITCH;
      const cz = -CITY_HALF + CITY_PITCH / 2 + j * CITY_PITCH;
      const distCenter = Math.hypot(cx, cz) / CITY_HALF;
      if (rng.chance(0.09)) {
        // A pocket park: grass, palms and a bench.
        const park = new THREE.Mesh(new THREE.PlaneGeometry(CITY_BLOCK, CITY_BLOCK), parkMat);
        park.rotation.x = -Math.PI / 2;
        park.position.set(cx, 0.03, cz);
        group.add(park);
        addPalm(cx - 10, cz - 8, 1);
        addPalm(cx + 12, cz + 9, 0.9);
        const bench = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x7a5c3e }));
        bench.scale.set(5, 1, 1.6);
        bench.position.set(cx, 0.5, cz);
        group.add(bench);
        colliders.push({ minX: cx - 2.5, maxX: cx + 2.5, minZ: cz - 0.8, maxZ: cz + 0.8 });
        continue;
      }
      const count = rng.chance(0.55) ? 2 : 1;
      for (let b = 0; b < count; b += 1) {
        const w = rng.range(12, 20);
        const d = rng.range(12, 20);
        const maxH = 62 - distCenter * 38;
        const h = Math.max(8, rng.range(8, Math.max(10, maxH)));
        const ox = count === 1 ? 0 : (b === 0 ? -9 : 9);
        const oz = count === 1 ? 0 : (b === 0 ? 8 : -8);
        const x = cx + ox;
        const z = cz + oz;
        const paletteIndex = rng.int(0, PALETTES.length - 1);
        const mesh = new THREE.Mesh(boxGeo, [
          facadeFor(paletteIndex, h),
          facadeFor(paletteIndex, h),
          roofMats[paletteIndex],
          roofMats[paletteIndex],
          facadeFor(paletteIndex, h),
          facadeFor(paletteIndex, h),
        ]);
        mesh.scale.set(w, h, d);
        mesh.position.set(x, h / 2, z);
        group.add(mesh);
        buildings.push({ mesh, x, z, w, d, h });
        colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
      }
    }
  }

  // Street lamps at every other intersection, palms along the beach.
  for (let i = 0; i <= CITY_GRID; i += 2) {
    for (let j = 0; j <= CITY_GRID; j += 2) {
      const x = -CITY_HALF + i * CITY_PITCH + 7;
      const z = -CITY_HALF + j * CITY_PITCH + 7;
      const pole = new THREE.Mesh(poleGeo, lampPoleMat);
      pole.position.set(x, 3.5, z);
      group.add(pole);
      const head = new THREE.Mesh(headGeo, lampHeadMat);
      head.position.set(x, 7.2, z);
      group.add(head);
    }
  }
  for (let x = -300; x <= 300; x += 42) {
    addPalm(x + rng.range(-6, 6), BEACH_Z + rng.range(-4, 10), rng.range(0.9, 1.3));
  }

  // A few slow clouds for the sky.
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
  for (let c = 0; c < 9; c += 1) {
    const cloud = new THREE.Mesh(new THREE.SphereGeometry(rng.range(9, 18), 8, 6), cloudMat);
    cloud.scale.y = 0.35;
    cloud.position.set(rng.range(-380, 380), rng.range(85, 130), rng.range(-380, 380));
    group.add(cloud);
    clouds.push(cloud);
  }

  function nearestRoadPoint(x, z) {
    let bx = roadCenters[0];
    let bz = roadCenters[0];
    for (const c of roadCenters) {
      if (Math.abs(x - c) < Math.abs(x - bx)) bx = c;
      if (Math.abs(z - c) < Math.abs(z - bz)) bz = c;
    }
    // Snap to whichever road line is closer.
    return Math.abs(x - bx) < Math.abs(z - bz) ? { x: bx, z } : { x, z: bz };
  }

  function randomRoadPoint() {
    const vertical = rng.chance(0.5);
    const line = rng.pick(roadCenters);
    const along = rng.range(-CITY_HALF + 20, CITY_HALF - 20);
    return vertical ? { x: line, z: along } : { x: along, z: line };
  }

  function randomSidewalkPoint() {
    const p = randomRoadPoint();
    return { x: p.x + rng.range(-9, 9), z: p.z + rng.range(-9, 9) };
  }

  // Push a circle out of every building AABB and keep it inside the city.
  function collideCircle(pos, radius) {
    for (const c of colliders) {
      const nx = Math.max(c.minX, Math.min(pos.x, c.maxX));
      const nz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
      const dx = pos.x - nx;
      const dz = pos.z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 < radius * radius && d2 > 0.0001) {
        const d = Math.sqrt(d2);
        pos.x = nx + (dx / d) * radius;
        pos.z = nz + (dz / d) * radius;
      } else if (d2 <= 0.0001 && pos.x > c.minX && pos.x < c.maxX && pos.z > c.minZ && pos.z < c.maxZ) {
        pos.x = c.maxX + radius;
      }
    }
    pos.x = Math.max(-CITY_HALF - 10, Math.min(CITY_HALF + 10, pos.x));
    pos.z = Math.max(-CITY_HALF - 10, Math.min(SEA_Z + 40, pos.z));
    return pos;
  }

  return {
    group,
    colliders,
    buildings,
    roadCenters,
    clouds,
    half: CITY_HALF,
    beachZ: BEACH_Z,
    seaZ: SEA_Z,
    nearestRoadPoint,
    randomRoadPoint,
    randomSidewalkPoint,
    collideCircle,
    update(dt, time) {
      for (const cloud of clouds) {
        cloud.position.x += dt * 1.5;
        if (cloud.position.x > 420) cloud.position.x = -420;
      }
      if (seaMesh) seaMesh.position.y = -0.4 + Math.sin(time * 0.6) * 0.18;
    },
  };
}
