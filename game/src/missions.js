// missions.js — Surya Bay's story: five chained missions for Raka, plus
// repeatable taxi and delivery side jobs. Each mission is steps with a
// marker; the marker is a pulsing beacon in the world and a diamond on the
// minimap, with the objective and distance on the HUD.
import * as THREE from "three";
import { makeCar } from "./vehicles.js";

export function makeMissions(G) {
  const M = {
    index: 0, // which story mission is current (0..4); 5 = story done
    step: 0,
    done: false,
    gang: [],
    marker: null,
    markerMesh: null,
    taxiJob: null,
    deliveryJob: null,
    waitTimer: 0,
    grabTimer: 0,
  };

  const STORY = [
    {
      title: "First Errand",
      blurb: "Mira needs a package picked up at the market and dropped at the pier.",
      reward: 150,
      steps: [
        { text: "Pick up the package at the market", at: { x: 52, z: 52 }, r: 5 },
        { text: "Deliver the package to the pier", at: { x: -260, z: 330 }, r: 5 },
      ],
    },
    {
      title: "Taxi Rush",
      blurb: "Two fares are waiting. Pick them up in a car and drop them off.",
      reward: 250,
      steps: [
        { text: "Pick up the fare by the plaza (bring a car)", at: { x: 0, z: 52 }, r: 5, needCar: true },
        { text: "Drop the fare at the north beach", at: { x: 208, z: -260 }, r: 5 },
        { text: "Pick up the second fare at the station", at: { x: -208, z: -104 }, r: 5, needCar: true },
        { text: "Drop the second fare at the hospital", at: { x: 286, z: -286 }, r: 6 },
      ],
    },
    {
      title: "Getaway",
      blurb: "Steal the red Comet from the showroom and lose the heat at the hideout.",
      reward: 300,
      steps: [
        { text: "Steal the red Comet at the showroom", at: { x: 104, z: -52 }, r: 5, stealCar: true },
        { text: "Reach the hideout with the Comet", at: { x: -260, z: -260 }, r: 7 },
      ],
    },
    {
      title: "Turf Defense",
      blurb: "Rival crew is moving on your block. Send all four of them packing.",
      reward: 600,
      steps: [
        { text: "Defeat the rival crew on your block (4 left)", at: { x: 0, z: 120 }, r: 26, fight: true },
      ],
    },
    {
      title: "The Big One",
      blurb: "Grab the cash from the Surya Bank vault, then vanish at the hideout.",
      reward: 5000,
      steps: [
        { text: "Get inside the bank vault", at: { x: -52, z: -208 }, r: 5 },
        { text: "Hold still — cracking the vault…", at: { x: -52, z: -208 }, r: 5, hold: 3 },
        { text: "Escape to the hideout with the cash", at: { x: -260, z: -260 }, r: 7 },
      ],
    },
  ];

  function makeMarkerMesh() {
    const g = new THREE.Group();
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 1.6, 42, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false })
    );
    beam.position.y = 21;
    g.add(beam);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(2.2, 3.2, 24),
      new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.8, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.15;
    g.add(ring);
    const arrow = new THREE.Mesh(
      new THREE.ConeGeometry(1.1, 2.6, 4),
      new THREE.MeshBasicMaterial({ color: 0xffd23f })
    );
    arrow.position.y = 9;
    arrow.rotation.x = Math.PI;
    g.add(arrow);
    return { group: g, beam, ring, arrow };
  }

  M.setMarker = function (x, z) {
    M.marker = { x, z };
    if (!M.markerMesh) {
      M.markerMesh = makeMarkerMesh();
      G.scene.add(M.markerMesh.group);
    }
    M.markerMesh.group.position.set(x, 0, z);
    M.markerMesh.group.visible = true;
  };

  M.clearMarker = function () {
    M.marker = null;
    if (M.markerMesh) M.markerMesh.group.visible = false;
  };

  M.currentStep = function () {
    if (M.index >= STORY.length) return null;
    return STORY[M.index].steps[M.step];
  };

  M.objectiveText = function () {
    if (M.index >= STORY.length) return "Story complete — Surya Bay is yours. Free roam, or press T / U for side jobs.";
    const mission = STORY[M.index];
    const step = M.currentStep();
    return mission.title + ": " + step.text;
  };

  M.advance = function () {
    const mission = STORY[M.index];
    M.step++;
    M.grabTimer = 0;
    if (M.step >= mission.steps.length) {
      G.player.addCash(mission.reward);
      G.audio.cash();
      G.audio.sting();
      G.hud.toast(mission.title + " complete! +$" + mission.reward);
      M.index++;
      M.step = 0;
      if (M.index >= STORY.length) {
        M.done = true;
        M.clearMarker();
        G.hud.toast("You own Surya Bay now. The city is yours.");
        return;
      }
      G.hud.toast("New mission: " + STORY[M.index].title + " — " + STORY[M.index].blurb);
    }
    const next = M.currentStep();
    if (next) {
      M.setMarker(next.at.x, next.at.z);
      if (next.stealCar) M.spawnGetawayCar();
      if (next.fight) M.spawnGang();
    }
  };

  M.spawnGetawayCar = function () {
    const step = M.currentStep();
    if (!step || step.carSpawned) return;
    step.carSpawned = true;
    const car = makeCar(G, { x: step.at.x, z: step.at.z, kind: "sedan", color: 0xc2161f, heading: Math.PI / 2 });
    car.getaway = true;
    G.cars.push(car);
  };

  M.spawnGang = function () {
    const step = M.currentStep();
    if (!step || step.gangSpawned) return;
    step.gangSpawned = true;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const x = step.at.x + Math.sin(a) * 14;
      const z = step.at.z + Math.cos(a) * 14;
      const mesh = makeGangMesh();
      mesh.position.set(x, 0, z);
      G.scene.add(mesh);
      M.gang.push({ mesh, pos: mesh.position, health: 60, heading: a, flash: 0, punchTimer: 0 });
    }
    G.hud.toast("The rival crew is here. Fight!");
  };

  function makeGangMesh() {
    const g = new THREE.Group();
    const box = new THREE.BoxGeometry(1, 1, 1);
    const body = new THREE.Mesh(box, new THREE.MeshLambertMaterial({ color: 0x8a1f2d }));
    body.scale.set(0.6, 0.72, 0.36);
    body.position.y = 1.15;
    body.castShadow = true;
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 8, 6), new THREE.MeshLambertMaterial({ color: 0x8a6a4a }));
    head.position.y = 1.72;
    g.add(head);
    const band = new THREE.Mesh(box, new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
    band.scale.set(0.44, 0.1, 0.44);
    band.position.y = 1.86;
    g.add(band);
    const legs = new THREE.Mesh(box, new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
    legs.scale.set(0.46, 0.76, 0.28);
    legs.position.y = 0.38;
    g.add(legs);
    return g;
  }

  M.onGangDown = function (gang) {
    gang.health = 0;
    gang.mesh.rotation.x = -Math.PI / 2;
    gang.mesh.position.y = 0.3;
    const left = M.gang.filter((gm) => gm.health > 0).length;
    G.hud.toast("Crew member down. " + left + " left.");
    if (left === 0) {
      for (const gm of M.gang) {
        setTimeout(() => G.scene.remove(gm.mesh), 4000);
      }
      M.gang = [];
      M.advance();
    }
  };

  M.startTaxiJob = function () {
    if (M.taxiJob) {
      G.hud.toast("You already have a fare. Check the marker.");
      return;
    }
    const from = G.city.randomRoadPoint(G.rng);
    const to = G.city.randomRoadPoint(G.rng);
    M.taxiJob = { from: { x: from.x, z: from.z }, to: { x: to.x, z: to.z }, phase: "pickup" };
    M.setMarker(from.x, from.z);
    G.hud.toast("Taxi fare waiting — pick them up in a car. Press T again to cancel.");
  };

  M.startDeliveryJob = function () {
    if (M.deliveryJob) {
      G.hud.toast("You already carry a delivery. Check the marker.");
      return;
    }
    const to = G.city.randomRoadPoint(G.rng);
    M.deliveryJob = { to: { x: to.x, z: to.z } };
    M.setMarker(to.x, to.z);
    G.hud.toast("Delivery job: take the package to the marker. Press U again to cancel.");
  };

  M.update = function (dt) {
    const player = G.player;
    // The effective position is the car while driving: player.pos does not
    // move while the player is behind the wheel, so every distance below
    // (steps, jobs, gang) is measured from the car when there is one.
    const ex = player.car ? player.car.pos.x : player.pos.x;
    const ez = player.car ? player.car.pos.z : player.pos.z;
    // Marker pulse.
    if (M.markerMesh && M.markerMesh.group.visible) {
      const s = 1 + Math.sin(G.time * 4) * 0.12;
      M.markerMesh.ring.scale.set(s, s, 1);
      M.markerMesh.arrow.position.y = 9 + Math.sin(G.time * 3) * 0.8;
    }
    // Gang AI: walk at the player and swing when close.
    for (const gang of M.gang) {
      if (gang.health <= 0) continue;
      const dx = ex - gang.pos.x;
      const dz = ez - gang.pos.z;
      const d = Math.hypot(dx, dz);
      gang.heading = Math.atan2(dx, dz);
      gang.mesh.rotation.y = gang.heading;
      if (d > 2) {
        gang.pos.x += Math.sin(gang.heading) * 4.4 * dt;
        gang.pos.z += Math.cos(gang.heading) * 4.4 * dt;
        G.city.pushOut(gang.pos, 0.5);
      } else {
        gang.punchTimer -= dt;
        if (gang.punchTimer <= 0) {
          gang.punchTimer = 1.1;
          player.hurt(8);
          G.audio.punch();
          G.hud.toast("A crew member hit you!");
        }
      }
      if (gang.flash > 0) {
        gang.flash -= dt;
        gang.mesh.children[0].material.emissive = new THREE.Color(0xffffff);
        gang.mesh.children[0].material.emissiveIntensity = gang.flash * 4;
      } else if (gang.mesh.children[0].material.emissive) {
        gang.mesh.children[0].material.emissiveIntensity = 0;
      }
    }

    // Story steps: arrival completes a step; some steps have conditions.
    const step = M.currentStep();
    if (step) {
      const d = Math.hypot(ex - step.at.x, ez - step.at.z);
      if (step.fight) {
        // Completed by onGangDown, not by arrival.
      } else if (step.hold) {
        if (d < step.r) {
          M.grabTimer += dt;
          if (M.grabTimer >= step.hold) M.advance();
        } else {
          M.grabTimer = 0;
        }
      } else if (d < step.r) {
        if (step.needCar && !player.car) {
          G.hud.setHint("You need a car for this — press E near one.");
        } else if (step.stealCar) {
          if (player.car && player.car.getaway) M.advance();
          else G.hud.setHint("Steal the red Comet — press E next to it.");
        } else {
          M.advance();
        }
      }
    }

    // Side jobs run alongside the story; the marker shows the side job
    // while one is active, and the story step otherwise.
    if (M.taxiJob) {
      const job = M.taxiJob;
      const target = job.phase === "pickup" ? job.from : job.to;
      const d = Math.hypot(ex - target.x, ez - target.z);
      if (d < 5) {
        if (job.phase === "pickup") {
          if (!player.car) {
            G.hud.setHint("The fare needs a car — bring one here.");
          } else {
            job.phase = "dropoff";
            G.hud.toast("Fare aboard. Take them to the marker.");
          }
        } else {
          const pay = 40 + G.rng.int(0, 40);
          player.addCash(pay);
          G.audio.cash();
          G.hud.toast("Fare dropped off. +$" + pay);
          M.taxiJob = null;
        }
      }
    } else if (M.deliveryJob) {
      const d = Math.hypot(ex - M.deliveryJob.to.x, ez - M.deliveryJob.to.z);
      if (d < 5) {
        const pay = 30 + G.rng.int(0, 30);
        player.addCash(pay);
        G.audio.cash();
        G.hud.toast("Delivered. +$" + pay);
        M.deliveryJob = null;
      }
    }

    // Marker follows the active side job, else the story step.
    if (M.taxiJob) {
      const t = M.taxiJob.phase === "pickup" ? M.taxiJob.from : M.taxiJob.to;
      M.setMarker(t.x, t.z);
    } else if (M.deliveryJob) {
      M.setMarker(M.deliveryJob.to.x, M.deliveryJob.to.z);
    } else if (step) {
      M.setMarker(step.at.x, step.at.z);
    } else {
      M.clearMarker();
    }

    // Job keys: T taxi, U delivery.
    if (G.input.hit("KeyT")) {
      if (M.taxiJob) {
        M.taxiJob = null;
        M.clearMarker();
        G.hud.toast("Taxi job cancelled.");
      } else {
        M.startTaxiJob();
      }
    }
    if (G.input.hit("KeyU")) {
      if (M.deliveryJob) {
        M.deliveryJob = null;
        M.clearMarker();
        G.hud.toast("Delivery cancelled.");
      } else {
        M.startDeliveryJob();
      }
    }
  };

  M.start = function () {
    if (M.index >= STORY.length) {
      M.done = true;
      return;
    }
    const step = M.currentStep();
    if (step) {
      M.setMarker(step.at.x, step.at.z);
      // A continued save lands straight on this step, so the step's
      // actors must exist even though advance() never ran for it.
      if (step.stealCar) M.spawnGetawayCar();
      if (step.fight) M.spawnGang();
    }
  };

  return M;
}
