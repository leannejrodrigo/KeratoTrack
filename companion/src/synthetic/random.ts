/**
 * Mulberry32: a tiny seeded pseudo-random number generator.
 *
 * Math.random() cannot be seeded, so demo data would differ on every load and
 * screenshots or tests could not be reproduced. A seeded PRNG gives the same
 * sequence for the same seed. Mulberry32 keeps 32 bits of state; each call
 * adds a constant (a "Weyl sequence", which guarantees a full 2^32 period) and
 * then scrambles the bits with multiply-xorshift steps. Statistically fine for
 * demo data; NOT suitable for anything security-related.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A UUID-shaped identifier from the seeded generator (deterministic). */
export function seededUuid(rand: () => number): string {
  const hex = Array.from({ length: 32 }, () => Math.floor(rand() * 16).toString(16)).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${((parseInt(hex[16]!, 16) & 3) | 8).toString(16)}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
