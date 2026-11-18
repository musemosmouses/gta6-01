// traffic.js — AI cars that drive the city's roads: they follow one avenue
// or street, turn at intersections, and slow down for the car ahead.
// They are background life, not the player's car.
import { makeCar, separateCars } from "./vehicles.js";

export function makeTraffic(G) {
  const T = { cars: [] };

  function spawnOne() {
    const spot = G.city.randomRoadPoint(G.rng);
    const kind = G.rng.chance(0.12) ? "taxi" : (G.rng.chance(0.12) ? "truck" : "sedan");
    const car = makeCar(G, {
      x: spot.x, z: spot.z, kind,
      heading: spot.alongX ? (G.rng.chance(0.5) ? 0 : Math.PI) : (G.rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2),
      driver: "traffic",
    });
    car.cruise = G.rng.range(8, 14);
    car.lane = G.rng.pick([-3, 3]);
    car.alongX = spot.alongX;
    car.dir = car.heading === 0 || car.heading === Math.PI / 2 ? 1 : -1;
    T.cars.push(car);
    G.cars.push(car);
    return car;
  }

  T.init = function (n) {
    for (let i = 0; i < n; i++) spawnOne();
  };

  T.update = function (dt) {
    for (const car of T.cars) {
      if (car.dead) continue;
      // The player's car is driven by the player, never by traffic AI:
      // otherwise the AI would fight the steering and drag the car onto
      // its own route. It rejoins traffic when the player gets out.
      if (car.driver === "player") continue;
      // Desired heading: along the current road, in the current direction.
      let wantHeading = car.alongX ? (car.dir > 0 ? 0 : Math.PI) : (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      // At an intersection, sometimes turn onto the cross road.
      const nearLine = (v) => {
        const m = ((v % 52) + 52) % 52;
        return Math.min(m, 52 - m) < 2.5;
      };
      if ((car.alongX && nearLine(car.pos.z)) || (!car.alongX && nearLine(car.pos.x))) {
        if (G.rng.chance(0.012)) {
          car.alongX = !car.alongX;
          car.dir = G.rng.chance(0.5) ? 1 : -1;
          wantHeading = car.alongX ? (car.dir > 0 ? 0 : Math.PI) : (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
        }
      }
      let d = wantHeading - car.heading;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      car.heading += Math.max(-1.6 * dt, Math.min(1.6 * dt, d));
      // Slow for the car ahead in the same lane.
      let targetSpeed = car.cruise;
      const fx = Math.sin(car.heading);
      const fz = Math.cos(car.heading);
      for (const other of G.cars) {
        if (other === car || other.dead) continue;
        const dx = other.pos.x - car.pos.x;
        const dz = other.pos.z - car.pos.z;
        const along = dx * fx + dz * fz;
        const side = Math.abs(dx * fz - dz * fx);
        if (along > 0 && along < 13 && side < 3.2) {
          targetSpeed = Math.min(targetSpeed, Math.max(0, other.speed - 1));
        }
      }
      car.speed += (targetSpeed - car.speed) * Math.min(1, 1.6 * dt);
      car.pos.x += fx * car.speed * dt;
      car.pos.z += fz * car.speed * dt;
      car.mesh.rotation.y = car.heading;
      // Keep inside the city; recycle far cars to a fresh road.
      if (Math.abs(car.pos.x) > 320 || Math.abs(car.pos.z) > 320) {
        const spot = G.city.randomRoadPoint(G.rng);
        car.pos.x = spot.x;
        car.pos.z = spot.z;
        car.alongX = spot.alongX;
        car.dir = G.rng.chance(0.5) ? 1 : -1;
        car.heading = car.alongX ? (car.dir > 0 ? 0 : Math.PI) : (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      }
      G.city.pushOut(car.pos, 1.6);
    }
    // Pairwise separation so traffic never overlaps itself.
    for (let i = 0; i < T.cars.length; i++) {
      for (let j = i + 1; j < T.cars.length; j++) {
        separateCars(G, T.cars[i], T.cars[j]);
      }
    }
  };

  return T;
}
