// random.js — a small seeded dice roller for Surya Bay.
// One seed replays the same city, traffic and mission picks on every run,
// so screenshots and replays stay deterministic.
export function makeRng(seed) {
  let s = (seed >>> 0) || 0x9e3779b9;
  function next() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function range(a, b) {
    return a + next() * (b - a);
  }
  function int(a, b) {
    return a + Math.floor(next() * (b - a + 1));
  }
  function pick(list) {
    return list[Math.floor(next() * list.length)];
  }
  function chance(p) {
    return next() < p;
  }
  function angle() {
    return next() * Math.PI * 2;
  }
  return { next, range, int, pick, chance, angle };
}
