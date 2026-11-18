// main.js — Surya Bay boot and game loop.
// Builds the world, wires every system, and runs the frame loop.
// ?shot=1..4 stages a deterministic scene for screenshots;
// ?autostart=1 skips the menu (used by tests). window.__surya is a small
// debug handle for playtesting, not part of the game.
import * as THREE from "three";
import { makeRng } from "./random.js";
import { makeInput } from "./input.js";
import { makeAudio } from "./audio.js";
import { saveGame, loadGame, clearSave } from "./save.js";
import { buildCity } from "./city.js";
import { makePlayer } from "./player.js";
import { makeCar, driveCar, separateCars } from "./vehicles.js";
import { makeTraffic } from "./traffic.js";
import { makePedestrians } from "./pedestrians.js";
import { makePolice } from "./police.js";
import { makeMissions } from "./missions.js";
import { makeHud } from "./hud.js";

const params = new URLSearchParams(location.search);
const SHOT = parseInt(params.get("shot") || "0", 10) || 0;
const AUTOSTART = params.get("autostart") === "1" || SHOT > 0;

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById("game").appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8ec9e8);
scene.fog = new THREE.Fog(0x8ec9e8, 260, 700);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
camera.position.set(0, 8, 140);

const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a7a5a, 0.9);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2d0, 2.0);
sun.position.set(180, 260, 120);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -160;
sun.shadow.camera.right = 160;
sun.shadow.camera.top = 160;
sun.shadow.camera.bottom = -160;
sun.shadow.camera.far = 700;
scene.add(sun);
scene.add(sun.target);

// The one shared game object every system reads and writes.
const G = {
  scene, camera, renderer,
  rng: makeRng(1337),
  time: 0,
  mode: "menu", // menu | playing | paused
  cars: [],
  effects: [],
  shake: 0,
  input: null,
  audio: null,
  city: null,
  player: null,
  traffic: null,
  peds: null,
  police: null,
  missions: null,
  hud: null,
};

G.input = makeInput(renderer.domElement);
G.audio = makeAudio();
G.city = buildCity(scene, G.rng);
G.player = makePlayer(G);
G.traffic = makeTraffic(G);
G.peds = makePedestrians(G);
G.police = makePolice(G);
G.missions = makeMissions(G);
G.hud = makeHud(G);

G.traffic.init(14);
G.peds.init(24);

// Parked cars along the roads, seeded so the same spots appear every run.
for (let i = 0; i < 10; i++) {
  const spot = G.city.randomRoadPoint(G.rng);
  const side = G.rng.pick([-7.5, 7.5]);
  const x = spot.alongX ? spot.x + side : spot.x;
  const z = spot.alongX ? spot.z : spot.z + side;
  if (Math.abs(x) > 305 || Math.abs(z) > 305) continue;
  const car = makeCar(G, {
    x, z,
    kind: G.rng.chance(0.15) ? "truck" : "sedan",
    heading: spot.alongX ? (G.rng.chance(0.5) ? 0 : Math.PI) : (G.rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2),
  });
  G.cars.push(car);
}

// Health + armor pickups scattered around the city.
const pickups = [];
function addPickup(kind, x, z) {
  const color = kind === "health" ? 0x2fae5f : 0x2e6fc2;
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 1.1, 1.1),
    new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.5 })
  );
  mesh.position.set(x, 0.9, z);
  mesh.castShadow = true;
  scene.add(mesh);
  pickups.push({ kind, mesh, pos: mesh.position, taken: false, respawnAt: 0 });
}
addPickup("health", 40, 100);
addPickup("armor", -40, 100);
addPickup("health", 120, -120);
addPickup("armor", -120, -120);
addPickup("health", 200, 200);
addPickup("armor", -200, 200);

G.hud.setStars(0);
G.missions.start();

function startGame(fromSave) {
  const saved = fromSave ? loadGame() : null;
  if (saved) {
    G.player.cash = saved.cash || 50;
    G.player.pos.set(saved.x || 0, 0, saved.z || 120);
    G.missions.index = Math.min(saved.mission || 0, 5);
    G.missions.step = 0;
    G.hud.toast("Save loaded — welcome back to Surya Bay.");
  }
  G.mode = "playing";
  G.hud.hideMenu();
  G.hud.hideWasted();
  G.audio.ensure();
  G.audio.startMusic();
  G.missions.start();
  G.input.requestLock();
}

function pauseGame() {
  if (G.mode !== "playing") return;
  G.mode = "paused";
  G.hud.showPause();
  G.audio.setEngine(false, 0);
  G.audio.setSiren(false);
}

function resumeGame() {
  if (G.mode !== "paused") return;
  G.mode = "playing";
  G.hud.hidePause();
  G.input.requestLock();
}

function quitToMenu() {
  saveGame({
    cash: Math.floor(G.player.cash),
    x: G.player.car ? G.player.car.pos.x : G.player.pos.x,
    z: G.player.car ? G.player.car.pos.z : G.player.pos.z,
    mission: G.missions.index,
  });
  G.mode = "menu";
  G.hud.hidePause();
  G.hud.showMenu();
  G.audio.stopMusic();
  G.audio.setEngine(false, 0);
  G.audio.setSiren(false);
}

document.getElementById("btn-start").addEventListener("click", () => startGame(false));
document.getElementById("btn-continue").addEventListener("click", () => startGame(true));
document.getElementById("btn-resume").addEventListener("click", resumeGame);
document.getElementById("btn-quit").addEventListener("click", quitToMenu);
document.getElementById("btn-wasted").addEventListener("click", () => {
  G.player.respawn();
  G.hud.hideWasted();
  G.mode = "playing";
});
document.getElementById("btn-restart").addEventListener("click", () => {
  clearSave();
  location.reload();
});
renderer.domElement.addEventListener("click", () => {
  if (G.mode === "playing") G.input.requestLock();
});
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---- Deterministic shot staging -------------------------------------------
function stageShot(n) {
  const P = G.player;
  if (n === 4) {
    // Start screen over the city, slow orbit handled by the menu camera.
    G.mode = "menu";
    G.hud.showMenu();
    return;
  }
  G.mode = "playing";
  G.hud.hideMenu();
  G.audio.ensure();
  if (n === 1) {
    // Cover: police chase at speed, 3 stars, mission marker ahead.
    const car = makeCar(G, { x: 0, z: 60, kind: "sedan", color: 0xc23b2e, heading: 0, driver: "player" });
    G.cars.push(car);
    P.onFoot = false;
    P.car = car;
    P.mesh.visible = false;
    car.speed = 30;
    P.camYaw = 0;
    P.camPitch = 0.22;
    G.police.wanted = 3;
    G.hud.setStars(3);
    // Police in frame ahead of the player: one pulling alongside to ram,
    // one closing from further up the road.
    const pc1 = G.police.spawnPoliceCar();
    pc1.pos.set(5, 0, 66);
    pc1.heading = 0;
    pc1.speed = 30;
    const pc2 = G.police.spawnPoliceCar();
    pc2.pos.set(-5, 0, 92);
    pc2.heading = 0;
    pc2.speed = 28;
    G.missions.index = 0;
    G.missions.step = 0;
    G.missions.setMarker(0, 240);
  } else if (n === 2) {
    // On foot on a busy street: the player stands on avenue x=0 facing
    // the plaza, traffic rolling toward them, pedestrians on the sidewalks.
    P.pos.set(0, 0, 40);
    P.heading = Math.PI;
    P.camYaw = Math.PI;
    P.camPitch = 0.3;
    for (let i = 0; i < 3; i++) {
      const car = G.traffic.cars[i];
      if (car) {
        car.pos.set(0, 0, 12 - i * 18);
        car.heading = Math.PI;
        car.alongX = true;
        car.dir = -1;
        car.speed = 9;
      }
    }
    const near = G.peds.list.slice(0, 6);
    near.forEach((ped, i) => {
      ped.pos.set(i % 2 === 0 ? -8 : 8, 0, 48 - i * 6);
      ped.state = "walk";
      ped.target = { x: ped.pos.x, z: ped.pos.z - 40 };
    });
    G.missions.index = 0;
    G.missions.step = 0;
    G.missions.setMarker(0, -80);
  } else if (n === 3) {
    // Driving fast down a boulevard, 2 stars.
    const car = makeCar(G, { x: -52, z: 100, kind: "sedan", color: 0x2e6fc2, heading: Math.PI, driver: "player" });
    G.cars.push(car);
    P.onFoot = false;
    P.car = car;
    P.mesh.visible = false;
    car.speed = 38;
    P.camYaw = Math.PI;
    P.camPitch = 0.16;
    G.police.wanted = 2;
    G.hud.setStars(2);
    // A police car ahead on the same boulevard, slower, so the player
    // closes on it in frame.
    const pc = G.police.spawnPoliceCar();
    pc.pos.set(-46, 0, 55);
    pc.heading = Math.PI;
    pc.speed = 20;
    G.missions.index = 1;
    G.missions.step = 1;
    G.missions.setMarker(-52, -160);
  }
}

// ---- Frame loop ------------------------------------------------------------
const clock = new THREE.Clock();
let menuOrbit = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (G.mode === "menu") {
    menuOrbit += dt * 0.04;
    camera.position.set(Math.sin(menuOrbit) * 220, 90, Math.cos(menuOrbit) * 220);
    camera.lookAt(0, 10, 0);
    // Traffic still rolls behind the menu for life.
    G.traffic.update(dt);
    G.audio.tick(dt);
    // Keep the HUD (and its minimap) alive behind the menu overlay,
    // so the menu shot does not show a blank minimap panel.
    G.hud.update(dt);
    G.input.endFrame();
    renderer.render(scene, camera);
    return;
  }
  if (G.mode === "paused") {
    G.input.endFrame();
    renderer.render(scene, camera);
    return;
  }
  G.time += dt;

  // Global keys.
  if (G.input.hit("Escape") || G.input.hit("KeyP")) pauseGame();
  // E is exclusive per frame: one press either enters or exits a car,
  // never both (exiting then instantly re-entering the same car).
  if (G.input.hit("KeyE")) {
    if (G.player.car) G.player.exitCar();
    else if (G.player.onFoot) G.player.tryEnterCar();
  }

  // Player.
  G.player.update(dt);

  // Player's car.
  if (G.player.car) {
    const input = G.input;
    const throttle = (input.down("KeyW") || input.down("ArrowUp") ? 1 : 0) + (input.down("KeyS") || input.down("ArrowDown") ? -1 : 0);
    const steer = (input.down("KeyD") ? 1 : 0) + (input.down("KeyA") ? -1 : 0);
    const handbrake = input.down("Space");
    driveCar(G, G.player.car, dt, throttle, steer, handbrake);
    // Driving fast through a red light district of peds scares them.
    if (Math.abs(G.player.car.speed) > 15) {
      G.peds.fleeFrom(G.player.car.pos.x, G.player.car.pos.z, 18);
    }
  }

  // World systems.
  G.traffic.update(dt);
  G.peds.update(dt);
  G.police.update(dt);
  G.missions.update(dt);
  G.audio.tick(dt);

  // Car-car separation across every pair.
  for (let i = 0; i < G.cars.length; i++) {
    for (let j = i + 1; j < G.cars.length; j++) {
      separateCars(G, G.cars[i], G.cars[j]);
    }
  }

  // Pickups: bob, spin, grant on touch, respawn after a minute.
  // Measured from the car while driving, so driving over one collects it.
  const ex = G.player.car ? G.player.car.pos.x : G.player.pos.x;
  const ez = G.player.car ? G.player.car.pos.z : G.player.pos.z;
  for (const pk of pickups) {
    if (pk.taken) {
      if (G.time > pk.respawnAt) {
        pk.taken = false;
        pk.mesh.visible = true;
      }
      continue;
    }
    pk.mesh.rotation.y += dt * 2;
    pk.mesh.position.y = 0.9 + Math.sin(G.time * 3) * 0.15;
    const d = Math.hypot(ex - pk.pos.x, ez - pk.pos.z);
    if (d < 2.2) {
      pk.taken = true;
      pk.mesh.visible = false;
      pk.respawnAt = G.time + 60;
      if (pk.kind === "health") {
        G.player.heal(50);
        G.hud.toast("Health +50");
      } else {
        G.player.armor = Math.min(G.player.maxArmor, G.player.armor + 50);
        G.hud.toast("Armor +50");
      }
      G.audio.pickup();
    }
  }

  // Fading effects (tracer lines).
  for (let i = G.effects.length - 1; i >= 0; i--) {
    const e = G.effects[i];
    e.life -= dt;
    if (e.life <= 0) {
      G.scene.remove(e.mesh);
      e.mesh.geometry.dispose();
      e.mesh.material.dispose();
      G.effects.splice(i, 1);
    } else if (e.fade) {
      e.mesh.material.opacity = e.life / e.max;
    }
  }

  // Autosave every 20 s while playing.
  if (Math.floor(G.time) % 20 === 0 && Math.floor(G.time - dt) % 20 !== 0) {
    saveGame({
      cash: Math.floor(G.player.cash),
      x: G.player.car ? G.player.car.pos.x : G.player.pos.x,
      z: G.player.car ? G.player.car.pos.z : G.player.pos.z,
      mission: G.missions.index,
    });
  }

  G.hud.update(dt);
  G.input.endFrame();
  renderer.render(scene, camera);
}

if (SHOT > 0) {
  stageShot(SHOT);
} else if (AUTOSTART) {
  startGame(false);
}
animate();

// Small debug handle for playtesting (teleport, mission control, state).
window.__surya = {
  G,
  teleport(x, z) {
    G.player.pos.set(x, 0, z);
    if (G.player.car) {
      G.player.car.pos.set(x, 0, z);
    }
  },
  start() {
    startGame(false);
  },
  mission() {
    return { index: G.missions.index, step: G.missions.step, done: G.missions.done };
  },
  wanted() {
    return G.police.wanted;
  },
};
