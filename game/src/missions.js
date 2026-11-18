// missions.js — the story: 5 chained missions with markers, plus
// repeatable taxi and delivery side jobs. A beacon marks the current
// target in the world and on the minimap; the HUD shows the objective.
import * as THREE from "three";
import { randomRoadPoint } from "./city.js";
import { makeRng } from "./random.js";
import { hurtPlayer } from "./player.js";

const MISSIONS = [
  {
    name: "First Run",
    reward: 200,
    steps: [
      { text: "Pick up the package at the courier point", x: 60, z: -80, r: 6 },
      { text: "Deliver the package to the docks", x: -80, z: 100, r: 6 },
    ],
  },
  {
    name: "Taxi Rush",
    reward: 300,
    timer: 90,
    steps: [
      { text: "Pick up the fare at Plaza North", x: 0, z: 52, r: 6 },
      { text: "Drop the fare off — hurry!", x: 150, z: -150, r: 6 },
    ],
  },
  {
    name: "Getaway",
    reward: 400,
    steps: [
      {
        text: "Meet the crew at the plaza",
        x: 0, z: 20, r: 6,
        onArrive(S) {
          S.police.addWanted(3, "getaway heat");
          S.hud.toast("The heat is on — run!");
        },
      },
      { text: "Lose the heat — reach the safehouse", x: -180, z: 180, r: 8 },
    ],
  },
  {
    name: "Turf Defense",
    reward: 500,
    steps: [
      {
        text: "Clear the plaza of the rival crew",
        x: 0, z: 0, r: 30, type: "clear",
        onStart(S) {
          spawnGang(S, 4);
        },
      },
    ],
  },
  {
    name: "The Big One",
    reward: 1000,
    steps: [
      {
        text: "Hit the bank — hold the vault",
        x: 120, z: 100, r: 7, type: "hold", holdTime: 5,
      },
      {
        text: "Escape to the boat on the beach",
        x: 0, z: 262, r: 8,
        onStart(S) {
          S.police.addWanted(3, "bank job");
        },
      },
    ],
  },
];

const STANDS = [
  { x: -60, z: 20, type: "taxi", label: "Press T for a taxi job" },
  { x: 20, z: -60, type: "delivery", label: "Press T for a delivery job" },
];

export function createMissions(S) {
  // Beacon: a light pillar and a spinning diamond over the target.
  const beacon = new THREE.Group();
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(2.4, 2.4, 34, 12, 1, true),
    new THREE.MeshLambertMaterial({ color: 0xffd23d, transparent: true, opacity: 0.22, side: THREE.DoubleSide })
  );
  pillar.position.y = 17;
  beacon.add(pillar);
  const gem = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.1),
    new THREE.MeshLambertMaterial({ color: 0xffd23d, emissive: 0x664400 })
  );
  gem.position.y = 7;
  gem.name = "gem";
  beacon.add(gem);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(4, 5, 24),
    new THREE.MeshLambertMaterial({ color: 0xffd23d, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.15;
  beacon.add(ring);
  S.scene.add(beacon);

  // Side-job stands get a small cyan ring on the ground.
  for (const st of STANDS) {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(2.5, 3.4, 20),
      new THREE.MeshLambertMaterial({ color: 0x4fc3e8, side: THREE.DoubleSide })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(st.x, 0.12, st.z);
    S.scene.add(m);
  }

  S.missions = {
    index: 0,
    stage: 0,
    defs: MISSIONS,
    beacon,
    gang: [],
    gangLeft: 0,
    sideJob: null,
    timer: 0,
    holdProgress: 0,
    done: false,
    rng: makeRng(S.seed + 404),
    onGangDown: (g) => onGangDown(S, g),
  };
  startCurrentStep(S);
}

export function startCurrentStep(S) {
  const m = S.missions;
  if (m.done) return;
  const def = m.defs[m.index];
  const step = def.steps[m.stage];
  if (!step) return;
  m.timer = def.timer || 0;
  m.holdProgress = 0;
  if (step.onStart) step.onStart(S);
  S.hud.toast("Mission: " + def.name);
  S.hud.setObjective(step.text);
}

function advanceStep(S) {
  const m = S.missions;
  const def = m.defs[m.index];
  m.stage += 1;
  if (m.stage >= def.steps.length) {
    S.player.cash += def.reward;
    S.audio.missionDone();
    S.hud.toast("Mission complete: " + def.name + " — +$" + def.reward);
    m.index += 1;
    m.stage = 0;
    if (m.index >= m.defs.length) {
      m.done = true;
      S.hud.setObjective("Story complete — Surya Bay is yours. Free roam!");
      S.hud.toast("STORY COMPLETE — you run Surya Bay now!");
      return;
    }
  }
  startCurrentStep(S);
}

export function currentTarget(S) {
  const m = S.missions;
  if (m.sideJob) {
    return m.sideJob.phase === "pickup" ? m.sideJob.pickup : m.sideJob.drop;
  }
  if (m.done) return null;
  const step = m.defs[m.index].steps[m.stage];
  return step ? { x: step.x, z: step.z } : null;
}

export function currentObjective(S) {
  const m = S.missions;
  if (m.sideJob) {
    const job = m.sideJob;
    const t = job.phase === "pickup" ? job.pickup : job.drop;
    const d = Math.hypot(effX(S) - t.x, effZ(S) - t.z);
    return {
      text: (job.type === "taxi" ? "Taxi job: " : "Delivery: ") + (job.phase === "pickup" ? "pick up" : "drop off") + " — $" + job.reward,
      dist: d,
    };
  }
  if (m.done) return { text: "Story complete — free roam!", dist: 0 };
  const def = m.defs[m.index];
  const step = def.steps[m.stage];
  const d = Math.hypot(effX(S) - step.x, effZ(S) - step.z);
  let text = def.name + ": " + step.text;
  if (step.type === "clear") text += " (" + (m.gangLeft) + " left)";
  if (step.type === "hold") text += " — hold " + Math.ceil(step.holdTime - m.holdProgress) + "s";
  if (m.timer > 0) text += " — " + Math.ceil(m.timer) + "s left";
  return { text, dist: d };
}

function effX(S) {
  return S.player.car ? S.player.car.pos.x : S.player.pos.x;
}
function effZ(S) {
  return S.player.car ? S.player.car.pos.z : S.player.pos.z;
}

export function updateMissions(S, dt) {
  const m = S.missions;
  // Spin the beacon gem and keep it over the current target.
  const gem = m.beacon.getObjectByName("gem");
  if (gem) gem.rotation.y += dt * 2;
  const target = currentTarget(S);
  if (target) {
    m.beacon.visible = true;
    m.beacon.position.set(target.x, 0, target.z);
  } else {
    m.beacon.visible = false;
  }

  // Side jobs first: T near a stand starts one.
  updateSideJobs(S, dt);
  updateGang(S, dt);
  if (m.done) return;

  const def = m.defs[m.index];
  const step = def.steps[m.stage];
  if (!step) return;

  // Mission timer (Taxi Rush): run out and the fare walks off.
  if (def.timer && m.timer > 0) {
    m.timer -= dt;
    if (m.timer <= 0) {
      m.stage = 0;
      S.hud.toast("Too slow — the fare walked off. Try again!");
      S.audio.thud();
      startCurrentStep(S);
      return;
    }
  }

  const d = Math.hypot(effX(S) - step.x, effZ(S) - step.z);
  if (step.type === "clear") {
    if (m.gangLeft <= 0) advanceStep(S);
    return;
  }
  if (step.type === "hold") {
    if (d < step.r) {
      m.holdProgress += dt;
      if (m.holdProgress >= step.holdTime) {
        S.player.cash += 150;
        S.hud.toast("Vault cracked — +$150!");
        advanceStep(S);
      }
    } else {
      m.holdProgress = Math.max(0, m.holdProgress - dt * 0.5);
    }
    return;
  }
  if (d < step.r) {
    if (step.onArrive) step.onArrive(S);
    advanceStep(S);
  }
}

function updateSideJobs(S, dt) {
  const m = S.missions;
  const p = S.player;
  if (!m.sideJob) {
    if (p.onFoot && S.input.keys.has("KeyT")) {
      for (const st of STANDS) {
        const d = Math.hypot(p.pos.x - st.x, p.pos.z - st.z);
        if (d < 6) {
          const pickup = randomRoadPoint(m.rng);
          const drop = randomRoadPoint(m.rng);
          const reward = st.type === "taxi" ? 60 + m.rng.int(0, 60) : 50 + m.rng.int(0, 40);
          m.sideJob = { type: st.type, phase: "pickup", pickup, drop, reward };
          S.hud.toast(st.type === "taxi" ? "Taxi job started — pick up the fare" : "Delivery started — pick up the package");
          S.input.keys.delete("KeyT");
          break;
        }
      }
    }
    return;
  }
  const job = m.sideJob;
  const t = job.phase === "pickup" ? job.pickup : job.drop;
  const d = Math.hypot(effX(S) - t.x, effZ(S) - t.z);
  if (d < 7) {
    if (job.phase === "pickup") {
      job.phase = "drop";
      S.hud.toast(job.type === "taxi" ? "Fare picked up — drop them off" : "Package picked up — deliver it");
      S.audio.pickup();
    } else {
      p.cash += job.reward;
      S.audio.cash();
      S.hud.toast("Side job done — +$" + job.reward);
      m.sideJob = null;
    }
  }
}

export function nearStandHint(S) {
  const p = S.player;
  if (!p.onFoot || S.missions.sideJob) return "";
  for (const st of STANDS) {
    const d = Math.hypot(p.pos.x - st.x, p.pos.z - st.z);
    if (d < 6) return st.label;
  }
  return "";
}

function spawnGang(S, n) {
  const m = S.missions;
  const rng = makeRng(S.seed + 505 + m.index * 17);
  for (let i = 0; i < n; i++) {
    const group = new THREE.Group();
    const shirt = new THREE.MeshLambertMaterial({ color: 0x8e1f1f });
    const skin = new THREE.MeshLambertMaterial({ color: 0xd8a070 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.0, 0.4), shirt);
    body.position.y = 1.1;
    group.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45), skin);
    head.position.y = 1.85;
    group.add(head);
    const a = rng.next() * Math.PI * 2;
    const x = Math.cos(a) * 18;
    const z = Math.sin(a) * 18;
    group.position.set(x, 0, z);
    S.scene.add(group);
    m.gang.push({
      group,
      pos: new THREE.Vector3(x, 0, z),
      yaw: 0,
      health: 100,
      down: false,
      kind: "gang",
      punchCooldown: 0,
      walkPhase: rng.next() * 6,
    });
  }
  m.gangLeft = n;
}

function updateGang(S, dt) {
  const m = S.missions;
  const p = S.player;
  for (const g of m.gang) {
    if (g.down) continue;
    g.punchCooldown = Math.max(0, g.punchCooldown - dt);
    const ex = p.car ? p.car.pos.x : p.pos.x;
    const ez = p.car ? p.car.pos.z : p.pos.z;
    const dx = ex - g.pos.x;
    const dz = ez - g.pos.z;
    const d = Math.hypot(dx, dz);
    g.yaw = Math.atan2(dx, dz);
    if (d > 2.0) {
      const step = Math.min(4.6 * dt, d - 1.6);
      g.pos.x += (dx / d) * step;
      g.pos.z += (dz / d) * step;
    } else if (p.onFoot && g.punchCooldown <= 0) {
      g.punchCooldown = 1.0;
      // Gang members punch the player on contact.
      hurtPlayer(S, 7, "jumped by a rival");
    }
    g.walkPhase += dt * 9;
    g.group.position.set(g.pos.x, 0, g.pos.z);
    g.group.rotation.y = g.yaw;
  }
}

export function onGangDown(S, g) {
  const m = S.missions;
  m.gangLeft = Math.max(0, m.gangLeft - 1);
  S.hud.toast("Rival down — " + m.gangLeft + " left");
}
