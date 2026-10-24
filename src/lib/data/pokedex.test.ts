import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { getDex, type ModdedDex } from './dex';
import {
  buildPokedexIndex,
  filterEntries,
  evolutionChain,
  neighbours,
  toSpeciesId,
  formatDexNumber,
  type PokedexEntry,
} from './pokedex';
import { fetchSpeciesMeta, clearSpeciesMetaCache, POKEAPI_CACHE_PREFIX, POKEAPI_TTL_MS } from './pokeapi';

let dex: ModdedDex;
let entries: PokedexEntry[];

beforeAll(async () => {
  dex = await getDex();
  entries = buildPokedexIndex(dex);
});

describe('buildPokedexIndex', () => {
  it('contains every National Dex base species exactly once, in dex order', () => {
    const base = entries.filter((e) => !e.forme);
    expect(base.length).toBe(1025);
    expect(new Set(base.map((e) => e.num)).size).toBe(1025);
    for (let i = 1; i < entries.length; i++) expect(entries[i].num).toBeGreaterThanOrEqual(entries[i - 1].num);
    expect(base[0]).toMatchObject({ id: 'bulbasaur', num: 1, gen: 1 });
    expect(base[base.length - 1]).toMatchObject({ id: 'pecharunt', num: 1025 });
  });

  it('includes selectable forms but not megas, battle-only or cosmetic forms', () => {
    const ids = new Set(entries.map((e) => e.id));
    expect(ids.has('rotomwash')).toBe(true);
    expect(ids.has('ninetalesalola')).toBe(true);
    expect(ids.has('lycanrocdusk')).toBe(true);
    expect(ids.has('garchompmega')).toBe(false);
    expect(ids.has('darmanitanzen')).toBe(false);
    expect(ids.has('pikachuoriginal')).toBe(false);
    expect(ids.has('unownb')).toBe(false);
    expect(ids.has('charizardgmax')).toBe(false);
    expect(ids.has('missingno')).toBe(false);
  });

  it('builds complete entries', () => {
    const g = entries.find((e) => e.id === 'garchomp')!;
    expect(g).toMatchObject({
      name: 'Garchomp',
      num: 445,
      gen: 4,
      types: ['Dragon', 'Ground'],
      forme: '',
      baseSpecies: 'Garchomp',
      legendary: 'none',
      nfe: false,
      bst: 600,
    });
    expect(g.baseStats).toEqual({ hp: 108, atk: 130, def: 95, spa: 80, spd: 85, spe: 102 });
    const rw = entries.find((e) => e.id === 'rotomwash')!;
    expect(rw).toMatchObject({ name: 'Rotom-Wash', forme: 'Wash', baseSpecies: 'Rotom', num: 479 });
    expect(entries.find((e) => e.id === 'mewtwo')!.legendary).toBe('restricted');
    expect(entries.find((e) => e.id === 'mew')!.legendary).toBe('mythical');
    expect(entries.find((e) => e.id === 'gabite')!.nfe).toBe(true);
  });

  it('orders forms after the base species following formeOrder', () => {
    const rotom = entries.filter((e) => e.num === 479).map((e) => e.id);
    expect(rotom[0]).toBe('rotom');
    expect(rotom).toContain('rotomheat');
    expect(rotom).toContain('rotommow');
    expect(rotom.length).toBe(6);
  });

  it('is memoized per dex instance', () => {
    expect(buildPokedexIndex(dex)).toBe(entries);
  });
});

describe('filterEntries', () => {
  it('hides forms by default and shows them with formsMode=all', () => {
    expect(filterEntries(entries).length).toBe(1025);
    const all = filterEntries(entries, { formsMode: 'all' });
    expect(all.length).toBeGreaterThan(1025);
    expect(all.some((e) => e.id === 'rotomwash')).toBe(true);
  });

  it('searches by name substring and by number', () => {
    const chomp = filterEntries(entries, { query: 'chomp' });
    expect(chomp.map((e) => e.id)).toEqual(['garchomp']);
    expect(filterEntries(entries, { query: 'CHAR' }).map((e) => e.id)).toContain('charizard');
    expect(filterEntries(entries, { query: '#25' }).map((e) => e.id)).toEqual(['pikachu']);
    expect(filterEntries(entries, { query: '25' }).map((e) => e.id)).toEqual(['pikachu']);
    expect(filterEntries(entries, { query: 'rotom wash', formsMode: 'all' }).map((e) => e.id)).toEqual(['rotomwash']);
    expect(filterEntries(entries, { query: 'zzzz' })).toEqual([]);
  });

  it('filters by generation and type (any of the selected)', () => {
    const gen1 = filterEntries(entries, { gens: [1] });
    expect(gen1.length).toBe(151);
    const gen12 = filterEntries(entries, { gens: [1, 2] });
    expect(gen12.length).toBe(251);
    const fire = filterEntries(entries, { types: ['Fire'] });
    expect(fire.every((e) => e.types.includes('Fire'))).toBe(true);
    expect(fire.length).toBeGreaterThan(50);
    const fireOrWater = filterEntries(entries, { types: ['Fire', 'Water'] });
    expect(fireOrWater.length).toBeGreaterThan(fire.length);
    expect(fireOrWater.every((e) => e.types.includes('Fire') || e.types.includes('Water'))).toBe(true);
  });

  it('filters legendaries', () => {
    const only = filterEntries(entries, { legendary: 'only' });
    expect(only.every((e) => e.legendary !== 'none')).toBe(true);
    expect(only.some((e) => e.id === 'mewtwo')).toBe(true);
    const none = filterEntries(entries, { legendary: 'none' });
    expect(none.some((e) => e.id === 'mewtwo')).toBe(false);
    expect(none.length + only.length).toBe(1025);
  });

  it('sorts by number, name and BST', () => {
    const byName = filterEntries(entries, { sort: 'name', gens: [1] });
    expect(byName[0].name).toBe('Abra');
    expect(byName[byName.length - 1].name).toBe('Zubat');
    const byBst = filterEntries(entries, { sort: 'bst' });
    for (let i = 1; i < byBst.length; i++) expect(byBst[i].bst).toBeLessThanOrEqual(byBst[i - 1].bst);
    expect(byBst[0].bst).toBe(720);
    const byNum = filterEntries(entries, { sort: 'number', gens: [9] });
    expect(byNum[0].id).toBe('sprigatito');
  });

  it('does not mutate the input', () => {
    const copy = [...entries];
    filterEntries(entries, { sort: 'bst' });
    expect(entries).toEqual(copy);
  });
});

describe('evolutionChain', () => {
  it('walks pre-evolutions and evolutions', () => {
    const c = evolutionChain(dex, 'gabite')!;
    expect(c.prevos.map((n) => n.id)).toEqual(['gible']);
    expect(c.self.id).toBe('gabite');
    expect(c.self.method).toBe('Level 24');
    expect(c.evos.map((n) => n.id)).toEqual(['garchomp']);
    expect(c.evos[0].method).toBe('Level 48');
    expect(c.root.id).toBe('gible');
    expect(c.root.evos[0].evos[0].id).toBe('garchomp');
  });

  it('handles branching families and non-level methods', () => {
    const e = evolutionChain(dex, 'eevee')!;
    expect(e.prevos).toEqual([]);
    expect(e.evos.length).toBe(8);
    const vap = e.evos.find((n) => n.id === 'vaporeon')!;
    expect(vap.method).toContain('Water Stone');
    const poli = evolutionChain(dex, 'poliwrath')!;
    expect(poli.prevos.map((n) => n.id)).toEqual(['poliwag', 'poliwhirl']);
    expect(poli.root.evos[0].evos.map((n) => n.id).sort()).toEqual(['politoed', 'poliwrath']);
  });

  it('accepts display names and returns null for unknown ids', () => {
    expect(evolutionChain(dex, 'Rotom-Wash')!.self.id).toBe('rotomwash');
    expect(evolutionChain(dex, 'notapokemon')).toBeNull();
  });
});

describe('helpers', () => {
  it('neighbours by dex number skip forms', () => {
    const n = neighbours(entries, 479);
    expect(n.prev?.id).toBe('froslass');
    expect(n.next?.id).toBe('uxie');
    expect(neighbours(entries, 1).prev).toBeUndefined();
    expect(neighbours(entries, 1025).next).toBeUndefined();
  });
  it('toSpeciesId / formatDexNumber', () => {
    expect(toSpeciesId('Rotom-Wash')).toBe('rotomwash');
    expect(formatDexNumber(25)).toBe('#0025');
  });
});

describe('fetchSpeciesMeta', () => {
  const speciesJson = {
    genera: [
      { genus: 'Pokémon Mach', language: { name: 'fr' } },
      { genus: 'Mach Pokémon', language: { name: 'en' } },
    ],
    flavor_text_entries: [
      { flavor_text: 'Old\nentry.', language: { name: 'en' }, version: { name: 'diamond' } },
      { flavor_text: 'Nicht englisch', language: { name: 'de' }, version: { name: 'sword' } },
      { flavor_text: 'It flies at\fsonic speed.', language: { name: 'en' }, version: { name: 'scarlet' } },
    ],
    color: { name: 'blue' },
    habitat: null,
  };
  const pokemonJson = { height: 19, weight: 950 };

  function mockFetch(impl: (url: string) => Promise<Response>) {
    const fn = vi.fn((input: RequestInfo | URL) => impl(String(input)));
    vi.stubGlobal('fetch', fn);
    return fn;
  }
  function ok(body: unknown): Promise<Response> {
    return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } }));
  }

  beforeEach(() => clearSpeciesMetaCache());
  afterEach(() => {
    vi.unstubAllGlobals();
    clearSpeciesMetaCache();
  });

  it('combines species + pokemon data and picks the latest English flavor text', async () => {
    const fn = mockFetch((url) => (url.endsWith('/pokemon-species/445') ? ok(speciesJson) : ok(pokemonJson)));
    const meta = await fetchSpeciesMeta(445);
    expect(meta).toEqual({ genus: 'Mach Pokémon', flavorText: 'It flies at sonic speed.', height: 1.9, weight: 95, color: 'blue' });
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn.mock.calls.map((c) => String(c[0])).sort()).toEqual([
      'https://pokeapi.co/api/v2/pokemon-species/445',
      'https://pokeapi.co/api/v2/pokemon/445',
    ]);
  });

  it('caches in memory (one fetch per number) and dedupes in-flight requests', async () => {
    const fn = mockFetch((url) => (url.includes('species') ? ok(speciesJson) : ok(pokemonJson)));
    const [a, b] = await Promise.all([fetchSpeciesMeta(445), fetchSpeciesMeta(445)]);
    expect(a).toEqual(b);
    expect(fn).toHaveBeenCalledTimes(2);
    await fetchSpeciesMeta(445);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('resolves to null on HTTP errors and network failures without throwing', async () => {
    mockFetch(() => Promise.resolve(new Response('nope', { status: 404 })));
    expect(await fetchSpeciesMeta(99999)).toBeNull();
    mockFetch(() => Promise.reject(new TypeError('offline')));
    expect(await fetchSpeciesMeta(1)).toBeNull();
    expect(await fetchSpeciesMeta(0)).toBeNull();
    expect(await fetchSpeciesMeta(-3)).toBeNull();
  });

  it('includes habitat when present and tolerates a failing /pokemon call', async () => {
    mockFetch((url) =>
      url.includes('species') ? ok({ ...speciesJson, habitat: { name: 'cave' } }) : Promise.resolve(new Response('', { status: 500 })),
    );
    const meta = await fetchSpeciesMeta(42);
    expect(meta?.habitat).toBe('cave');
    expect(meta?.height).toBe(0);
  });

  it('uses localStorage with a 7-day TTL when available', async () => {
    const store = new Map<string, string>();
    const ls = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      key: (i: number) => [...store.keys()][i] ?? null,
      get length() {
        return store.size;
      },
      clear: () => store.clear(),
    };
    vi.stubGlobal('window', { localStorage: ls });
    let clock = 1_000_000;
    const now = () => clock;
    const fn = mockFetch((url) => (url.includes('species') ? ok(speciesJson) : ok(pokemonJson)));

    const first = await fetchSpeciesMeta(445, { now });
    expect(first?.genus).toBe('Mach Pokémon');
    expect(store.has(POKEAPI_CACHE_PREFIX + '445')).toBe(true);
    expect(fn).toHaveBeenCalledTimes(2);

    // New in-memory process, same storage → served from localStorage.
    clearSpeciesMetaCache();
    store.set(POKEAPI_CACHE_PREFIX + '445', JSON.stringify({ t: clock, v: first }));
    const second = await fetchSpeciesMeta(445, { now });
    expect(second).toEqual(first);
    expect(fn).toHaveBeenCalledTimes(2);

    // Expired → refetched.
    clearSpeciesMetaCache();
    store.set(POKEAPI_CACHE_PREFIX + '445', JSON.stringify({ t: clock, v: first }));
    clock += POKEAPI_TTL_MS + 1;
    await fetchSpeciesMeta(445, { now });
    expect(fn).toHaveBeenCalledTimes(4);

    // Corrupt JSON is ignored.
    clearSpeciesMetaCache();
    store.set(POKEAPI_CACHE_PREFIX + '445', '{not json');
    await fetchSpeciesMeta(445, { now });
    expect(fn).toHaveBeenCalledTimes(6);
  });
});
