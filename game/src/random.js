// random.js — Puerto Serena: Neon Tide
// One job: deterministic randomness. Every world build and every
// screenshot scene runs from a seeded generator so a given seed always
// grows the same city, the same traffic and the same staged shots.

export class SeededRandom {
  constructor(seed = 1) {
    // Mulberry-style state, kept as a 32-bit integer.
    this.state = (seed >>> 0) || 1;
  }

  // Next float in [0, 1).
  next() {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Float in [lo, hi).
  range(lo, hi) {
    return lo + this.next() * (hi - lo);
  }

  // Integer in [lo, hi] inclusive.
  int(lo, hi) {
    return lo + Math.floor(this.next() * (hi - lo + 1));
  }

  // True with probability p.
  chance(p) {
    return this.next() < p;
  }

  // One element of an array (undefined for an empty array).
  pick(list) {
    if (!list.length) return undefined;
    return list[Math.floor(this.next() * list.length)];
  }

  // A sign: -1 or +1.
  sign() {
    return this.next() < 0.5 ? -1 : 1;
  }

  // In-place Fisher–Yates shuffle driven by this generator.
  shuffle(list) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const tmp = list[i];
      list[i] = list[j];
      list[j] = tmp;
    }
    return list;
  }
}

// Hash a short string seed (a scene name, a district name) to an int.
export function seedFromString(text) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Combine a numeric seed with a label so each subsystem can draw from
// its own stream without disturbing the others.
export function deriveSeed(seed, label) {
  return (seedFromString(label) ^ (seed >>> 0)) >>> 0;
}
