/**
 * Cached PokéAPI lookups for Pokédex flavour data (genus, flavor text, height/weight, color, habitat).
 * Results are cached in memory and in localStorage (`pc:pokeapi:<num>`) for 7 days.
 * Never throws: resolves to `null` when offline or when the API answers with an error.
 */

export interface SpeciesMeta {
  genus: string;
  /** Latest English Pokédex entry. */
  flavorText: string;
  /** Height in metres. */
  height: number;
  /** Weight in kilograms. */
  weight: number;
  color: string;
  habitat?: string;
}

export const POKEAPI_BASE = 'https://pokeapi.co/api/v2';
export const POKEAPI_CACHE_PREFIX = 'pc:pokeapi:';
export const POKEAPI_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface CacheRecord {
  t: number;
  v: SpeciesMeta;
}

const memory = new Map<number, SpeciesMeta>();
const inflight = new Map<number, Promise<SpeciesMeta | null>>();

function storage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function readCache(num: number, now: number): SpeciesMeta | null {
  const ls = storage();
  if (!ls) return null;
  try {
    const raw = ls.getItem(POKEAPI_CACHE_PREFIX + num);
    if (!raw) return null;
    const rec = JSON.parse(raw) as Partial<CacheRecord>;
    if (!rec || typeof rec.t !== 'number' || !rec.v || typeof rec.v !== 'object') return null;
    if (now - rec.t > POKEAPI_TTL_MS) {
      ls.removeItem(POKEAPI_CACHE_PREFIX + num);
      return null;
    }
    if (!isMeta(rec.v)) return null;
    return rec.v;
  } catch {
    return null;
  }
}

function writeCache(num: number, meta: SpeciesMeta, now: number): void {
  const ls = storage();
  if (!ls) return;
  try {
    const rec: CacheRecord = { t: now, v: meta };
    ls.setItem(POKEAPI_CACHE_PREFIX + num, JSON.stringify(rec));
  } catch {
    // quota exceeded / disabled storage: ignore
  }
}

function isMeta(v: unknown): v is SpeciesMeta {
  if (!v || typeof v !== 'object') return false;
  const m = v as Record<string, unknown>;
  return (
    typeof m.genus === 'string' &&
    typeof m.flavorText === 'string' &&
    typeof m.height === 'number' &&
    typeof m.weight === 'number' &&
    typeof m.color === 'string'
  );
}

interface NamedRef {
  name: string;
}
interface SpeciesResponse {
  genera?: { genus: string; language: NamedRef }[];
  flavor_text_entries?: { flavor_text: string; language: NamedRef; version: NamedRef }[];
  color?: NamedRef | null;
  habitat?: NamedRef | null;
}
interface PokemonResponse {
  height?: number;
  weight?: number;
}

function cleanFlavor(text: string): string {
  return text
    .replace(/[\n\f\r]+/g, ' ')
    .replace(/­/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T | null> {
  try {
    const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export interface FetchSpeciesMetaOptions {
  /** Bypass both caches. */
  force?: boolean;
  signal?: AbortSignal;
  /** Clock override (tests). */
  now?: () => number;
}

/**
 * Species metadata from PokéAPI by National Dex number. Cached in memory + localStorage for 7 days.
 * Resolves to `null` (never throws) when the data cannot be fetched.
 */
export function fetchSpeciesMeta(num: number, opts: FetchSpeciesMetaOptions = {}): Promise<SpeciesMeta | null> {
  if (!Number.isInteger(num) || num <= 0) return Promise.resolve(null);
  const now = opts.now ?? Date.now;
  if (!opts.force) {
    const hit = memory.get(num);
    if (hit) return Promise.resolve(hit);
    const stored = readCache(num, now());
    if (stored) {
      memory.set(num, stored);
      return Promise.resolve(stored);
    }
    const pending = inflight.get(num);
    if (pending) return pending;
  }

  const p = (async (): Promise<SpeciesMeta | null> => {
    if (typeof fetch !== 'function') return null;
    const [species, pokemon] = await Promise.all([
      getJson<SpeciesResponse>(`${POKEAPI_BASE}/pokemon-species/${num}`, opts.signal),
      getJson<PokemonResponse>(`${POKEAPI_BASE}/pokemon/${num}`, opts.signal),
    ]);
    if (!species) return null;
    const genus = species.genera?.find((g) => g.language?.name === 'en')?.genus ?? '';
    const english = (species.flavor_text_entries ?? []).filter((f) => f.language?.name === 'en');
    const flavorText = english.length ? cleanFlavor(english[english.length - 1].flavor_text) : '';
    const meta: SpeciesMeta = {
      genus,
      flavorText,
      height: typeof pokemon?.height === 'number' ? pokemon.height / 10 : 0,
      weight: typeof pokemon?.weight === 'number' ? pokemon.weight / 10 : 0,
      color: species.color?.name ?? '',
    };
    if (species.habitat?.name) meta.habitat = species.habitat.name;
    memory.set(num, meta);
    writeCache(num, meta, now());
    return meta;
  })()
    .catch(() => null)
    .finally(() => {
      if (inflight.get(num) === p) inflight.delete(num);
    });
  inflight.set(num, p);
  return p;
}

/** Clears the in-memory cache (and the localStorage entries when available). Mainly for tests. */
export function clearSpeciesMetaCache(): void {
  memory.clear();
  inflight.clear();
  const ls = storage();
  if (!ls) return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < ls.length; i++) {
      const k = ls.key(i);
      if (k && k.startsWith(POKEAPI_CACHE_PREFIX)) keys.push(k);
    }
    keys.forEach((k) => ls.removeItem(k));
  } catch {
    // ignore
  }
}

export function formatHeight(m: number): string {
  return `${m.toFixed(1)} m`;
}
export function formatWeight(kg: number): string {
  return `${kg.toFixed(1)} kg`;
}
