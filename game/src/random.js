// Seeded random numbers for Surya Bay: one mulberry32 stream plus the small
// helpers the city, traffic and missions draw from. The same seed rebuilds the
// same city, the same traffic and the same mission markers, which is what makes
// the screenshot scenes repeatable.

export function createRandom(seed) {
  let a = (seed | 0) || 1;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    /** A float in [0, 1). */
    next,
    /** A float in [min, max). */
    range(min, max) {
      return min + (max - min) * next();
    },
    /** An integer in [min, max] inclusive. */
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
    /** One element of the array, uniformly. */
    pick(list) {
      return list[Math.floor(next() * list.length)];
    },
    /** true with probability p. */
    chance(p) {
      return next() < p;
    },
    /** A shuffled copy of the array. */
    shuffle(list) {
      const out = list.slice();
      for (let i = out.length - 1; i > 0; i -= 1) {
        const j = Math.floor(next() * (i + 1));
        const tmp = out[i];
        out[i] = out[j];
        out[j] = tmp;
      }
      return out;
    },
  };
}

/** A stable hash of a string, for turning a place name into a seed. */
export function hashSeed(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

