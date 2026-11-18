// Missions and side jobs: the story of Surya Bay. Five chained story
// missions — steal a car, run a package, drive a taxi fare, survive a
// getaway, pull the Bay Heist — plus repeatable taxi and delivery jobs that
// pay cash between story beats. Each step has a glowing beacon in the world,
// an objective line on the HUD and a diamond on the minimap, so the player
// always knows where the story is.

import * as THREE from 'three';

const MISSION_PAY = [150, 250, 300, 600, 5000];

export function createMissions(G) {
  let index = 0; // 0..4 story missions, 5 = story done
  let step = 0; // step inside the current mission
  let stepTimer = 0;
  let sideJob = null; // { kind, pay, marker, passenger }
  let sideJobCooldown = 20;
  let marker = null;
  let beacon = null;
  let gang = [];

  const beaconGeo = new THREE.CylinderGeometry(3, 3, 30, 16, 1, true);
  const beaconMat = new THREE.MeshBasicMaterial({
    color: 0xffd23e, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false,
  });
  const ringGeo = new THREE.RingGeometry(2.4, 3.4, 24);

  function setMarker(pos, label) {
    clearMarker();
    marker = { pos: pos.clone(), label };
    beacon = new THREE.Group();
    const column = new THREE.Mesh(beaconGeo, beaconMat);
    column.position.y = 15;
    beacon.add(column);
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffd23e, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.15;
    beacon.add(ring);
    beacon.position.copy(pos);
    G.scene.add(beacon);
    G.hud.setObjective(label);
  }

  function clearMarker() {
    if (beacon) {
      G.scene.remove(beacon);
      beacon = null;
    }
    marker = null;
  }

  function clearGang() {
    for (const g of gang) {
      G.scene.remove(g.group);
      const i = G.peds.list.indexOf(g);
      if (i !== -1) G.peds.list.splice(i, 1);
    }
    gang = [];
  }

  function roadPointNear(x, z, minDist) {
    for (let tries = 0; tries < 12; tries += 1) {
      const p = G.city.randomRoadPoint();
      if (Math.hypot(p.x - x, p.z - z) > minDist) return new THREE.Vector3(p.x, 0, p.z);
    }
    const p = G.city.randomRoadPoint();
    return new THREE.Vector3(p.x, 0, p.z);
  }

  function startMission(i) {
    index = i;
    step = 0;
    stepTimer = 0;
    clearGang();
    if (i === 0) {
      setMarker(roadPointNear(G.player.pos.x, G.player.pos.z, 120), 'Mission 1 — Borrowed Wheels: steal any car and drive it here');
    } else if (i === 1) {
      setMarker(roadPointNear(G.player.pos.x, G.player.pos.z, 100), 'Mission 2 — Package Run: pick up the package at the marker');
    } else if (i === 2) {
      setMarker(roadPointNear(G.player.pos.x, G.player.pos.z, 100), 'Mission 3 — Taxi Rush: pick up the passenger at the marker');
    } else if (i === 3) {
      setMarker(roadPointNear(G.player.pos.x, G.player.pos.z, 120), 'Mission 4 — The Getaway: grab the cash bag at the marker');
    } else if (i === 4) {
      setMarker(roadPointNear(G.player.pos.x, G.player.pos.z, 140), 'Mission 5 — Bay Heist: reach the bank and hold position');
    }
  }

  function completeMission() {
    const pay = MISSION_PAY[index];
    G.player.cash += pay;
    G.hud.flash(`Mission complete! +$${pay}`);
    G.audio.mission();
    G.save.write();
    if (index >= 4) {
      index = 5;
      clearMarker();
      G.hud.setObjective('Story complete — free roam! Take taxi and delivery jobs to earn cash.');
      return;
    }
    startMission(index + 1);
  }

  function spawnGang(pos, count) {
    clearGang();
    for (let i = 0; i < count; i += 1) {
      const g = G.peds.spawnPed(pos.x + G.rng.range(-6, 6), pos.z + G.rng.range(-6, 6));
      g.isGang = true;
      g.state = 'walk';
      g.shootAt = 0;
      gang.push(g);
    }
  }

  function startSideJob(kind) {
    const pay = kind === 'taxi' ? G.rng.int(80, 150) : G.rng.int(60, 120);
    const dest = roadPointNear(G.player.pos.x, G.player.pos.z, 130);
    sideJob = { kind, pay, dest, pickedUp: false, timer: 150 };
    if (kind === 'taxi') {
      const p = roadPointNear(G.player.pos.x, G.player.pos.z, 60);
      const passenger = G.peds.spawnPed(p.x, p.z);
      passenger.state = 'idle';
      passenger.idleUntil = G.time + 150;
      sideJob.passenger = passenger;
      sideJob.pickup = new THREE.Vector3(p.x, 0, p.z);
      setMarker(sideJob.pickup, `Taxi job ($${pay}): pick up the passenger at the marker`);
    } else {
      setMarker(dest, `Delivery job ($${pay}): take the package to the marker`);
      sideJob.pickedUp = true;
    }
    G.hud.flash(kind === 'taxi' ? 'New taxi job — pick up the passenger' : 'New delivery job — take it to the marker');
  }

  function finishSideJob() {
    if (!sideJob) return;
    G.player.cash += sideJob.pay;
    G.hud.flash(`Job done! +$${sideJob.pay}`);
    G.audio.mission();
    if (sideJob.passenger) {
      const i = G.peds.list.indexOf(sideJob.passenger);
      if (i !== -1) G.peds.list.splice(i, 1);
      G.scene.remove(sideJob.passenger.group);
    }
    sideJob = null;
    sideJobCooldown = 45;
    if (index < 5) startMission(index);
    else G.hud.setObjective('Story complete — free roam! Take taxi and delivery jobs to earn cash.');
  }

  function failSideJob(reason) {
    if (!sideJob) return;
    G.hud.flash(reason);
    if (sideJob.passenger) {
      const i = G.peds.list.indexOf(sideJob.passenger);
      if (i !== -1) G.peds.list.splice(i, 1);
      G.scene.remove(sideJob.passenger.group);
    }
    sideJob = null;
    sideJobCooldown = 45;
    if (index < 5) startMission(index);
  }

  function atMarker(pos, radius) {
    if (!marker) return false;
    return Math.hypot(pos.x - marker.pos.x, pos.z - marker.pos.z) < radius;
  }

  function update(dt) {
    if (beacon) {
      beacon.rotation.y += dt * 0.8;
      beacon.position.y = Math.sin(G.time * 2) * 0.3;
    }
    // Gang members in the heist missions shoot at the player.
    for (const g of gang) {
      if (g.state === 'down') continue;
      const d = g.pos.distanceTo(G.player.pos);
      if (d < 45) {
        const dx = G.player.pos.x - g.pos.x;
        const dz = G.player.pos.z - g.pos.z;
        g.heading = Math.atan2(dx, dz);
        g.group.rotation.y = g.heading;
        if (d > 12) {
          g.pos.x += Math.sin(g.heading) * 2.6 * dt;
          g.pos.z += Math.cos(g.heading) * 2.6 * dt;
        }
        // One shot each, on average, every ~3.3 s per gang member: a
        // 2.2 s cooldown, then a per-second chance to fire. (Was: a
        // 1.4 s cooldown then chance(0.5) every frame, so a member fired
        // within ~2 frames of the cooldown ending — about 10.7 DPS from
        // three members in the finale, which no health pool survives.)
        if (G.time - g.shootAt > 2.2 && G.rng.chance(0.9 * dt)) {
          g.shootAt = G.time;
          G.player.damage(5, 'gang');
          G.audio.shoot(true);
        }
      }
    }

    if (sideJob) {
      sideJob.timer -= dt;
      if (sideJob.timer <= 0) {
        failSideJob('Job failed — too slow.');
        return;
      }
      if (sideJob.kind === 'taxi' && !sideJob.pickedUp) {
        if (!G.player.onFoot && G.player.car && Math.hypot(G.player.car.pos.x - sideJob.pickup.x, G.player.car.pos.z - sideJob.pickup.z) < 6) {
          sideJob.pickedUp = true;
          sideJob.passenger.state = 'passenger';
          sideJob.passenger.group.visible = false;
          setMarker(sideJob.dest, `Taxi job ($${sideJob.pay}): drive the passenger to the marker`);
          G.hud.flash('Passenger aboard — drive to the marker');
        }
      } else if (atMarker(G.player.onFoot ? G.player.pos : G.player.car.pos, 7)) {
        finishSideJob();
        return;
      }
    }

    if (index >= 5 || !marker) return;
    const pos = G.player.onFoot ? G.player.pos : G.player.car.pos;
    if (index === 0) {
      // Steal any car, then reach the marker in it.
      if (!G.player.onFoot && atMarker(pos, 8)) completeMission();
    } else if (index === 1) {
      if (step === 0 && G.player.onFoot && atMarker(pos, 5)) {
        step = 1;
        stepTimer = 90;
        G.player.hasPackage = true;
        setMarker(roadPointNear(pos.x, pos.z, 130), 'Mission 2 — Package Run: deliver the package (90s)');
        G.hud.flash('Package picked up — 90 seconds!');
      } else if (step === 1) {
        stepTimer -= dt;
        if (stepTimer <= 0) {
          G.hud.flash('Too slow — the package run failed. Try again.');
          startMission(1);
        } else if (G.player.onFoot && atMarker(pos, 6)) {
          G.player.hasPackage = false;
          completeMission();
        }
      }
    } else if (index === 2) {
      if (step === 0 && !G.player.onFoot && atMarker(pos, 7)) {
        step = 1;
        stepTimer = 120;
        setMarker(roadPointNear(pos.x, pos.z, 150), 'Mission 3 — Taxi Rush: drive the fare to the marker (120s)');
        G.hud.flash('Fare aboard — 120 seconds!');
        G.audio.pickup();
      } else if (step === 1) {
        stepTimer -= dt;
        if (stepTimer <= 0) {
          G.hud.flash('Too slow — the fare walked away. Try again.');
          startMission(2);
        } else if (!G.player.onFoot && atMarker(pos, 7)) {
          completeMission();
        }
      }
    } else if (index === 3) {
      if (step === 0 && atMarker(pos, 5)) {
        step = 1;
        stepTimer = 75;
        G.police.addHeat(6, 'The getaway is on — the police are coming');
        setMarker(new THREE.Vector3(-40, 0, 296), 'Mission 4 — The Getaway: lose the heat — reach the spray garage');
        G.hud.flash('Cash grabbed! Lose the cops at the spray garage!');
      } else if (step === 1) {
        stepTimer -= dt;
        if (G.police.stars === 0) {
          completeMission();
        } else if (stepTimer <= 0) {
          G.hud.flash('The getaway failed — the cops boxed you in. Try again.');
          startMission(3);
        }
      }
    } else if (index === 4) {
      if (step === 0) {
        if (atMarker(pos, 7)) {
          step = 1;
          stepTimer = 4;
          spawnGang(marker.pos, 3);
          G.hud.flash('Cracking the vault — hold position!');
        }
      } else if (step === 1) {
        stepTimer -= dt;
        if (!atMarker(pos, 9)) {
          step = 0;
          clearGang();
          G.hud.flash('You left the bank — the heist is off. Go back to the marker.');
        } else if (stepTimer <= 0) {
          step = 2;
          G.police.addHeat(8, 'The vault is open — every cop in the Bay is coming');
          setMarker(new THREE.Vector3(0, 0, 120), 'Mission 5 — Bay Heist: escape to the safe house!');
          G.hud.flash('Loot secured! Escape to the safe house!');
        }
      } else if (step === 2) {
        if (atMarker(pos, 8)) completeMission();
      }
    }

    // Offer a side job only once the story is done, so a job never steals
    // the marker of a story mission in progress.
    if (!sideJob && index >= 5 && G.time > sideJobCooldown) {
      sideJobCooldown = G.time + 90;
      startSideJob(G.rng.chance(0.5) ? 'taxi' : 'delivery');
    }
  }

  return {
    get index() {
      return index;
    },
    set index(v) {
      index = v;
    },
    get marker() {
      return marker;
    },
    get sideJob() {
      return sideJob;
    },
    startMission,
    completeMission,
    update,
  };
}
