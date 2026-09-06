/**
 * Dice.
 *
 * The random source is a parameter rather than a direct call to Math.random
 * so tests can hand in a predictable sequence and assert on exact outcomes.
 * `seededRng` is a mulberry32 generator: small, fast, and deterministic for
 * a given seed.
 */

export type DieFace = 1 | 2 | 3 | 4 | 5 | 6;

export type Rng = () => number;

export const defaultRng: Rng = Math.random;

export function rollDie(rng: Rng = defaultRng): DieFace {
  return (Math.floor(rng() * 6) + 1) as DieFace;
}

/** Deterministic generator, used by tests and by "replay" style debugging. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
