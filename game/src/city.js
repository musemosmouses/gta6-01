// city.js — the seeded procedural city of Surya Bay.
// A 12x12 block grid with roads, buildings, a beach and sea on the south
// edge, palms, lamps, a spray garage and a hospital. One seed builds the
// same city every time. Colliders are plain AABBs in the XZ plane.
import * as THREE from "three";

const PITCH = 52;
const BLOCK = 40;
const ROAD_W = 12;
const HALF = 6;

function avenueAt(i) {
  return -312 + i * PITCH;
}
function blockCenter(i) {
  return -312 + i * PITCH + PITCH / 2;
}

function facadeTexture(base, lit, rng) {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 256);
  const cols = 5;
  const rows = 10;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const on = rng.chance(0.55);
      g.fillStyle = on ? lit : "rgba(30,34,44,0.85)";
      g.fillRect(10 + x * 23, 12 + y * 24, 14, 15);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildCity(scene, rng) {
  const colliders = [];
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const facadeMats = [
    new THREE.MeshLambertMaterial({ map: facadeTexture("#e8dcc8", "#ffd98a", rng) }),
    new THREE.MeshLambertMaterial({ map: facadeTexture("#d9a06b", "#ffe9a8", rng) }),
    new THREE.MeshLambertMaterial({ map: facadeTexture("#7fb3a8", "#fff2b0", rng) }),
    new THREE.MeshLambertMaterial({ map: facadeTexture("#c96f5a", "#ffd98a", rng) }),
    new THREE.MeshLambertMaterial({ map: facadeTexture("#f2efe6", "#ffe9a8", rng) }),
  ];
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x5a5148 });
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x2e2e33 });
  const walkMat = new THREE.MeshLambertMaterial({ color: 0x9a938a });
  const sandMat = new THREE.MeshLambertMaterial({ color: 0xe6cf9e });
  const seaMat = new THREE.MeshLambertMaterial({ color: 0x2e7fb8, transparent: true, opacity: 0.92 });
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5230 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2f8f4e });
  const lampPoleMat = new THREE.MeshLambertMaterial({ color: 0x3a3f45 });
  const lampHeadMat = new THREE.MeshLambertMaterial({ color: 0xfff2b0, emissive: 0xffdf80, emissiveIntensity: 0.9 });

  // Ground: sidewalk grey for the whole city, then dark road strips.
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(624, 624), walkMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 0);
  ground.receiveShadow = true;
  scene.add(ground);

  const roadGeoX = new THREE.PlaneGeometry(624, ROAD_W);
  const roadGeoZ = new THREE.PlaneGeometry(ROAD_W, 624);
  for (let i = 0; i <= 12; i++) {
    const ax = new THREE.Mesh(roadGeoX, roadMat);
    ax.rotation.x = -Math.PI / 2;
    ax.position.set(0, 0.02, avenueAt(i));
    ax.receiveShadow = true;
    scene.add(ax);
    const az = new THREE.Mesh(roadGeoZ, roadMat);
    az.rotation.x = -Math.PI / 2;
    az.position.set(avenueAt(i), 0.02, 0);
    az.receiveShadow = true;
    scene.add(az);
  }

  // Lane dashes, instanced, along every avenue and street.
  const dashGeo = new THREE.BoxGeometry(0.5, 0.05, 4);
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xd8d8d8 });
  const dashCount = 13 * 2 * 30;
  const dashes = new THREE.InstancedMesh(dashGeo, dashMat, dashCount);
  const m4 = new THREE.Matrix4();
  let di = 0;
  for (let i = 0; i <= 12; i++) {
    for (let k = 0; k < 30; k++) {
      const along = -300 + k * 20 + 10;
      m4.makeTranslation(avenueAt(i), 0.06, along);
      dashes.setMatrixAt(di++, m4);
      m4.makeTranslation(along, 0.06, avenueAt(i));
      dashes.setMatrixAt(di++, m4);
    }
  }
  dashes.count = di;
  scene.add(dashes);

  // Buildings, one to four per block; taller near the centre.
  const parkBlocks = new Set(["5,5", "2,8", "9,3"]);
  for (let i = 0; i < 12; i++) {
    for (let j = 0; j < 12; j++) {
      const cx = blockCenter(i);
      const cz = blockCenter(j);
      if (parkBlocks.has(i + "," + j)) {
        // Park: palms and a bench or two, no buildings.
        const palms = 3 + rng.int(0, 2);
        for (let p = 0; p < palms; p++) {
          addPalm(scene, cx + rng.range(-14, 14), cz + rng.range(-14, 14), rng, trunkMat, leafMat);
        }
        continue;
      }
      const distC = Math.hypot(cx, cz) / 440;
      const maxH = 70 - distC * 45;
      const n = rng.int(1, 3);
      const slots = [
        [-9, -9], [9, -9], [-9, 9], [9, 9],
      ];
      for (let s = 0; s < n; s++) {
        const slot = slots[(s + rng.int(0, 3)) % 4];
        const w = rng.range(12, 20);
        const d = rng.range(12, 20);
        const h = Math.max(8, rng.range(8, maxH));
        const bx = cx + slot[0];
        const bz = cz + slot[1];
        const mat = facadeMats[rng.int(0, facadeMats.length - 1)];
        const b = new THREE.Mesh(boxGeo, mat);
        b.scale.set(w, h, d);
        b.position.set(bx, h / 2, bz);
        b.castShadow = true;
        b.receiveShadow = true;
        scene.add(b);
        const roof = new THREE.Mesh(boxGeo, roofMat);
        roof.scale.set(w + 0.6, 0.8, d + 0.6);
        roof.position.set(bx, h + 0.4, bz);
        scene.add(roof);
        colliders.push({ minX: bx - w / 2, maxX: bx + w / 2, minZ: bz - d / 2, maxZ: bz + d / 2 });
      }
    }
  }

  // Central plaza fountain at the middle block.
  const fountainBase = new THREE.Mesh(new THREE.CylinderGeometry(7, 8, 1.2, 20), new THREE.MeshLambertMaterial({ color: 0x8a8578 }));
  fountainBase.position.set(0, 0.6, 0);
  fountainBase.castShadow = true;
  scene.add(fountainBase);
  const fountainWater = new THREE.Mesh(new THREE.CylinderGeometry(6.2, 6.2, 0.4, 20), new THREE.MeshLambertMaterial({ color: 0x3fa8d8 }));
  fountainWater.position.set(0, 1.2, 0);
  scene.add(fountainWater);
  colliders.push({ minX: -8, maxX: 8, minZ: -8, maxZ: 8 });

  // Beach and sea on the south edge (z beyond the last street).
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(624, 60), sandMat);
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.03, 342);
  sand.receiveShadow = true;
  scene.add(sand);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(700, 220), seaMat);
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, 0.05, 480);
  scene.add(sea);
  for (let u = 0; u < 8; u++) {
    const ux = -260 + u * 74 + rng.range(-8, 8);
    addUmbrella(scene, ux, 336 + rng.range(-4, 6), rng);
  }
  for (let p = 0; p < 14; p++) {
    addPalm(scene, -300 + p * 46 + rng.range(-6, 6), 322 + rng.range(-3, 3), rng, trunkMat, leafMat);
  }

  // Street lamps along the avenues, instanced.
  const lampPoleGeo = new THREE.CylinderGeometry(0.12, 0.16, 5.4, 6);
  const lampHeadGeo = new THREE.SphereGeometry(0.42, 8, 6);
  const lampSpots = [];
  for (let i = 0; i <= 12; i += 2) {
    for (let k = -5; k <= 5; k++) {
      lampSpots.push([avenueAt(i) + 6.4, -260 + k * 52]);
    }
  }
  const poles = new THREE.InstancedMesh(lampPoleGeo, lampPoleMat, lampSpots.length);
  const heads = new THREE.InstancedMesh(lampHeadGeo, lampHeadMat, lampSpots.length);
  lampSpots.forEach(([x, z], idx) => {
    m4.makeTranslation(x, 2.7, z);
    poles.setMatrixAt(idx, m4);
    m4.makeTranslation(x, 5.5, z);
    heads.setMatrixAt(idx, m4);
  });
  scene.add(poles);
  scene.add(heads);

  // Spray garage (clears wanted for $100) on the west edge, and the
  // hospital (respawn point) on the east edge. Fixed spots, easy to find.
  const garage = { x: -286, z: 286, r: 14 };
  const gBase = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x2f6fb8 }));
  gBase.scale.set(20, 8, 14);
  gBase.position.set(garage.x, 4, garage.z + 12);
  gBase.castShadow = true;
  scene.add(gBase);
  const gSign = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0xffd23f, emissive: 0x554400 }));
  gSign.scale.set(14, 2, 1);
  gSign.position.set(garage.x, 9, garage.z + 4.6);
  scene.add(gSign);
  colliders.push({ minX: garage.x - 10, maxX: garage.x + 10, minZ: garage.z + 5, maxZ: garage.z + 19 });

  const hospital = { x: 286, z: -286 };
  const hBase = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }));
  hBase.scale.set(22, 16, 16);
  hBase.position.set(hospital.x, 8, hospital.z - 12);
  hBase.castShadow = true;
  scene.add(hBase);
  const crossMat = new THREE.MeshLambertMaterial({ color: 0xd23b3b });
  const crossV = new THREE.Mesh(boxGeo, crossMat);
  crossV.scale.set(2, 6, 0.6);
  crossV.position.set(hospital.x, 12, hospital.z - 3.8);
  scene.add(crossV);
  const crossH = new THREE.Mesh(boxGeo, crossMat);
  crossH.scale.set(6, 2, 0.6);
  crossH.position.set(hospital.x, 12, hospital.z - 3.8);
  scene.add(crossH);
  colliders.push({ minX: hospital.x - 11, maxX: hospital.x + 11, minZ: hospital.z - 20, maxZ: hospital.z - 4 });

  function addPalm(scn, x, z, r, trunkM, leafM) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 6, 6), trunkM);
    trunk.position.set(x, 3, z);
    trunk.castShadow = true;
    scn.add(trunk);
    const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(2.4, 0), leafM);
    leaves.position.set(x, 6.6, z);
    leaves.scale.y = 0.7;
    leaves.castShadow = true;
    scn.add(leaves);
  }
  function addUmbrella(scn, x, z, r) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 3, 6), trunkMat);
    pole.position.set(x, 1.5, z);
    scn.add(pole);
    const top = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.2, 8), new THREE.MeshLambertMaterial({ color: r.pick([0xe84a5f, 0xffd23f, 0x2f8f6f]) }));
    top.position.set(x, 3.4, z);
    top.castShadow = true;
    scn.add(top);
  }

  // Collision: push a circle (x,z,r) out of every building AABB.
  function pushOut(pos, r) {
    for (let c = 0; c < colliders.length; c++) {
      const b = colliders[c];
      const cx = Math.max(b.minX, Math.min(pos.x, b.maxX));
      const cz = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
      const dx = pos.x - cx;
      const dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 0.0001) {
          const d = Math.sqrt(d2);
          pos.x = cx + (dx / d) * r;
          pos.z = cz + (dz / d) * r;
        } else {
          pos.x = b.maxX + r;
        }
      }
    }
    pos.x = Math.max(-312, Math.min(312, pos.x));
    pos.z = Math.max(-312, Math.min(372, pos.z));
  }

  function hitsBuilding(x, z, r) {
    for (let c = 0; c < colliders.length; c++) {
      const b = colliders[c];
      if (x + r > b.minX && x - r < b.maxX && z + r > b.minZ && z - r < b.maxZ) return true;
    }
    return false;
  }

  function randomRoadPoint(r) {
    if (r.chance(0.5)) {
      return { x: avenueAt(r.int(0, 12)), z: r.range(-300, 300), alongX: true };
    }
    return { x: r.range(-300, 300), z: avenueAt(r.int(0, 12)), alongX: false };
  }

  return {
    colliders, pushOut, hitsBuilding, randomRoadPoint,
    garage, hospital, beachZ: 312, seaZ: 372,
    avenues: Array.from({ length: 13 }, (_, i) => avenueAt(i)),
  };
}
