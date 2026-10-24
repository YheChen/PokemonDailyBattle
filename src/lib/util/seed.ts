/** Deterministic string hashing and Showdown PRNG seed derivation. */

/** 32-bit FNV-1a hash of a string. */
export function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Four 16-bit numbers derived from a string, formatted as a Showdown "gen5" PRNG seed string ("a,b,c,d"). */
export function seedFromString(str: string): string {
  const a = fnv1a(str);
  const b = fnv1a(str + '|1');
  const c = fnv1a(str + '|2');
  const d = fnv1a(str + '|3');
  const n = (x: number) => (x & 0xffff).toString();
  return `${n(a)},${n(b)},${n(c)},${n(d)}`;
}

/** Random seed string for non-deterministic battles. */
export function randomSeed(): string {
  const r = () => Math.floor(Math.random() * 0x10000).toString();
  return `${r()},${r()},${r()},${r()}`;
}

/** YYYY-MM-DD for the current UTC day. */
export function utcDateKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/** Whole days since 1970-01-01 for a YYYY-MM-DD key. */
export function daysSinceEpoch(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}
