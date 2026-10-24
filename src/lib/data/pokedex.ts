/**
 * Pokédex index: lightweight, serializable entries derived from the Showdown dex so the
 * list page can search/filter/sort without touching the heavy `Species` objects.
 * Works in Node (vitest) and the browser. The index is memoized per dex instance.
 */
import type { TypeName } from '@/lib/battle/types';
import {
  getDex,
  isNatDexSpecies,
  isSelectableSpecies,
  legendaryClass,
  baseStatTotal,
  type LegendaryClass,
  type ModdedDex,
  type Species,
} from './dex';

export interface PokedexBaseStats {
  hp: number;
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
}

export interface PokedexEntry {
  /** Showdown species id (`garchomp`, `rotomwash`). */
  id: string;
  /** Display name (`Garchomp`, `Rotom-Wash`). */
  name: string;
  /** National Dex number. */
  num: number;
  /** Generation the species/form was introduced in (1–9). */
  gen: number;
  types: TypeName[];
  baseStats: PokedexBaseStats;
  /** Base stat total. */
  bst: number;
  /** Forme name (`''` for the base form, `'Wash'`, `'Alola'`, …). */
  forme: string;
  /** Name of the base species (`Rotom` for Rotom-Wash). */
  baseSpecies: string;
  legendary: LegendaryClass;
  /** Not fully evolved. */
  nfe: boolean;
}

export type PokedexSort = 'number' | 'name' | 'bst';
export type LegendaryFilter = 'all' | 'only' | 'none';
export type FormsMode = 'base' | 'all';

export interface PokedexFilter {
  /** Case-insensitive name match; `#445` / `445` matches the dex number. */
  query?: string;
  /** Generations to keep (empty/undefined = all). */
  gens?: number[];
  /** Types to keep — an entry matches when it has ANY of the selected types (empty = all). */
  types?: string[];
  legendary?: LegendaryFilter;
  /** `base` hides alternate forms (only `forme === ''`). Default `base`. */
  formsMode?: FormsMode;
  /** Default `number`. `bst` sorts descending. */
  sort?: PokedexSort;
}

export const GENERATIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

/** Lowercase alphanumeric id, the same normalisation Showdown uses. */
export function toSpeciesId(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function toEntry(s: Species): PokedexEntry {
  const b = s.baseStats;
  return {
    id: s.id,
    name: s.name,
    num: s.num,
    gen: s.gen,
    types: s.types as TypeName[],
    baseStats: { hp: b.hp, atk: b.atk, def: b.def, spa: b.spa, spd: b.spd, spe: b.spe },
    bst: baseStatTotal(s),
    forme: s.forme ?? '',
    baseSpecies: s.baseSpecies,
    legendary: legendaryClass(s),
    nfe: !!s.nfe,
  };
}

/** True for species listed in the Pokédex: every NatDex base species plus the selectable alternate forms. */
export function isPokedexSpecies(s: Species, dex: ModdedDex): boolean {
  if (!isNatDexSpecies(s)) return false;
  if (s.num > 1025) return false;
  if (!s.forme) return true;
  return isSelectableSpecies(s, dex);
}

const indexCache = new WeakMap<ModdedDex, PokedexEntry[]>();

/**
 * Builds (and memoizes per dex) the Pokédex index: all National Dex base species plus the
 * selectable alternate forms, ordered by dex number then forme order.
 */
export function buildPokedexIndex(dex: ModdedDex): PokedexEntry[] {
  const cached = indexCache.get(dex);
  if (cached) return cached;
  const entries: PokedexEntry[] = [];
  for (const s of dex.species.all()) {
    if (isPokedexSpecies(s, dex)) entries.push(toEntry(s));
  }
  const order = new Map<string, number>();
  for (const e of entries) {
    if (!e.forme) {
      const base = dex.species.get(e.id);
      (base.formeOrder ?? []).forEach((name, i) => order.set(toSpeciesId(name), i));
    }
  }
  entries.sort((a, b) => {
    if (a.num !== b.num) return a.num - b.num;
    const ao = a.forme ? (order.get(a.id) ?? 999) : -1;
    const bo = b.forme ? (order.get(b.id) ?? 999) : -1;
    if (ao !== bo) return ao - bo;
    return a.name.localeCompare(b.name);
  });
  indexCache.set(dex, entries);
  return entries;
}

let indexPromise: Promise<PokedexEntry[]> | null = null;
/** Loads the dex (dynamic import) and returns the memoized index. */
export function getPokedexIndex(): Promise<PokedexEntry[]> {
  if (!indexPromise) {
    indexPromise = getDex().then(buildPokedexIndex);
  }
  return indexPromise;
}

const COLLATOR = typeof Intl !== 'undefined' ? new Intl.Collator('en') : undefined;
function compareNames(a: string, b: string): number {
  return COLLATOR ? COLLATOR.compare(a, b) : a < b ? -1 : a > b ? 1 : 0;
}

/** Filters and sorts the index. Never mutates `entries`. */
export function filterEntries(entries: readonly PokedexEntry[], filter: PokedexFilter = {}): PokedexEntry[] {
  const q = (filter.query ?? '').trim().toLowerCase();
  const qId = toSpeciesId(q);
  const qNum = /^#?\d+$/.test(q) ? parseInt(q.replace('#', ''), 10) : null;
  const gens = filter.gens && filter.gens.length > 0 ? new Set(filter.gens) : null;
  const types = filter.types && filter.types.length > 0 ? new Set(filter.types.map((t) => t.toLowerCase())) : null;
  const legendary = filter.legendary ?? 'all';
  const formsMode = filter.formsMode ?? 'base';
  const sort = filter.sort ?? 'number';

  const out = entries.filter((e) => {
    if (formsMode === 'base' && e.forme) return false;
    if (gens && !gens.has(e.gen)) return false;
    if (types && !e.types.some((t) => types.has(t.toLowerCase()))) return false;
    if (legendary === 'only' && e.legendary === 'none') return false;
    if (legendary === 'none' && e.legendary !== 'none') return false;
    if (q) {
      if (qNum !== null) {
        if (e.num !== qNum) return false;
      } else if (!e.name.toLowerCase().includes(q) && !(qId && e.id.includes(qId))) {
        return false;
      }
    }
    return true;
  });

  if (sort === 'name') out.sort((a, b) => compareNames(a.name, b.name) || a.num - b.num);
  else if (sort === 'bst') out.sort((a, b) => b.bst - a.bst || a.num - b.num || compareNames(a.name, b.name));
  // 'number': the index is already in dex order and Array.prototype.filter preserves it.
  return out;
}

export interface EvoNode {
  id: string;
  name: string;
  num: number;
  /** Human-readable evolution method into this node (undefined for the root). */
  method?: string;
}
export interface EvoTree extends EvoNode {
  evos: EvoTree[];
}
export interface EvolutionChain {
  /** Pre-evolutions from the root of the family down to the direct pre-evolution. */
  prevos: EvoNode[];
  self: EvoNode;
  /** Evolutions of this species (nested for multi-stage lines). */
  evos: EvoTree[];
  /** Whole family as a tree from the root (useful for rendering branches like Eevee's). */
  root: EvoTree;
}

function evoMethod(s: Species): string | undefined {
  if (!s.prevo) return undefined;
  const parts: string[] = [];
  switch (s.evoType) {
    case 'trade':
      parts.push(s.evoItem ? `Trade holding ${s.evoItem}` : 'Trade');
      break;
    case 'useItem':
      parts.push(s.evoItem ? `Use ${s.evoItem}` : 'Use item');
      break;
    case 'levelFriendship':
      parts.push('Level up with high friendship');
      break;
    case 'levelHold':
      parts.push(s.evoItem ? `Level up holding ${s.evoItem}` : 'Level up holding an item');
      break;
    case 'levelMove':
      parts.push(s.evoMove ? `Level up knowing ${s.evoMove}` : 'Level up knowing a move');
      break;
    case 'levelExtra':
      parts.push('Level up');
      break;
    case 'other':
      break;
    default:
      parts.push(s.evoLevel ? `Level ${s.evoLevel}` : 'Level up');
  }
  if (s.evoCondition) parts.push(s.evoCondition);
  return parts.join(', ') || 'Special';
}

function node(s: Species): EvoNode {
  const n: EvoNode = { id: s.id, name: s.name, num: s.num };
  const method = evoMethod(s);
  if (method) n.method = method;
  return n;
}

function buildTree(dex: ModdedDex, s: Species, seen: Set<string>): EvoTree {
  seen.add(s.id);
  const evos: EvoTree[] = [];
  for (const name of s.evos ?? []) {
    const e = dex.species.get(name);
    if (!e.exists || seen.has(e.id) || !isNatDexSpecies(e)) continue;
    evos.push(buildTree(dex, e, seen));
  }
  return { ...node(s), evos };
}

/** Evolution family of a species. Returns null for unknown ids. */
export function evolutionChain(dex: ModdedDex, id: string): EvolutionChain | null {
  const species = dex.species.get(toSpeciesId(id));
  if (!species.exists) return null;
  const prevos: EvoNode[] = [];
  const seen = new Set<string>([species.id]);
  let cur: Species = species;
  while (cur.prevo) {
    const p = dex.species.get(cur.prevo);
    if (!p.exists || seen.has(p.id)) break;
    seen.add(p.id);
    prevos.unshift(node(p));
    cur = p;
  }
  const root = buildTree(dex, cur, new Set<string>());
  const self = buildTree(dex, species, new Set<string>());
  return { prevos, self: node(species), evos: self.evos, root };
}

/** Dex-number neighbours among base species (for prev/next navigation). */
export function neighbours(entries: readonly PokedexEntry[], num: number): { prev?: PokedexEntry; next?: PokedexEntry } {
  let prev: PokedexEntry | undefined;
  let next: PokedexEntry | undefined;
  for (const e of entries) {
    if (e.forme) continue;
    if (e.num < num && (!prev || e.num > prev.num)) prev = e;
    if (e.num > num && (!next || e.num < next.num)) next = e;
  }
  return { prev, next };
}

export function formatDexNumber(num: number): string {
  return `#${String(num).padStart(4, '0')}`;
}
